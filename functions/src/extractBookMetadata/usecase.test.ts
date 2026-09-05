import * as fs from "node:fs";
import * as path from "node:path";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import JSZip from "jszip";
import { beforeEach, describe, expect, it } from "vitest";
import { clearFirestore } from "../../testing/clearFirestore";
import { extractBookMetadata } from "./usecase";

const PROJECT_ID = process.env.GCLOUD_PROJECT!;
const BUCKET_NAME = `${PROJECT_ID}.appspot.com`;
const TEST_USER_ID = "test-user-id";

const fixturesDir = path.resolve(
	import.meta.dirname,
	"..",
	"..",
	"..",
	"fixtures",
	"books",
);

const fileEntry = (status: string) => ({
	fileSize: 1,
	status,
	errorCode: null,
	addedAt: FieldValue.serverTimestamp(),
});

async function createStubBook(
	userId: string,
	bookId: string,
	format = "epub",
): Promise<void> {
	const db = getFirestore();
	await db.doc(`users/${userId}/books/${bookId}`).set({
		title: "",
		authorIds: [],
		publisherId: null,
		description: null,
		languages: [],
		identifiers: [],
		files: { [format]: fileEntry("processing") },
		hasProcessingFile: true,
		hasCover: false,
		status: "processing",
		errorCode: null,
		createdAt: FieldValue.serverTimestamp(),
		updatedAt: FieldValue.serverTimestamp(),
	});
}

async function uploadFixture(
	storagePath: string,
	localPath: string,
): Promise<void> {
	const bucket = getStorage().bucket(BUCKET_NAME);
	const data = fs.readFileSync(localPath);
	await bucket.file(storagePath).save(data);
}

async function uploadBuffer(storagePath: string, data: Buffer): Promise<void> {
	const bucket = getStorage().bucket(BUCKET_NAME);
	await bucket.file(storagePath).save(data);
}

async function buildEpub(opfMetadataXml: string): Promise<Buffer> {
	const zip = new JSZip();
	zip.file("mimetype", "application/epub+zip");
	zip.file(
		"META-INF/container.xml",
		`<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`,
	);
	zip.file(
		"OEBPS/content.opf",
		`<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    ${opfMetadataXml}
  </metadata>
  <manifest/>
  <spine/>
</package>`,
	);
	return Buffer.from(await zip.generateAsync({ type: "nodebuffer" }));
}

describe("extractBookMetadata", () => {
	beforeEach(async () => {
		await clearFirestore();
	});

	it("extracts full metadata from an EPUB file", async () => {
		const bookId = "test-book-epub";
		const storagePath = `users/${TEST_USER_ID}/books/${bookId}/book.epub`;

		await createStubBook(TEST_USER_ID, bookId);
		await uploadFixture(
			storagePath,
			path.join(fixturesDir, "alice-in-wonderland", "book.epub"),
		);

		await extractBookMetadata({
			userId: TEST_USER_ID,
			bookId,
			format: "epub",
		});

		const db = getFirestore();
		const bookSnap = await db
			.doc(`users/${TEST_USER_ID}/books/${bookId}`)
			.get();
		const book = bookSnap.data()!;

		expect(book.status).toBe("ready");
		expect(book.errorCode).toBeNull();
		expect(book.title).toBe("Alice's Adventures in Wonderland");
		expect(book.languages).toContain("en");
		expect(book.authorIds).toHaveLength(1);
		expect(book.hasCover).toBe(true);
		expect(book.files.epub.status).toBe("ready");
		expect(book.hasProcessingFile).toBe(false);

		// Verify author doc was created
		const authorsSnap = await db
			.collection(`users/${TEST_USER_ID}/authors`)
			.get();
		expect(authorsSnap.docs).toHaveLength(1);
		const authorData = authorsSnap.docs[0].data();
		expect(authorData.name).toBe("Lewis Carroll");

		// Verify author ID matches
		expect(book.authorIds[0]).toBe(authorsSnap.docs[0].id);

		// Verify cover was uploaded to storage
		const bucket = getStorage().bucket(BUCKET_NAME);
		const coverPath = `users/${TEST_USER_ID}/books/${bookId}/cover.png`;
		const [exists] = await bucket.file(coverPath).exists();
		expect(exists).toBe(true);
	});

	it("sets error status for invalid file data", async () => {
		const bookId = "test-book-invalid";
		const storagePath = `users/${TEST_USER_ID}/books/${bookId}/book.epub`;

		await createStubBook(TEST_USER_ID, bookId);

		// Upload garbage data as an "epub"
		const bucket = getStorage().bucket(BUCKET_NAME);
		await bucket.file(storagePath).save(Buffer.from("not a valid epub"));

		await extractBookMetadata({
			userId: TEST_USER_ID,
			bookId,
			format: "epub",
		});

		const db = getFirestore();
		const bookSnap = await db
			.doc(`users/${TEST_USER_ID}/books/${bookId}`)
			.get();
		const book = bookSnap.data()!;

		expect(book.status).toBe("error");
		expect(book.errorCode).toBe("extraction-failed");
		expect(book.files.epub.status).toBe("error");
		expect(book.files.epub.errorCode).toBe("extraction-failed");
		expect(book.hasProcessingFile).toBe(false);
	});

	it("sets error status for an unsupported format", async () => {
		const bookId = "test-book-txt";
		const storagePath = `users/${TEST_USER_ID}/books/${bookId}/book.txt`;

		await createStubBook(TEST_USER_ID, bookId, "txt");
		await uploadBuffer(storagePath, Buffer.from("plain text content"));

		await extractBookMetadata({
			userId: TEST_USER_ID,
			bookId,
			format: "txt",
			originalName: "my-great-book.txt",
		});

		const db = getFirestore();
		const bookSnap = await db
			.doc(`users/${TEST_USER_ID}/books/${bookId}`)
			.get();
		const book = bookSnap.data()!;

		expect(book.status).toBe("error");
		expect(book.errorCode).toBe("unsupported-format");
	});

	it("writes an empty title when the file and filename yield none", async () => {
		const bookId = "test-book-no-title";
		const storagePath = `users/${TEST_USER_ID}/books/${bookId}/book.epub`;

		// Valid EPUB with no dc:title, uploaded without an originalName.
		const epub = await buildEpub("<dc:language>en</dc:language>");
		await createStubBook(TEST_USER_ID, bookId);
		await uploadBuffer(storagePath, epub);

		await extractBookMetadata({
			userId: TEST_USER_ID,
			bookId,
			format: "epub",
		});

		const db = getFirestore();
		const bookSnap = await db
			.doc(`users/${TEST_USER_ID}/books/${bookId}`)
			.get();
		const book = bookSnap.data()!;

		expect(book.status).toBe("ready");
		expect(book.title).toBe("");
	});

	it("creates multiple author documents for an EPUB with multiple authors", async () => {
		const bookId = "test-book-multi-author";
		const storagePath = `users/${TEST_USER_ID}/books/${bookId}/book.epub`;

		const epub = await buildEpub(
			`<dc:title>Multi Author Book</dc:title>
			<dc:creator>Author One</dc:creator>
			<dc:creator>Author Two</dc:creator>
			<dc:language>en</dc:language>`,
		);

		await createStubBook(TEST_USER_ID, bookId);
		await uploadBuffer(storagePath, epub);

		await extractBookMetadata({
			userId: TEST_USER_ID,
			bookId,
			format: "epub",
		});

		const db = getFirestore();
		const bookSnap = await db
			.doc(`users/${TEST_USER_ID}/books/${bookId}`)
			.get();
		const book = bookSnap.data()!;

		expect(book.status).toBe("ready");
		expect(book.authorIds).toHaveLength(2);

		const authorsSnap = await db
			.collection(`users/${TEST_USER_ID}/authors`)
			.get();
		const authorNames = authorsSnap.docs.map((d) => d.data().name).sort();
		expect(authorNames).toEqual(["Author One", "Author Two"]);
	});

	it("creates publisher and links it to the book", async () => {
		const bookId = "test-book-publisher";
		const storagePath = `users/${TEST_USER_ID}/books/${bookId}/book.epub`;

		const epub = await buildEpub(
			`<dc:title>Published Book</dc:title>
			<dc:creator>Some Author</dc:creator>
			<dc:publisher>Acme Publishing</dc:publisher>
			<dc:language>en</dc:language>`,
		);

		await createStubBook(TEST_USER_ID, bookId);
		await uploadBuffer(storagePath, epub);

		await extractBookMetadata({
			userId: TEST_USER_ID,
			bookId,
			format: "epub",
		});

		const db = getFirestore();
		const bookSnap = await db
			.doc(`users/${TEST_USER_ID}/books/${bookId}`)
			.get();
		const book = bookSnap.data()!;

		expect(book.publisherId).not.toBeNull();

		const publishersSnap = await db
			.collection(`users/${TEST_USER_ID}/publishers`)
			.get();
		expect(publishersSnap.docs).toHaveLength(1);
		expect(publishersSnap.docs[0].data().name).toBe("Acme Publishing");
		expect(book.publisherId).toBe(publishersSnap.docs[0].id);
	});

	it("marks an additional format ready without touching metadata", async () => {
		const bookId = "test-book-additional-format";
		const db = getFirestore();
		await db.doc(`users/${TEST_USER_ID}/books/${bookId}`).set({
			title: "Existing Title",
			authorIds: [],
			publisherId: null,
			description: "Existing description",
			languages: ["ja"],
			identifiers: [],
			files: { epub: fileEntry("ready"), pdf: fileEntry("processing") },
			hasProcessingFile: true,
			hasCover: false,
			status: "ready",
			errorCode: null,
			createdAt: FieldValue.serverTimestamp(),
			updatedAt: FieldValue.serverTimestamp(),
		});

		await extractBookMetadata({
			userId: TEST_USER_ID,
			bookId,
			format: "pdf",
		});

		const bookSnap = await db
			.doc(`users/${TEST_USER_ID}/books/${bookId}`)
			.get();
		const book = bookSnap.data()!;

		expect(book.title).toBe("Existing Title");
		expect(book.description).toBe("Existing description");
		expect(book.languages).toEqual(["ja"]);
		expect(book.files.epub.status).toBe("ready");
		expect(book.files.pdf.status).toBe("ready");
		expect(book.hasProcessingFile).toBe(false);
	});

	it("reuses existing author instead of creating a duplicate", async () => {
		const db = getFirestore();

		// Pre-create an author
		const authorRef = await db.collection(`users/${TEST_USER_ID}/authors`).add({
			name: "Existing Author",
			sortName: null,
			bookCount: 1,
			createdAt: FieldValue.serverTimestamp(),
			updatedAt: FieldValue.serverTimestamp(),
		});

		const bookId = "test-book-reuse-author";
		const storagePath = `users/${TEST_USER_ID}/books/${bookId}/book.epub`;

		const epub = await buildEpub(
			`<dc:title>Another Book</dc:title>
			<dc:creator>Existing Author</dc:creator>
			<dc:language>en</dc:language>`,
		);

		await createStubBook(TEST_USER_ID, bookId);
		await uploadBuffer(storagePath, epub);

		await extractBookMetadata({
			userId: TEST_USER_ID,
			bookId,
			format: "epub",
		});

		const bookSnap = await db
			.doc(`users/${TEST_USER_ID}/books/${bookId}`)
			.get();
		const book = bookSnap.data()!;

		expect(book.authorIds).toEqual([authorRef.id]);

		// Should still be only one author document
		const authorsSnap = await db
			.collection(`users/${TEST_USER_ID}/authors`)
			.get();
		expect(authorsSnap.docs).toHaveLength(1);
	});
});
