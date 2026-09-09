import { readFileSync } from "node:fs";
import {
	assertFails,
	assertSucceeds,
	initializeTestEnvironment,
	type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { deleteObject, getBytes, ref, uploadBytes } from "firebase/storage";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

const OWNER = "owner-uid";
const OTHER = "other-uid";

const bookDir = (userId: string) => `users/${userId}/books/book-1`;

const bytes = new Uint8Array([1, 2, 3, 4]);

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
	testEnv = await initializeTestEnvironment({
		projectId: "demo-storage-rules",
		storage: {
			rules: readFileSync(
				new URL("../../storage.rules", import.meta.url),
				"utf8",
			),
			host: "127.0.0.1",
			port: 9199,
		},
	});
});

beforeEach(() => testEnv.clearStorage());

afterAll(() => testEnv.cleanup());

/** Puts an object in place the way a Cloud Function would, bypassing rules. */
const seedObject = (path: string, contentType: string) =>
	testEnv.withSecurityRulesDisabled(async (context) => {
		await uploadBytes(ref(context.storage(), path), bytes, { contentType });
	});

describe("uploads a client is expected to make", () => {
	it("accepts a book file in a known format", async () => {
		const storage = testEnv.authenticatedContext(OWNER).storage();

		await assertSucceeds(
			uploadBytes(ref(storage, `${bookDir(OWNER)}/book.epub`), bytes, {
				contentType: "application/epub+zip",
			}),
		);
	});

	it("accepts a staged cover upload", async () => {
		const storage = testEnv.authenticatedContext(OWNER).storage();

		await assertSucceeds(
			uploadBytes(ref(storage, `${bookDir(OWNER)}/cover_upload.png`), bytes, {
				contentType: "image/png",
			}),
		);
	});
});

// cover.png and custom_cover.png are written by resizeBookCover through the
// admin SDK. A client write to either would be bytes that never went through
// the resize, served from the path a cover is read from.
describe("uploads that would bypass the cover pipeline", () => {
	it("rejects writing the extracted cover directly", async () => {
		const storage = testEnv.authenticatedContext(OWNER).storage();

		await assertFails(
			uploadBytes(ref(storage, `${bookDir(OWNER)}/cover.png`), bytes, {
				contentType: "image/png",
			}),
		);
	});

	it("rejects writing the custom cover directly", async () => {
		const storage = testEnv.authenticatedContext(OWNER).storage();

		await assertFails(
			uploadBytes(ref(storage, `${bookDir(OWNER)}/custom_cover.png`), bytes, {
				contentType: "image/png",
			}),
		);
	});

	it("rejects a cover upload that is not an accepted image type", async () => {
		const storage = testEnv.authenticatedContext(OWNER).storage();

		await assertFails(
			uploadBytes(ref(storage, `${bookDir(OWNER)}/cover_upload.png`), bytes, {
				contentType: "text/html",
			}),
		);
	});

	it("rejects an unknown book format", async () => {
		const storage = testEnv.authenticatedContext(OWNER).storage();

		await assertFails(
			uploadBytes(ref(storage, `${bookDir(OWNER)}/book.exe`), bytes, {
				contentType: "application/octet-stream",
			}),
		);
	});

	it("rejects an arbitrary file name", async () => {
		const storage = testEnv.authenticatedContext(OWNER).storage();

		await assertFails(
			uploadBytes(ref(storage, `${bookDir(OWNER)}/notes.txt`), bytes, {
				contentType: "text/plain",
			}),
		);
	});
});

describe("deletes", () => {
	// Removing a book deletes its covers, and resetting a custom cover deletes
	// custom_cover.png — neither of which the client may write.
	it("lets the owner remove a server-written cover", async () => {
		await seedObject(`${bookDir(OWNER)}/cover.png`, "image/png");
		const storage = testEnv.authenticatedContext(OWNER).storage();

		await assertSucceeds(
			deleteObject(ref(storage, `${bookDir(OWNER)}/cover.png`)),
		);
	});
});

describe("other users", () => {
	beforeEach(() =>
		seedObject(`${bookDir(OWNER)}/book.epub`, "application/epub+zip"),
	);

	it("cannot read another user's book file", async () => {
		const storage = testEnv.authenticatedContext(OTHER).storage();

		await assertFails(getBytes(ref(storage, `${bookDir(OWNER)}/book.epub`)));
	});

	it("cannot overwrite another user's book file", async () => {
		const storage = testEnv.authenticatedContext(OTHER).storage();

		await assertFails(
			uploadBytes(ref(storage, `${bookDir(OWNER)}/book.epub`), bytes, {
				contentType: "application/epub+zip",
			}),
		);
	});

	it("cannot delete another user's book file", async () => {
		const storage = testEnv.authenticatedContext(OTHER).storage();

		await assertFails(
			deleteObject(ref(storage, `${bookDir(OWNER)}/book.epub`)),
		);
	});

	it("cannot read a book file while signed out", async () => {
		const storage = testEnv.unauthenticatedContext().storage();

		await assertFails(getBytes(ref(storage, `${bookDir(OWNER)}/book.epub`)));
	});

	it("lets the owner read their own book file", async () => {
		const storage = testEnv.authenticatedContext(OWNER).storage();

		await assertSucceeds(getBytes(ref(storage, `${bookDir(OWNER)}/book.epub`)));
	});
});
