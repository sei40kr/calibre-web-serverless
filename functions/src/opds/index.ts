import type { Book } from "@calibre-web-serverless/domain/models/book";
import {
	type BookFileFormat,
	readyFiles,
} from "@calibre-web-serverless/domain/models/bookFile";
import { hasAnyCover } from "@calibre-web-serverless/domain/repositories/bookCoverRepository";
import { authorRepository } from "@calibre-web-serverless/infrastructure/admin/repositories/authorRepository";
import { bookCoverRepository } from "@calibre-web-serverless/infrastructure/admin/repositories/bookCoverRepository";
import { bookFileRepository } from "@calibre-web-serverless/infrastructure/admin/repositories/bookFileRepository";
import { bookRepository } from "@calibre-web-serverless/infrastructure/admin/repositories/bookRepository";
import { bookshelfRepository } from "@calibre-web-serverless/infrastructure/admin/repositories/bookshelfRepository";
import { opdsAccessTokenRepository } from "@calibre-web-serverless/infrastructure/admin/repositories/opdsAccessTokenRepository";
import { publisherRepository } from "@calibre-web-serverless/infrastructure/admin/repositories/publisherRepository";
import { tagRepository } from "@calibre-web-serverless/infrastructure/admin/repositories/tagRepository";
import { logger } from "firebase-functions/v2";
import {
	type HttpsFunction,
	onRequest,
	type Request,
} from "firebase-functions/v2/https";
import {
	AUTH_DOCUMENT_PATH,
	AUTH_DOCUMENT_REL,
	AUTH_DOCUMENT_TYPE,
	buildAuthenticationDocument,
	parseBearerToken,
} from "./auth";
import {
	ACQUISITION_TYPE,
	type AcquisitionSource,
	ALL_BOOKS_SOURCE,
	bookshelfSource,
	buildAcquisitionFeed,
	buildBookshelvesFeed,
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

const DOWNLOAD_PATH = /^\/download\/([^/]+)\.([^/.]+)$/;
const COVER_PATH = /^\/cover\/([^/]+)(?:\/thumbnail)?$/;
const BOOKSHELF_PATH = /^\/bookshelves\/([^/]+)$/;
// AUTH_DOCUMENT_PATH relative to the catalog root.
const AUTH_DOCUMENT_CATALOG_PATH = "/auth";

// The origin the client reached the catalog on. Through Firebase Hosting the
// function sees its own host, and the public one arrives as X-Forwarded-Host.
function publicOrigin(req: Request): string {
	const first = (name: string) =>
		req.get(name)?.split(",")[0]?.trim() || undefined;
	const host = first("x-forwarded-host") ?? req.get("host");
	const proto = first("x-forwarded-proto") ?? req.protocol;
	return `${proto}://${host}`;
}

function sendAuthenticationDocument(
	req: Request,
	res: Response,
	status: 200 | 401,
	invalidToken = false,
): void {
	const origin = publicOrigin(req);
	if (status === 401) {
		// RFC 6750 §3: a request that carried a token learns it was rejected.
		res.set(
			"WWW-Authenticate",
			invalidToken
				? 'Bearer realm="OPDS", error="invalid_token"'
				: 'Bearer realm="OPDS"',
		);
	}
	res
		.set(
			"Link",
			`<${origin}${AUTH_DOCUMENT_PATH}>; rel="${AUTH_DOCUMENT_REL}"; type="${AUTH_DOCUMENT_TYPE}"`,
		)
		.set("Content-Type", `${AUTH_DOCUMENT_TYPE}; charset=utf-8`)
		.set("Cache-Control", "no-store")
		.status(status)
		.send(JSON.stringify(buildAuthenticationDocument(origin)));
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
		files: readyFiles(book.files).map((file) => ({
			format: file.format,
			fileSize: file.fileSize,
		})),
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
	format: BookFileFormat,
): Promise<void> {
	if (USE_SIGNED_URL_REDIRECT) {
		res.redirect(
			302,
			await bookFileRepository.getBookFileDownloadUrl(userId, book.id, format),
		);
		return;
	}
	const buffer = await bookFileRepository.downloadBookFile(
		userId,
		book.id,
		format,
	);
	res.set("Content-Type", bookMimeType(format)).send(buffer);
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

// One page of the library — or of one bookshelf, when `bookshelfId` is given — as an
// acquisition feed.
async function handleBooks(
	res: Response,
	userId: string,
	page: number,
	source: AcquisitionSource = ALL_BOOKS_SOURCE,
	bookshelfId?: string,
): Promise<void> {
	const offset = (page - 1) * ITEMS_PER_PAGE;
	const [total, books] = await Promise.all([
		bookRepository.countBooks(userId, { bookshelfId }),
		bookRepository.searchBooks(userId, {
			offset,
			limit: ITEMS_PER_PAGE,
			bookshelfId,
		}),
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
			source,
		}),
	);
}

async function handleBookshelves(res: Response, userId: string): Promise<void> {
	const bookshelves = await bookshelfRepository.listBookshelves(userId);
	sendFeed(
		res,
		NAVIGATION_TYPE,
		buildBookshelvesFeed(
			bookshelves.map((bookshelf) => ({
				id: bookshelf.id,
				name: bookshelf.name,
				bookCount: bookshelf.bookCount,
				updated: bookshelf.updatedAt,
			})),
			new Date(),
		),
	);
}

async function handleBookshelf(
	res: Response,
	userId: string,
	bookshelfId: string,
	page: number,
): Promise<void> {
	const bookshelf = await bookshelfRepository.getBookshelf(userId, bookshelfId);
	if (!bookshelf) {
		res.status(404).end();
		return;
	}
	await handleBooks(
		res,
		userId,
		page,
		bookshelfSource(bookshelf),
		bookshelf.id,
	);
}

async function handleDownload(
	res: Response,
	userId: string,
	bookId: string,
	extension: string,
): Promise<void> {
	const book = await bookRepository.getBook(userId, bookId);
	if (!book) {
		res.status(404).end();
		return;
	}
	const file = readyFiles(book.files).find(
		(candidate) => candidate.format === extension.toLowerCase(),
	);
	if (!file) {
		res.status(404).end();
		return;
	}
	await deliverBook(res, userId, book, file.format);
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
	if (path === "/bookshelves") {
		await handleBookshelves(res, userId);
		return;
	}
	const bookshelf = path.match(BOOKSHELF_PATH);
	if (bookshelf) {
		await handleBookshelf(res, userId, bookshelf[1], parsePage(req.query.page));
		return;
	}
	const download = path.match(DOWNLOAD_PATH);
	if (download) {
		await handleDownload(res, userId, download[1], download[2]);
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

	// The spec requires the Authentication Document itself to be public.
	if (catalogPath(req.path) === AUTH_DOCUMENT_CATALOG_PATH) {
		sendAuthenticationDocument(req, res, 200);
		return;
	}

	const token = parseBearerToken(req.headers.authorization);
	if (!token) {
		sendAuthenticationDocument(req, res, 401);
		return;
	}

	let userId: string | null;
	try {
		userId = await opdsAccessTokenRepository.resolveUserId(token);
	} catch (err) {
		logger.error("OPDS token verification failed", { error: err });
		res.status(500).end();
		return;
	}
	if (!userId) {
		sendAuthenticationDocument(req, res, 401, true);
		return;
	}

	try {
		await route(req, res, userId);
	} catch (err) {
		logger.error("OPDS request failed", { error: err });
		if (!res.headersSent) res.status(500).end();
	}
});
