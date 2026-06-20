import type { Book } from "@calibre-web-serverless/domain/models/book";
import { hasAnyCover } from "@calibre-web-serverless/domain/repositories/bookCoverRepository";
import { authorRepository } from "@calibre-web-serverless/infrastructure/admin/repositories/authorRepository";
import { bookCoverRepository } from "@calibre-web-serverless/infrastructure/admin/repositories/bookCoverRepository";
import { bookRepository } from "@calibre-web-serverless/infrastructure/admin/repositories/bookRepository";
import { publisherRepository } from "@calibre-web-serverless/infrastructure/admin/repositories/publisherRepository";
import { tagRepository } from "@calibre-web-serverless/infrastructure/admin/repositories/tagRepository";
import { logger } from "firebase-functions/v2";
import {
	type HttpsFunction,
	onRequest,
	type Request,
} from "firebase-functions/v2/https";
import { parseBasicAuth, verifyCredentials } from "./auth";
import {
	ACQUISITION_TYPE,
	buildAcquisitionFeed,
	buildNavigationFeed,
	type FeedEntry,
	NAVIGATION_TYPE,
} from "./feed";
import { bookMimeType } from "./mime";

// The Express response type onRequest hands to its handler (not re-exported by
// firebase-functions), derived so we needn't depend on @types/express directly.
type Response = Parameters<HttpsFunction>[1];

// Covers are always stored and served as PNG.
const COVER_MIME = "image/png";

const ITEMS_PER_PAGE = 50;

// The Storage emulator can't sign URLs, so locally we send the bytes through the
// function. In deployed functions we hand the client a short-lived signed URL so
// bytes never pass through the function.
const USE_SIGNED_URL_REDIRECT = process.env.FUNCTIONS_EMULATOR !== "true";

const DOWNLOAD_PATH = /^\/download\/([^/]+)\.[^/.]+$/;
const COVER_PATH = /^\/cover\/([^/]+)(?:\/thumbnail)?$/;

function requireAuth(res: Response): void {
	res
		.set("WWW-Authenticate", 'Basic realm="OPDS", charset="UTF-8"')
		.status(401)
		.end();
}

// Through Firebase Hosting the path arrives as "/opds/...". When the function is
// hit directly (its own URL) the prefix is absent. Normalize both to a path
// relative to the catalog root ("/", "/books", "/download/...", "/cover/...").
function catalogPath(rawPath: string): string {
	const path = rawPath.startsWith("/opds")
		? rawPath.slice("/opds".length)
		: rawPath;
	return path === "" ? "/" : path;
}

function parsePage(value: unknown): number {
	const page =
		typeof value === "string" ? Number.parseInt(value, 10) : Number.NaN;
	return Number.isFinite(page) && page >= 1 ? page : 1;
}

function namesById<T extends { id: string; name: string }>(
	entities: T[],
): Map<string, string> {
	return new Map(entities.map((e) => [e.id, e.name]));
}

function toFeedEntry(
	book: Book,
	authors: Map<string, string>,
	publishers: Map<string, string>,
	tags: Map<string, string>,
): FeedEntry {
	return {
		id: book.id,
		title: book.title,
		authors: book.authorIds
			.map((id) => authors.get(id))
			.filter((name): name is string => name !== undefined),
		updated: book.updatedAt,
		language: book.languages[0]?.code ?? null,
		publisher: book.publisherId
			? (publishers.get(book.publisherId) ?? null)
			: null,
		issued: book.pubDate,
		summary: book.description,
		categories: book.tagIds
			.map((id) => tags.get(id))
			.filter((name): name is string => name !== undefined),
		format: book.format,
		fileSize: book.fileSize,
		hasCover: hasAnyCover(book),
	};
}

function sendFeed(res: Response, type: string, xml: string): void {
	res.set("Content-Type", `${type}; charset=utf-8`).status(200).send(xml);
}

async function deliverBook(
	res: Response,
	userId: string,
	book: Book,
): Promise<void> {
	if (USE_SIGNED_URL_REDIRECT) {
		res.redirect(
			302,
			await bookRepository.getBookDownloadUrl(userId, book.id, book.format),
		);
		return;
	}
	const buffer = await bookRepository.downloadBookFile(
		userId,
		book.id,
		book.format,
	);
	res.set("Content-Type", bookMimeType(book.format)).send(buffer);
}

async function deliverCover(
	res: Response,
	userId: string,
	book: Book,
): Promise<void> {
	if (USE_SIGNED_URL_REDIRECT) {
		res.redirect(
			302,
			await bookCoverRepository.getCoverUrl(userId, book.id, book),
		);
		return;
	}
	const buffer = await bookCoverRepository.downloadCover(userId, book.id, book);
	res.set("Content-Type", COVER_MIME).send(buffer);
}

async function handleBooks(
	res: Response,
	userId: string,
	page: number,
): Promise<void> {
	const offset = (page - 1) * ITEMS_PER_PAGE;
	const [total, books] = await Promise.all([
		bookRepository.countBooks(userId),
		bookRepository.searchBooks(userId, { offset, limit: ITEMS_PER_PAGE }),
	]);

	// Resolve only the authors/publishers/tags referenced on this page.
	const authorIds = [...new Set(books.flatMap((book) => book.authorIds))];
	const publisherIds = [
		...new Set(
			books.flatMap((book) => (book.publisherId ? [book.publisherId] : [])),
		),
	];
	const tagIds = [...new Set(books.flatMap((book) => book.tagIds))];
	const [authors, publishers, tags] = await Promise.all([
		authorRepository.findAuthorsByIds(userId, authorIds),
		publisherRepository.findPublishersByIds(userId, publisherIds),
		tagRepository.findTagsByIds(userId, tagIds),
	]);

	const authorNames = namesById(authors);
	const publisherNames = namesById(publishers);
	const tagNames = namesById(tags);
	const entries = books.map((book) =>
		toFeedEntry(book, authorNames, publisherNames, tagNames),
	);

	sendFeed(
		res,
		ACQUISITION_TYPE,
		buildAcquisitionFeed({
			entries,
			page,
			itemsPerPage: ITEMS_PER_PAGE,
			totalResults: total,
			now: new Date(),
		}),
	);
}

async function handleDownload(
	res: Response,
	userId: string,
	bookId: string,
): Promise<void> {
	const book = await bookRepository.getBook(userId, bookId);
	if (!book) {
		res.status(404).end();
		return;
	}
	await deliverBook(res, userId, book);
}

async function handleCover(
	res: Response,
	userId: string,
	bookId: string,
): Promise<void> {
	const book = await bookRepository.getBook(userId, bookId);
	if (!book || !hasAnyCover(book)) {
		res.status(404).end();
		return;
	}
	await deliverCover(res, userId, book);
}

async function route(
	req: Request,
	res: Response,
	userId: string,
): Promise<void> {
	const path = catalogPath(req.path);

	if (path === "/") {
		sendFeed(res, NAVIGATION_TYPE, buildNavigationFeed(new Date()));
		return;
	}
	if (path === "/books") {
		await handleBooks(res, userId, parsePage(req.query.page));
		return;
	}
	const download = path.match(DOWNLOAD_PATH);
	if (download) {
		await handleDownload(res, userId, download[1]);
		return;
	}
	const cover = path.match(COVER_PATH);
	if (cover) {
		await handleCover(res, userId, cover[1]);
		return;
	}
	res.status(404).end();
}

export const opdsFn = onRequest(async (req, res) => {
	if (req.method !== "GET" && req.method !== "HEAD") {
		res.set("Allow", "GET, HEAD").status(405).end();
		return;
	}

	const credentials = parseBasicAuth(req.headers.authorization);
	if (!credentials) {
		requireAuth(res);
		return;
	}

	const verdict = await verifyCredentials(credentials);
	if (!verdict.ok) {
		if (verdict.status === 429) res.status(429).end();
		else requireAuth(res);
		return;
	}

	try {
		await route(req, res, verdict.uid);
	} catch (err) {
		logger.error("OPDS request failed", { error: err });
		if (!res.headersSent) res.status(500).end();
	}
});
