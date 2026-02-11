import { XMLParser } from "fast-xml-parser";
import JSZip from "jszip";
import type { ExtractedMetadata } from "./types";
import { textOf, toArray } from "./xmlUtils";

const parser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: "@_",
	removeNSPrefix: true,
});

function parseContainerXml(xml: string): string {
	const parsed = parser.parse(xml);
	const rootfile = parsed?.container?.rootfiles?.rootfile;
	const first = Array.isArray(rootfile) ? rootfile[0] : rootfile;
	const fullPath = first?.["@_full-path"];
	if (!fullPath) {
		throw new Error("Invalid EPUB: no rootfile found");
	}
	return fullPath;
}

interface OpfMetadata {
	title: string | null;
	authors: string[];
	description: string | null;
	language: string | null;
	publisher: string | null;
	pubDate: Date | null;
	identifiers: Array<{ type: string; value: string }>;
	coverHref: string | null;
}

function parseOpfMetadata(xml: string): OpfMetadata {
	const parsed = parser.parse(xml);
	const metadata = parsed?.package?.metadata;

	const title = textOf(
		Array.isArray(metadata?.title) ? metadata.title[0] : metadata?.title,
	);

	const creators = toArray(metadata?.creator);
	const authors = creators
		.map((c) => textOf(c))
		.filter((a): a is string => a !== null);

	const description = textOf(
		Array.isArray(metadata?.description)
			? metadata.description[0]
			: metadata?.description,
	);

	const language = textOf(
		Array.isArray(metadata?.language)
			? metadata.language[0]
			: metadata?.language,
	);

	const publisher = textOf(
		Array.isArray(metadata?.publisher)
			? metadata.publisher[0]
			: metadata?.publisher,
	);

	const dateStr = textOf(
		Array.isArray(metadata?.date) ? metadata.date[0] : metadata?.date,
	);
	const pubDate = dateStr ? new Date(dateStr) : null;

	const rawIdentifiers = toArray(metadata?.identifier);
	const identifiers: Array<{ type: string; value: string }> = [];
	for (const id of rawIdentifiers) {
		const scheme =
			typeof id === "object"
				? (id as Record<string, unknown>)["@_scheme"]
				: undefined;
		const value = textOf(id);
		if (typeof scheme === "string" && scheme && value) {
			identifiers.push({ type: scheme.toLowerCase(), value });
		}
	}

	// Find cover image href
	const items = toArray(parsed?.package?.manifest?.item);
	let coverHref: string | null = null;

	// EPUB 2 style: <meta name="cover" content="<item-id>">
	const metas = toArray(metadata?.meta);
	const coverMeta = metas.find(
		(m) =>
			typeof m === "object" &&
			(m as Record<string, unknown>)["@_name"] === "cover",
	);
	if (coverMeta) {
		const coverId = (coverMeta as Record<string, unknown>)["@_content"];
		if (typeof coverId === "string") {
			const coverItem = items.find(
				(item) =>
					typeof item === "object" &&
					(item as Record<string, unknown>)["@_id"] === coverId,
			);
			if (coverItem) {
				coverHref =
					((coverItem as Record<string, unknown>)["@_href"] as string) ?? null;
			}
		}
	}

	// EPUB 3 style: manifest item with properties="cover-image"
	if (!coverHref) {
		const coverItem = items.find((item) => {
			if (typeof item !== "object") return false;
			const props = (item as Record<string, unknown>)["@_properties"];
			return (
				typeof props === "string" && props.split(/\s+/).includes("cover-image")
			);
		});
		if (coverItem) {
			coverHref =
				((coverItem as Record<string, unknown>)["@_href"] as string) ?? null;
		}
	}

	return {
		title,
		authors,
		description,
		language,
		publisher,
		pubDate: pubDate && !Number.isNaN(pubDate.getTime()) ? pubDate : null,
		identifiers,
		coverHref,
	};
}

export async function extractEpubMetadata(
	data: Buffer,
): Promise<ExtractedMetadata> {
	const zip = await JSZip.loadAsync(data);

	const containerFile = zip.file("META-INF/container.xml");
	if (!containerFile) {
		throw new Error("Invalid EPUB: missing container.xml");
	}
	const containerXml = await containerFile.async("string");
	const opfPath = parseContainerXml(containerXml);

	const opfDir = opfPath.includes("/")
		? `${opfPath.substring(0, opfPath.lastIndexOf("/"))}/`
		: "";

	const opfFile = zip.file(opfPath);
	if (!opfFile) {
		throw new Error(`Invalid EPUB: missing OPF file at ${opfPath}`);
	}
	const opfXml = await opfFile.async("string");
	const {
		title,
		authors,
		description,
		language,
		publisher,
		pubDate,
		identifiers,
		coverHref,
	} = parseOpfMetadata(opfXml);

	let coverImage: Buffer | null = null;
	if (coverHref) {
		const coverPath = opfDir + coverHref;
		const coverFile = zip.file(coverPath);
		if (coverFile) {
			const coverData = await coverFile.async("nodebuffer");
			coverImage = Buffer.from(coverData);
		}
	}

	return {
		title,
		authors,
		description,
		language,
		publisher,
		pubDate,
		identifiers,
		coverImage,
	};
}
