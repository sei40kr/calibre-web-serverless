/**
 * Script to seed the Firebase emulator with test user and sample books.
 * - Auth: Admin SDK (to create user with emailVerified: true)
 * - Firestore/Storage: Client SDK via bookService (as authenticated user)
 * Automatically runs during `bun run dev` after emulators start.
 *
 * Note: FIREBASE_AUTH_EMULATOR_HOST must be set before process starts (see package.json)
 */

// Load .env.local for NEXT_PUBLIC_* environment variables
import * as fs from "node:fs";
import * as path from "node:path";
import { signInWithEmailAndPassword } from "firebase/auth";
import { initializeApp as initializeAdminApp } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { auth } from "@/lib/firebase";
import type { Book } from "@/models/book";
import { AMAZON, ISBN, ISBN13 } from "@/models/identifier";
import { Language } from "@/models/language";
import { createAuthor } from "@/services/authorService";
import { hasBooks, updateBook, uploadBook } from "@/services/bookService";
import { createSeries } from "@/services/seriesService";
import { createTag } from "@/services/tagService";

const TEST_USER = {
	email: "test@example.com",
	password: "password123",
	displayName: "Test User",
};

interface BookSeed {
	title: string;
	sortTitle?: string;
	filename: string;
	authorNames: string[];
	seriesName?: string;
	seriesIndex?: number;
	tagNames: string[];
	publisher?: string;
	pubDate?: Date;
	languages: Language[];
	description?: string;
	rating?: number;
	identifiers?: {
		type: typeof ISBN | typeof ISBN13 | typeof AMAZON;
		value: string;
	}[];
}

const books: BookSeed[] = [
	{
		title: "Alice's Adventures in Wonderland",
		filename: "alice-in-wonderland.epub",
		authorNames: ["Lewis Carroll"],
		tagNames: ["Fantasy", "Classic", "Children"],
		publisher: "Macmillan",
		pubDate: new Date("1865-11-26"),
		languages: [Language.EN],
		description:
			"A young girl named Alice falls through a rabbit hole into a subterranean fantasy world populated by peculiar creatures.",
		rating: 5,
		identifiers: [
			{ type: ISBN13, value: "9780141439761" },
			{ type: AMAZON, value: "0141439769" },
		],
	},
	{
		title: "The Metamorphosis",
		sortTitle: "Metamorphosis, The",
		filename: "the-metamorphosis.epub",
		authorNames: ["Franz Kafka"],
		tagNames: ["Fiction", "Classic", "Absurdist"],
		publisher: "Kurt Wolff Verlag",
		pubDate: new Date("1915-01-01"),
		languages: [Language.DE, Language.EN],
		description:
			"The story of Gregor Samsa, a traveling salesman who wakes one morning to find himself transformed into a giant insect.",
		rating: 4,
		identifiers: [{ type: ISBN, value: "0553213695" }],
	},
	{
		title: "Rashomon",
		filename: "rashomon.epub",
		authorNames: ["Ryunosuke Akutagawa"],
		tagNames: ["Fiction", "Japanese Literature", "Short Stories"],
		publisher: "Tuttle Publishing",
		pubDate: new Date("1915-01-01"),
		languages: [Language.JA, Language.EN],
		description:
			"A collection of short stories including the famous tale set at the Rashomon gate in Kyoto.",
		rating: 4,
	},
	{
		title: "I Am a Cat",
		sortTitle: "I Am a Cat",
		filename: "wagahai-wa-neko-de-aru.epub",
		authorNames: ["Natsume Soseki"],
		seriesName: "Japanese Literature Classics",
		seriesIndex: 1,
		tagNames: ["Fiction", "Japanese Literature", "Satire", "Classic"],
		publisher: "Tuttle Publishing",
		pubDate: new Date("1905-01-01"),
		languages: [Language.JA],
		description:
			"A satirical novel told from the perspective of a cat observing the follies of human behavior in Meiji-era Japan.",
		rating: 5,
		identifiers: [{ type: ISBN13, value: "9784805311868" }],
	},
];

async function main() {
	const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

	const adminApp = initializeAdminApp({ projectId });
	const adminAuth = getAdminAuth(adminApp);

	// Create user with Admin SDK (emailVerified: true)
	let userId: string;
	try {
		const user = await adminAuth.getUserByEmail(TEST_USER.email);
		userId = user.uid;
	} catch (error: unknown) {
		if (
			error &&
			typeof error === "object" &&
			"code" in error &&
			error.code === "auth/user-not-found"
		) {
			const user = await adminAuth.createUser({
				email: TEST_USER.email,
				password: TEST_USER.password,
				displayName: TEST_USER.displayName,
				emailVerified: true,
			});
			console.log(`[seed] Created user: ${TEST_USER.email}`);
			userId = user.uid;
		} else {
			throw error;
		}
	}

	// Sign in with Client SDK
	await signInWithEmailAndPassword(auth, TEST_USER.email, TEST_USER.password);

	// Check if books already exist
	if (await hasBooks(userId)) {
		return;
	}

	// Collect all unique author names, series names, and tag names
	const allAuthorNames = [...new Set(books.flatMap((b) => b.authorNames))];
	const allSeriesNames = [
		...new Set(books.map((b) => b.seriesName).filter(Boolean)),
	] as string[];
	const allTagNames = [...new Set(books.flatMap((b) => b.tagNames))];

	// Create authors and build name->id map
	const authorMap = new Map<string, string>();
	for (const name of allAuthorNames) {
		const author = await createAuthor(userId, name);
		authorMap.set(name, author.id);
		console.log(`[seed] Created author: ${name}`);
	}

	// Create series and build name->id map
	const seriesMap = new Map<string, string>();
	for (const name of allSeriesNames) {
		const series = await createSeries(userId, name);
		seriesMap.set(name, series.id);
		console.log(`[seed] Created series: ${name}`);
	}

	// Create tags and build name->id map
	const tagMap = new Map<string, string>();
	for (const name of allTagNames) {
		const tag = await createTag(userId, name);
		tagMap.set(name, tag.id);
		console.log(`[seed] Created tag: ${name}`);
	}

	// Upload books and update with metadata
	for (const book of books) {
		const filePath = path.join(process.cwd(), "e2e", "fixtures", book.filename);
		const fileBuffer = fs.readFileSync(filePath);
		const file = new File([fileBuffer], book.filename, {
			type: "application/epub+zip",
		});

		const { bookId, format } = await uploadBook({
			userId,
			title: book.title,
			file,
		});

		// Convert names to IDs
		const authorIds = book.authorNames.map((name) => authorMap.get(name)!);
		const seriesId = book.seriesName
			? seriesMap.get(book.seriesName)
			: undefined;
		const tagIds = book.tagNames.map((name) => tagMap.get(name)!);

		// Update book with full metadata
		const now = new Date();
		const updatedBook: Book = {
			id: bookId,
			title: book.title,
			sortTitle: book.sortTitle ?? null,
			authorIds,
			seriesId: seriesId ?? null,
			seriesIndex: book.seriesIndex ?? 1,
			tagIds,
			publisherId: null,
			pubDate: book.pubDate ?? null,
			identifiers: book.identifiers ?? [],
			languages: book.languages,
			description: book.description ?? null,
			rating: book.rating ?? null,
			format,
			fileSize: fileBuffer.byteLength,
			coverFormat: null,
			createdAt: now,
			updatedAt: now,
		};
		await updateBook(userId, updatedBook);

		console.log(`[seed] Created book: ${book.title}`);
	}
}

main()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error("[seed] Error:", err.message);
		process.exit(1);
	});
