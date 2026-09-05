import { XMLBuilder } from "fast-xml-parser";
import { bookMimeType } from "./mime";

// OPDS 1.2 (Atom) feed serialization. Built with fast-xml-parser's XMLBuilder so
// element text and attribute values are entity-escaped automatically. All
// builders are pure functions of their input, so they unit-test without the
// emulator. Hrefs are root-relative ("/opds/...") which resolve correctly when
// the feed is served through Firebase Hosting's /opds rewrite.

const ATOM_NS = "http://www.w3.org/2005/Atom";
const OPDS_NS = "http://opds-spec.org/2010/catalog";
const DC_NS = "http://purl.org/dc/terms/";
const OS_NS = "http://a9.com/-/spec/opensearch/1.1/";

export const NAVIGATION_TYPE =
	"application/atom+xml;profile=opds-catalog;kind=navigation";
export const ACQUISITION_TYPE =
	"application/atom+xml;profile=opds-catalog;kind=acquisition";

const REL_ACQUISITION = "http://opds-spec.org/acquisition";
const REL_IMAGE = "http://opds-spec.org/image";
const REL_THUMBNAIL = "http://opds-spec.org/image/thumbnail";

// Covers are always stored and served as PNG.
const COVER_MIME = "image/png";

const builder = new XMLBuilder({
	ignoreAttributes: false,
	attributeNamePrefix: "@_",
	suppressEmptyNode: true,
	format: true,
	indentBy: "  ",
});

const XML_DECLARATION = { "@_version": "1.0", "@_encoding": "UTF-8" };

type XmlNode = Record<string, unknown>;

function linkNode(
	rel: string,
	href: string,
	type: string,
	extra: XmlNode = {},
): XmlNode {
	return { "@_rel": rel, "@_href": href, "@_type": type, ...extra };
}

// Atom requires a valid timestamp; books missing one fall back to the epoch.
function atomDate(date: Date | null): string {
	return (date ?? new Date(0)).toISOString();
}

/** One downloadable file of a book, projected for its acquisition link. */
export interface FeedEntryFile {
	format: string;
	fileSize: number;
}

/** A single book projected into the fields an acquisition entry needs. */
export interface FeedEntry {
	id: string;
	title: string;
	authors: string[];
	updated: Date | null;
	language: string | null;
	publisher: string | null;
	issued: Date | null;
	summary: string | null;
	categories: string[];
	/** Ready files; each becomes its own acquisition link. */
	files: FeedEntryFile[];
	hasCover: boolean;
}

export interface AcquisitionFeedParams {
	entries: FeedEntry[];
	/** 1-based page number. */
	page: number;
	itemsPerPage: number;
	totalResults: number;
	now: Date;
}

/** Root navigation feed: a single entry pointing at the full book catalog. */
export function buildNavigationFeed(now: Date): string {
	const updated = now.toISOString();
	return builder.build({
		"?xml": XML_DECLARATION,
		feed: {
			"@_xmlns": ATOM_NS,
			"@_xmlns:opds": OPDS_NS,
			id: "urn:calibre-web-serverless:opds:root",
			title: "Calibre-Web Serverless",
			updated,
			link: [
				linkNode("self", "/opds", NAVIGATION_TYPE),
				linkNode("start", "/opds", NAVIGATION_TYPE),
			],
			entry: {
				title: "All Books",
				id: "urn:calibre-web-serverless:opds:all-books",
				updated,
				content: { "@_type": "text", "#text": "Browse all books" },
				link: linkNode("subsection", "/opds/books", ACQUISITION_TYPE),
			},
		},
	});
}

function entryNode(entry: FeedEntry): XmlNode {
	const node: XmlNode = {
		title: entry.title,
		id: `urn:uuid:${entry.id}`,
		updated: atomDate(entry.updated),
	};
	if (entry.authors.length > 0) {
		node.author = entry.authors.map((name) => ({ name }));
	}
	if (entry.language) node["dc:language"] = entry.language;
	if (entry.publisher) node["dc:publisher"] = entry.publisher;
	if (entry.issued) node["dc:issued"] = entry.issued.toISOString();
	if (entry.categories.length > 0) {
		node.category = entry.categories.map((term) => ({ "@_term": term }));
	}
	if (entry.summary) {
		node.summary = { "@_type": "text", "#text": entry.summary };
	}

	const links: XmlNode[] = [];
	if (entry.hasCover) {
		links.push(linkNode(REL_IMAGE, `/opds/cover/${entry.id}`, COVER_MIME));
		links.push(
			linkNode(REL_THUMBNAIL, `/opds/cover/${entry.id}/thumbnail`, COVER_MIME),
		);
	}
	for (const file of entry.files) {
		links.push(
			linkNode(
				REL_ACQUISITION,
				`/opds/download/${entry.id}.${file.format}`,
				bookMimeType(file.format),
				{ "@_length": String(file.fileSize) },
			),
		);
	}
	node.link = links;
	return node;
}

/** Paginated acquisition feed listing books with download and cover links. */
export function buildAcquisitionFeed(params: AcquisitionFeedParams): string {
	const { entries, page, itemsPerPage, totalResults, now } = params;
	const totalPages = Math.max(1, Math.ceil(totalResults / itemsPerPage));
	const startIndex = (page - 1) * itemsPerPage + 1;

	const links = [
		linkNode("self", `/opds/books?page=${page}`, ACQUISITION_TYPE),
		linkNode("start", "/opds", NAVIGATION_TYPE),
		linkNode("first", "/opds/books?page=1", ACQUISITION_TYPE),
		linkNode("last", `/opds/books?page=${totalPages}`, ACQUISITION_TYPE),
	];
	if (page < totalPages) {
		links.push(
			linkNode("next", `/opds/books?page=${page + 1}`, ACQUISITION_TYPE),
		);
	}
	if (page > 1) {
		links.push(
			linkNode("previous", `/opds/books?page=${page - 1}`, ACQUISITION_TYPE),
		);
	}

	return builder.build({
		"?xml": XML_DECLARATION,
		feed: {
			"@_xmlns": ATOM_NS,
			"@_xmlns:opds": OPDS_NS,
			"@_xmlns:dc": DC_NS,
			"@_xmlns:opensearch": OS_NS,
			id: `urn:calibre-web-serverless:opds:books:page:${page}`,
			title: "All Books",
			updated: now.toISOString(),
			"opensearch:totalResults": totalResults,
			"opensearch:itemsPerPage": itemsPerPage,
			"opensearch:startIndex": startIndex,
			link: links,
			entry: entries.map(entryNode),
		},
	});
}
