/**
 * Script to seed the Firebase emulator with test user and sample books.
 * - Auth + books: Admin SDK (verified user; ready books that skip extraction)
 * - Authors/series/tags: Client SDK (as the authenticated user)
 * Automatically runs during `bun run dev` after emulators start.
 *
 * See docs/seeding.md for how seeding works and how to add a seeded book.
 * Metadata in the `books` array below is authoritative — nothing is extracted
 * from the epub.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import {
	AMAZON,
	ISBN,
	ISBN13,
} from "@calibre-web-serverless/domain/models/identifier";
import { Language } from "@calibre-web-serverless/domain/models/language";
import { createSeededBook } from "@calibre-web-serverless/infrastructure/admin/repositories/bookRepository";
import { authorRepository } from "@calibre-web-serverless/infrastructure/repositories/authorRepository";
import { bookRepository } from "@calibre-web-serverless/infrastructure/repositories/bookRepository";
import { seriesRepository } from "@calibre-web-serverless/infrastructure/repositories/seriesRepository";
import { tagRepository } from "@calibre-web-serverless/infrastructure/repositories/tagRepository";
import { authService } from "@calibre-web-serverless/infrastructure/services/authService";
import { initializeApp as initializeAdminApp } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";

const TEST_USER = {
	email: "test@example.com",
	password: "password123",
	displayName: "Test User",
};

interface BookSeed {
	title: string;
	sortTitle?: string;
	fixtureName: string;
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
		fixtureName: "alice-in-wonderland",
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
		fixtureName: "the-metamorphosis",
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
		fixtureName: "rashomon",
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
		fixtureName: "wagahai-wa-neko-de-aru",
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

	const adminApp = initializeAdminApp({
		projectId,
		storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
	});
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
	await authService.signIn(TEST_USER.email, TEST_USER.password);

	// Check if books already exist
	if (await bookRepository.hasBooks(userId)) {
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
		const author = await authorRepository.create(userId, name);
		authorMap.set(name, author.id);
		console.log(`[seed] Created author: ${name}`);
	}

	// Create series and build name->id map
	const seriesMap = new Map<string, string>();
	for (const name of allSeriesNames) {
		const series = await seriesRepository.create(userId, name);
		seriesMap.set(name, series.id);
		console.log(`[seed] Created series: ${name}`);
	}

	// Create tags and build name->id map
	const tagMap = new Map<string, string>();
	for (const name of allTagNames) {
		const tag = await tagRepository.create(userId, name);
		tagMap.set(name, tag.id);
		console.log(`[seed] Created tag: ${name}`);
	}

	// Seed each book as already "ready" via createSeededBook: the doc (with
	// metadata and a ready file entry) is written before the epub upload, so
	// the extraction function short-circuits — no processing to wait for.
	for (const book of books) {
		const filePath = path.join(
			import.meta.dirname,
			"..",
			"..",
			"fixtures",
			"books",
			book.fixtureName,
			"book.epub",
		);
		const fileBuffer = fs.readFileSync(filePath);

		// cover.png is pre-normalised by scripts/prepareCoverFixture.ts to what
		// the extractBookMetadata function would produce, so it uploads as-is.
		const coverPath = path.join(
			import.meta.dirname,
			"..",
			"..",
			"fixtures",
			"books",
			book.fixtureName,
			"cover.png",
		);
		const coverPng: Buffer | null = fs.existsSync(coverPath)
			? fs.readFileSync(coverPath)
			: null;

		await createSeededBook({
			userId,
			file: {
				data: fileBuffer,
				format: "epub",
				contentType: "application/epub+zip",
			},
			coverPng,
			book: {
				title: book.title,
				sortTitle: book.sortTitle ?? null,
				authorIds: book.authorNames.map((name) => authorMap.get(name)!),
				seriesId: book.seriesName
					? (seriesMap.get(book.seriesName) ?? null)
					: null,
				seriesIndex: book.seriesIndex ?? 1,
				tagIds: book.tagNames.map((name) => tagMap.get(name)!),
				publisherId: null,
				pubDate: book.pubDate ?? null,
				identifiers: book.identifiers ?? [],
				languages: book.languages,
				description: book.description ?? null,
				rating: book.rating ?? null,
				hasCover: coverPng !== null,
				hasCustomCover: false,
			},
		});

		console.log(`[seed] Created book: ${book.title}`);
	}
}

main()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error("[seed] Error:", err.message);
		process.exit(1);
	});
