import JSZip from "jszip";

/**
 * A parsed EPUB, opened from its zip bytes. Chapters are the linear spine
 * items; loading one returns a self-contained XHTML string whose stylesheet,
 * image and font references have been rewritten to blob URLs, so it can be
 * rendered in a sandboxed iframe via `srcDoc`.
 */
export interface EpubBook {
	/**
	 * Page-turn direction from the spine. Japanese vertical-writing books
	 * declare "rtl": the next page is to the left.
	 */
	pageProgression: "ltr" | "rtl";
	chapterCount: number;
	/** Returns the rewritten XHTML of the 0-based linear spine item. */
	loadChapter(chapterIndex: number): Promise<string>;
	/** Revokes every blob URL handed out by loadChapter. */
	dispose(): void;
}

const MEDIA_TYPES_BY_EXTENSION: Record<string, string> = {
	css: "text/css",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	png: "image/png",
	gif: "image/gif",
	svg: "image/svg+xml",
	webp: "image/webp",
	otf: "font/otf",
	ttf: "font/ttf",
	woff: "font/woff",
	woff2: "font/woff2",
};

/** Matches `@import "..."` and `url(...)` references in CSS text. */
const CSS_REFERENCE_PATTERN =
	/@import\s+(['"])([^'"]+)\1|url\(\s*(['"]?)([^'")]+?)\3\s*\)/g;

/** Absolute URLs (http:, data:, …) and fragments are left untouched. */
function isExternalReference(href: string): boolean {
	return href.startsWith("#") || /^[a-z][a-z0-9+.-]*:/i.test(href);
}

/**
 * Resolves an href relative to the zip path of the file referencing it
 * (`fromPath`), normalizing `../` segments and stripping query/fragment.
 */
function resolveZipPath(fromPath: string, href: string): string {
	const url = new URL(href, `file:///${fromPath}`);
	return decodeURIComponent(url.pathname).replace(/^\//, "");
}

function parseXml(text: string): Document {
	return new DOMParser().parseFromString(text, "application/xml");
}

function firstByTagName(root: Document | Element, tagName: string) {
	return root.getElementsByTagNameNS("*", tagName)[0] ?? null;
}

export async function openEpub(data: ArrayBuffer): Promise<EpubBook> {
	const zip = await JSZip.loadAsync(data);

	const containerText = await zip
		.file("META-INF/container.xml")
		?.async("string");
	if (!containerText) {
		throw new Error("Invalid EPUB: missing container.xml");
	}
	const rootfile = firstByTagName(parseXml(containerText), "rootfile");
	const opfPath = rootfile?.getAttribute("full-path");
	if (!opfPath) {
		throw new Error("Invalid EPUB: no rootfile found");
	}

	const opfText = await zip.file(opfPath)?.async("string");
	if (!opfText) {
		throw new Error(`Invalid EPUB: missing OPF file at ${opfPath}`);
	}
	const opfDoc = parseXml(opfText);

	const pathsByItemId = new Map<string, string>();
	const manifest = firstByTagName(opfDoc, "manifest");
	for (const item of manifest?.getElementsByTagNameNS("*", "item") ?? []) {
		const id = item.getAttribute("id");
		const href = item.getAttribute("href");
		if (id && href) pathsByItemId.set(id, resolveZipPath(opfPath, href));
	}

	const spine = firstByTagName(opfDoc, "spine");
	const pageProgression =
		spine?.getAttribute("page-progression-direction") === "rtl"
			? ("rtl" as const)
			: ("ltr" as const);
	const chapterPaths: string[] = [];
	for (const itemref of spine?.getElementsByTagNameNS("*", "itemref") ?? []) {
		if (itemref.getAttribute("linear") === "no") continue;
		const path = pathsByItemId.get(itemref.getAttribute("idref") ?? "");
		if (path) chapterPaths.push(path);
	}
	if (chapterPaths.length === 0) {
		throw new Error("Invalid EPUB: empty spine");
	}

	const blobUrls: string[] = [];
	/** Blob URL per zip path, shared across chapters. CSS entries hold the
	 * rewritten stylesheet; the promise is cached before recursing so
	 * circular imports settle instead of looping. */
	const resourceUrls = new Map<string, Promise<string | null>>();

	function mediaTypeOf(path: string): string {
		const extension = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
		return MEDIA_TYPES_BY_EXTENSION[extension] ?? "application/octet-stream";
	}

	function toBlobUrl(content: BlobPart, type: string): string {
		const url = URL.createObjectURL(new Blob([content], { type }));
		blobUrls.push(url);
		return url;
	}

	function resourceUrl(path: string): Promise<string | null> {
		let promise = resourceUrls.get(path);
		if (!promise) {
			promise = (async () => {
				const file = zip.file(path);
				if (!file) return null;
				if (mediaTypeOf(path) === "text/css") {
					const rewritten = await rewriteCss(path, await file.async("string"));
					return toBlobUrl(rewritten, "text/css");
				}
				return toBlobUrl(await file.async("arraybuffer"), mediaTypeOf(path));
			})();
			resourceUrls.set(path, promise);
		}
		return promise;
	}

	/** Replaces relative @import/url() references with blob URLs. */
	async function rewriteCss(fromPath: string, css: string): Promise<string> {
		const hrefs = new Set<string>();
		for (const match of css.matchAll(CSS_REFERENCE_PATTERN)) {
			const href = match[2] ?? match[4];
			if (href && !isExternalReference(href)) hrefs.add(href);
		}
		const urlsByHref = new Map<string, string>();
		for (const href of hrefs) {
			const url = await resourceUrl(resolveZipPath(fromPath, href));
			if (url) urlsByHref.set(href, url);
		}
		return css.replace(
			CSS_REFERENCE_PATTERN,
			(original, _importQuote, importHref, _urlQuote, urlHref) => {
				const url = urlsByHref.get(importHref ?? urlHref);
				if (!url) return original;
				return importHref !== undefined ? `@import "${url}"` : `url("${url}")`;
			},
		);
	}

	/**
	 * Rewrites in place every attribute with one of the given local names
	 * (covering namespaced variants such as xlink:href) that points into
	 * the zip.
	 */
	async function rewriteReferenceAttributes(
		element: Element,
		localNames: string[],
		fromPath: string,
	): Promise<void> {
		for (const attribute of element.attributes) {
			if (!localNames.includes(attribute.localName)) continue;
			if (isExternalReference(attribute.value)) continue;
			const url = await resourceUrl(resolveZipPath(fromPath, attribute.value));
			if (url) attribute.value = url;
		}
	}

	async function loadChapter(chapterIndex: number): Promise<string> {
		const path = chapterPaths[chapterIndex];
		const text = await zip.file(path)?.async("string");
		if (text === undefined) {
			throw new Error(`Invalid EPUB: missing chapter file at ${path}`);
		}

		let doc = new DOMParser().parseFromString(text, "application/xhtml+xml");
		if (doc.getElementsByTagName("parsererror").length > 0) {
			doc = new DOMParser().parseFromString(text, "text/html");
		}

		// Scripts have no business in the reader, sandboxed or not.
		for (const script of doc.querySelectorAll("script")) {
			script.remove();
		}
		for (const link of doc.querySelectorAll("link[href]")) {
			if (!/\bstylesheet\b/i.test(link.getAttribute("rel") ?? "")) continue;
			await rewriteReferenceAttributes(link, ["href"], path);
		}
		for (const style of doc.querySelectorAll("style")) {
			style.textContent = await rewriteCss(path, style.textContent ?? "");
		}
		for (const img of doc.querySelectorAll("img")) {
			await rewriteReferenceAttributes(img, ["src"], path);
		}
		// SVG cover pages reference their bitmap via (xlink:)href.
		for (const image of doc.querySelectorAll("image")) {
			await rewriteReferenceAttributes(image, ["href"], path);
		}

		return new XMLSerializer().serializeToString(doc);
	}

	return {
		pageProgression,
		chapterCount: chapterPaths.length,
		loadChapter,
		dispose() {
			for (const url of blobUrls) {
				URL.revokeObjectURL(url);
			}
			blobUrls.length = 0;
			resourceUrls.clear();
		},
	};
}
