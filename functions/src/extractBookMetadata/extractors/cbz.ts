import { comicPagePaths } from "@calibre-web-serverless/domain/models/comicArchive";
import { XMLParser } from "fast-xml-parser";
import JSZip from "jszip";
import type { ExtractedMetadata } from "./types";
import { textOf } from "./xmlUtils";

const parser = new XMLParser({ removeNSPrefix: true });

function parsePubDate(info: Record<string, unknown>): Date | null {
	const year = Number(textOf(info.Year));
	if (!Number.isInteger(year) || year <= 0) return null;
	const month = Number(textOf(info.Month)) || 1;
	const day = Number(textOf(info.Day)) || 1;
	return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Metadata of a comic archive. Fields come from the optional ComicInfo.xml
 * (the de-facto standard sidecar); the cover is the first page. Rejects an
 * archive without page images.
 */
export async function extractCbzMetadata(
	data: Buffer,
): Promise<ExtractedMetadata> {
	const zip = await JSZip.loadAsync(data);

	const [coverPath] = comicPagePaths(Object.keys(zip.files));
	if (!coverPath) {
		throw new Error("Invalid CBZ: no page images");
	}
	const coverImage = await zip.files[coverPath].async("nodebuffer");

	// ComicInfo.xml conventionally sits at the archive root, in any case.
	const comicInfoFile = zip.file(/^comicinfo\.xml$/i)[0];
	const info: Record<string, unknown> = comicInfoFile
		? (parser.parse(await comicInfoFile.async("string"))?.ComicInfo ?? {})
		: {};

	const seriesName = textOf(info.Series);
	const seriesIndex = Number(textOf(info.Number));

	return {
		title: textOf(info.Title),
		// Writer holds a comma-separated list of names.
		authors: (textOf(info.Writer) ?? "")
			.split(",")
			.map((name) => name.trim())
			.filter(Boolean),
		description: textOf(info.Summary),
		language: textOf(info.LanguageISO),
		publisher: textOf(info.Publisher),
		pubDate: parsePubDate(info),
		identifiers: [],
		series: seriesName
			? {
					name: seriesName,
					index:
						Number.isFinite(seriesIndex) && seriesIndex > 0 ? seriesIndex : 1,
				}
			: null,
		coverImage,
	};
}
