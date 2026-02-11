import { inflateSync } from "node:zlib";
import { XMLParser } from "fast-xml-parser";
import type { ExtractedMetadata } from "./types";
import { textOf, toArray } from "./xmlUtils";

const xmlParser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: "@_",
	removeNSPrefix: true,
});

interface PdfFields {
	title: string | null;
	author: string | null;
	publisher: string | null;
	description: string | null;
	language: string | null;
	pubDate: Date | null;
}

function emptyFields(): PdfFields {
	return {
		title: null,
		author: null,
		publisher: null,
		description: null,
		language: null,
		pubDate: null,
	};
}

/**
 * XMP can carry richer metadata than the Info dictionary: multiple authors
 * (dc:creator) and typed identifiers (dc:identifier), so it has its own shape.
 */
interface XmpMetadata {
	title: string | null;
	authors: string[];
	publisher: string | null;
	description: string | null;
	language: string | null;
	pubDate: Date | null;
	identifiers: Array<{ type: string; value: string }>;
}

function emptyXmp(): XmpMetadata {
	return {
		title: null,
		authors: [],
		publisher: null,
		description: null,
		language: null,
		pubDate: null,
		identifiers: [],
	};
}

/**
 * Extract metadata from a PDF file.
 *
 * Supports three metadata storage methods:
 * 1. Uncompressed Info dictionary (`/Title (value)` or `/Title <hex>`)
 * 2. Info dictionary inside a FlateDecode-compressed stream (e.g. when packed
 *    into an object stream)
 * 3. XMP metadata (`<x:xmpmeta>` XML stream)
 *
 * Priority: Info dict > compressed streams > XMP (XMP fills gaps).
 * Cover image extraction is not supported for PDF.
 */
export async function extractPdfMetadata(
	data: Buffer,
): Promise<ExtractedMetadata> {
	const text = data.toString("latin1");

	const infoDict = extractInfoDict(text);
	const xmp = extractXmpMetadata(text);

	// Compressed streams only contribute fields the Info dict lacks (priority is
	// infoDict > compressedStreams > xmp), so skip the expensive whole-file
	// decompression when the Info dict already covers every field it could
	// provide.
	const needsCompressedStreams =
		infoDict.title === null ||
		infoDict.author === null ||
		infoDict.publisher === null ||
		infoDict.pubDate === null;
	const compressedStreams = needsCompressedStreams
		? extractFromCompressedStreams(text)
		: emptyFields();

	// Merge with priority: infoDict > compressedStreams > xmp
	const title = infoDict.title ?? compressedStreams.title ?? xmp.title;
	// The Info dict holds a single /Author string; multiple authors only come
	// from XMP's dc:creator, so fall back to the XMP array as a whole.
	const authors = infoDict.author
		? [infoDict.author]
		: compressedStreams.author
			? [compressedStreams.author]
			: xmp.authors;
	const publisher =
		infoDict.publisher ?? compressedStreams.publisher ?? xmp.publisher;
	const description =
		infoDict.description ?? compressedStreams.description ?? xmp.description;
	const language =
		infoDict.language ?? compressedStreams.language ?? xmp.language;
	const pubDate = infoDict.pubDate ?? compressedStreams.pubDate ?? xmp.pubDate;

	return {
		title,
		authors,
		description,
		language,
		publisher,
		pubDate,
		// Only XMP carries typed identifiers; the Info dict has no such field.
		identifiers: xmp.identifiers,
		coverImage: null,
	};
}

function extractInfoDict(text: string): PdfFields {
	// Restrict extraction to the trailer's /Info object when present, so we
	// don't pick up a stray /Title from a content stream or annotation.
	const scope = findInfoDictScope(text) ?? text;

	const title = extractPdfInfo(scope, "Title");
	const author = extractPdfInfo(scope, "Author");
	const publisher = extractPdfInfo(scope, "Publisher");
	const dateStr = extractPdfInfo(scope, "CreationDate");

	return {
		title,
		author,
		publisher,
		description: null,
		language: null,
		pubDate: parsePdfDate(dateStr),
	};
}

/**
 * Resolve the trailer's `/Info N 0 R` reference to the body of `N 0 obj ... endobj`.
 * Returns null when there is no Info reference or the object is not in plain text
 * (e.g. stored inside a compressed object stream), so callers fall back to a
 * whole-file scan.
 */
function findInfoDictScope(text: string): string | null {
	const ref = text.match(/\/Info\s+(\d+)\s+\d+\s+R/);
	if (!ref) return null;

	const objectPattern = new RegExp(
		`(?:^|[^0-9])${ref[1]}\\s+\\d+\\s+obj\\b([\\s\\S]*?)endobj`,
	);
	const matches = text.match(objectPattern);
	return matches ? matches[1] : null;
}

function extractFromCompressedStreams(text: string): PdfFields {
	const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;

	const result: PdfFields = {
		title: null,
		author: null,
		publisher: null,
		description: null,
		language: null,
		pubDate: null,
	};

	for (const match of text.matchAll(streamRegex)) {
		const streamData = Buffer.from(match[1], "latin1");
		let decompressed: string;
		try {
			decompressed = inflateSync(streamData).toString("latin1");
		} catch {
			continue;
		}

		if (!result.title) result.title = extractPdfInfo(decompressed, "Title");
		if (!result.author) result.author = extractPdfInfo(decompressed, "Author");
		if (!result.publisher)
			result.publisher = extractPdfInfo(decompressed, "Publisher");
		if (!result.pubDate) {
			const dateStr = extractPdfInfo(decompressed, "CreationDate");
			result.pubDate = parsePdfDate(dateStr);
		}
	}

	return result;
}

function extractXmpMetadata(text: string): XmpMetadata {
	const xmpMatch = text.match(/<x:xmpmeta[\s\S]*?<\/x:xmpmeta>/);
	if (!xmpMatch) return emptyXmp();

	const parsed = xmlParser.parse(xmpMatch[0]);
	// XMP properties are commonly split across several rdf:Description elements
	// (one per namespace), so merge across all of them rather than assuming one.
	const descriptions = toArray(parsed?.xmpmeta?.RDF?.Description).filter(
		(d): d is Record<string, unknown> => typeof d === "object" && d !== null,
	);
	if (descriptions.length === 0) return emptyXmp();

	const result = emptyXmp();
	for (const desc of descriptions) {
		result.title ??= extractRdfValue(desc.title);
		result.publisher ??= extractRdfValue(desc.publisher);
		result.description ??= extractRdfValue(desc.description);
		result.language ??= extractRdfValue(desc.language);
		if (result.authors.length === 0) {
			result.authors = extractRdfValues(desc.creator);
		}
		result.pubDate ??= parsePdfDate(textOf(desc.CreateDate));
		for (const raw of extractRdfValues(desc.identifier)) {
			const id = parseXmpIdentifier(raw);
			if (id) result.identifiers.push(id);
		}
	}

	return result;
}

/** Extract all text values from an RDF container (rdf:Alt/Seq/Bag) or plain value. */
function extractRdfValues(value: unknown): string[] {
	if (value === undefined || value === null) return [];

	if (typeof value === "object") {
		const object = value as Record<string, unknown>;
		// rdf:Alt, rdf:Seq, rdf:Bag all contain rdf:li items
		for (const container of ["Alt", "Seq", "Bag"]) {
			if (object[container]) {
				const li = (object[container] as Record<string, unknown>).li;
				return toArray(li)
					.map(textOf)
					.filter((v): v is string => v !== null);
			}
		}
	}

	const single = textOf(value);
	return single ? [single] : [];
}

/** Extract the first text value from an RDF container or plain value. */
function extractRdfValue(value: unknown): string | null {
	return extractRdfValues(value)[0] ?? null;
}

/**
 * Parse an XMP dc:identifier into a typed identifier. Accepts the common URN /
 * prefixed forms ("urn:isbn:9780000000001", "isbn:9780000000001"); a bare value
 * with no recognizable scheme is dropped since it cannot be typed.
 */
function parseXmpIdentifier(
	raw: string,
): { type: string; value: string } | null {
	const match = raw.match(/^(?:urn:)?([a-z0-9]+)[:\s]+(.+)$/i);
	if (!match) return null;
	return { type: match[1].toLowerCase(), value: match[2].trim() };
}

function parsePdfDate(dateStr: string | null): Date | null {
	if (!dateStr) return null;

	// PDF date format: D:YYYYMMDDHHmmSS...
	const pdfMatch = dateStr.match(/D:(\d{4})(\d{2})?(\d{2})?/);
	if (pdfMatch) {
		const year = pdfMatch[1];
		const month = pdfMatch[2] || "01";
		const day = pdfMatch[3] || "01";
		const date = new Date(`${year}-${month}-${day}`);
		return Number.isNaN(date.getTime()) ? null : date;
	}

	// ISO 8601 format (used by XMP): 2023-06-15T10:30:00Z
	const isoDate = new Date(dateStr);
	if (!Number.isNaN(isoDate.getTime())) {
		// Normalize to date-only (YYYY-MM-DD) for consistency
		const y = isoDate.getUTCFullYear();
		const m = String(isoDate.getUTCMonth() + 1).padStart(2, "0");
		const d = String(isoDate.getUTCDate()).padStart(2, "0");
		return new Date(`${y}-${m}-${d}`);
	}

	return null;
}

function extractPdfInfo(text: string, key: string): string | null {
	// Look for /Key (value) or /Key <hex>. The body allows escaped parens
	// (e.g. "\(1838-1875\)") so we match escape sequences and any non-backslash,
	// non-paren character rather than stopping at the first ")".
	const parenPattern = new RegExp(
		`/${key}\\s*\\(((?:\\\\.|[^\\\\)])*)\\)`,
		"i",
	);
	const parenMatch = text.match(parenPattern);
	if (parenMatch) {
		return decodeParenString(parenMatch[1]) || null;
	}

	// Look for /Key <FEFF...> (UTF-16BE hex encoded)
	const hexPattern = new RegExp(`/${key}\\s*<([^>]*)>`, "i");
	const hexMatch = text.match(hexPattern);
	if (hexMatch) {
		return decodeHexString(hexMatch[1]) || null;
	}

	return null;
}

function decodeParenString(s: string): string {
	return s
		.replace(/\\n/g, "\n")
		.replace(/\\r/g, "\r")
		.replace(/\\t/g, "\t")
		.replace(/\\\\/g, "\\")
		.replace(/\\(.)/g, "$1");
}

function decodeHexString(hex: string): string {
	const cleaned = hex.replace(/\s/g, "");
	// Check for UTF-16BE BOM (FEFF)
	if (cleaned.startsWith("FEFF") || cleaned.startsWith("feff")) {
		const bytes = [];
		for (let i = 4; i < cleaned.length; i += 4) {
			const code = Number.parseInt(cleaned.substring(i, i + 4), 16);
			bytes.push(code);
		}
		return String.fromCharCode(...bytes);
	}
	// Plain hex
	const bytes = [];
	for (let i = 0; i < cleaned.length; i += 2) {
		bytes.push(Number.parseInt(cleaned.substring(i, i + 2), 16));
	}
	return String.fromCharCode(...bytes);
}
