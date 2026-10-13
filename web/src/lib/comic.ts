import { comicPagePaths } from "@calibre-web-serverless/domain/models/comicArchive";
import JSZip from "jszip";

export interface ComicPage {
	/** Blob URL of the page image. */
	url: string;
	/** Landscape page, i.e. a two-page spread scanned as one image. */
	wide: boolean;
}

/** A comic archive (CBZ) opened from its zip bytes. */
export interface ComicBook {
	pages: ComicPage[];
	/** Whether pages turn right to left, per isRightToLeft. */
	rightToLeft: boolean;
	/** Revokes the page blob URLs. */
	dispose(): void;
}

/**
 * Whether a comic reads right to left, from its ComicInfo.xml `Manga` field.
 * Only `Manga=No` (not a manga) reads left to right: this is a manga reader
 * first, so an archive that says nothing, or only `Yes`, defaults to RTL.
 */
export function isRightToLeft(comicInfoXml: string | null): boolean {
	if (comicInfoXml === null) return true;
	const manga = new DOMParser()
		.parseFromString(comicInfoXml, "application/xml")
		.getElementsByTagName("Manga")[0]
		?.textContent?.trim();
	return manga !== "No";
}

function isWide(url: string): Promise<boolean> {
	return new Promise((resolve, reject) => {
		const image = new Image();
		image.onload = () => resolve(image.naturalWidth > image.naturalHeight);
		image.onerror = () => reject(new Error("Invalid CBZ: unreadable page"));
		image.src = url;
	});
}

/** Rejects an archive without page images or with an unreadable one. */
export async function openComic(data: ArrayBuffer): Promise<ComicBook> {
	const zip = await JSZip.loadAsync(data);
	const paths = comicPagePaths(Object.keys(zip.files));
	if (paths.length === 0) {
		throw new Error("Invalid CBZ: no page images");
	}

	const comicInfoXml =
		(await zip.file(/^comicinfo\.xml$/i)[0]?.async("string")) ?? null;

	const urls = await Promise.all(
		paths.map(async (path) =>
			URL.createObjectURL(await zip.files[path].async("blob")),
		),
	);
	const dispose = () => {
		for (const url of urls) URL.revokeObjectURL(url);
	};
	// Spread pairing needs every page's orientation before the first spread
	// can be shown.
	try {
		const wide = await Promise.all(urls.map(isWide));
		return {
			pages: urls.map((url, i) => ({ url, wide: wide[i] })),
			rightToLeft: isRightToLeft(comicInfoXml),
			dispose,
		};
	} catch (error) {
		dispose();
		throw error;
	}
}
