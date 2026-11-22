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
	/**
	 * TOC title per chapter. A chapter the TOC does not point at continues the
	 * one before it (a chapter split across files), so it takes that title.
	 */
	chapterTitles: (string | null)[];
	/** Returns the rewritten XHTML of the 0-based linear spine item. */
	loadChapter(chapterIndex: number): Promise<string>;
	/**
	 * Reading-text length of every chapter, as {@link chapterTextNodes} counts
	 * it in the rendered chapter. Parses every chapter, so it is slow.
	 */
	chapterLengths(): Promise<number[]>;
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

const EPUB_OPS_NAMESPACE = "http://www.idpf.org/2007/ops";

/**
 * The chapter's reading text as text nodes in document order, each with the
 * offset of its first character. Style and script text is not reading text.
 */
export function chapterTextNodes(body: HTMLElement): {
	nodes: { node: Text; start: number }[];
	length: number;
} {
	const doc = body.ownerDocument;
	const walker = doc.createTreeWalker(body, NodeFilter.SHOW_TEXT, {
		acceptNode: (node) =>
			node.parentElement?.closest("style, script")
				? NodeFilter.FILTER_REJECT
				: NodeFilter.FILTER_ACCEPT,
	});
	const nodes: { node: Text; start: number }[] = [];
	let length = 0;
	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		const text = node as Text;
		nodes.push({ node: text, start: length });
		length += text.length;
	}
	return { nodes, length };
}

/** TOC entries in reading order, from the EPUB 3 nav or else the EPUB 2 NCX. */
async function readToc(
	zip: JSZip,
	navPath: string | null,
	ncxPath: string | null,
): Promise<{ path: string; title: string }[]> {
	const entry = (fromPath: string, href: string | null, title: string) =>
		href ? [{ path: resolveZipPath(fromPath, href), title: title.trim() }] : [];

	const navText = navPath && (await zip.file(navPath)?.async("string"));
	if (navPath && navText) {
		const navs = [...parseXml(navText).getElementsByTagNameNS("*", "nav")];
		const toc =
			navs.find((nav) =>
				nav
					.getAttributeNS(EPUB_OPS_NAMESPACE, "type")
					?.split(/\s+/)
					.includes("toc"),
			) ?? navs[0];
		if (toc) {
			return [...toc.getElementsByTagNameNS("*", "a")].flatMap((a) =>
				entry(navPath, a.getAttribute("href"), a.textContent ?? ""),
			);
		}
	}

	const ncxText = ncxPath && (await zip.file(ncxPath)?.async("string"));
	if (ncxPath && ncxText) {
		// Document order is reading order: a navPoint's own label and content
		// precede its children.
		return [
			...parseXml(ncxText).getElementsByTagNameNS("*", "navPoint"),
		].flatMap((point) =>
			entry(
				ncxPath,
				firstByTagName(point, "content")?.getAttribute("src") ?? null,
				firstByTagName(point, "text")?.textContent ?? "",
			),
		);
	}
	return [];
}

/** Falls back to the HTML parser for chapters that are not well-formed XHTML. */
function parseChapter(text: string): Document {
	const doc = new DOMParser().parseFromString(text, "application/xhtml+xml");
	if (doc.getElementsByTagName("parsererror").length === 0) return doc;
	return new DOMParser().parseFromString(text, "text/html");
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
	let navPath: string | null = null;
	const manifest = firstByTagName(opfDoc, "manifest");
	for (const item of manifest?.getElementsByTagNameNS("*", "item") ?? []) {
		const id = item.getAttribute("id");
		const href = item.getAttribute("href");
		if (!id || !href) continue;
		const path = resolveZipPath(opfPath, href);
		pathsByItemId.set(id, path);
		if (item.getAttribute("properties")?.split(/\s+/).includes("nav")) {
			navPath = path;
		}
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

	const titlesByPath = new Map<string, string>();
	for (const { path, title } of await readToc(
		zip,
		navPath,
		pathsByItemId.get(spine?.getAttribute("toc") ?? "") ?? null,
	)) {
		if (title && !titlesByPath.has(path)) titlesByPath.set(path, title);
	}
	const chapterTitles: (string | null)[] = [];
	for (const path of chapterPaths) {
		chapterTitles.push(titlesByPath.get(path) ?? chapterTitles.at(-1) ?? null);
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

	async function readChapter(path: string): Promise<string> {
		const text = await zip.file(path)?.async("string");
		if (text === undefined) {
			throw new Error(`Invalid EPUB: missing chapter file at ${path}`);
		}
		return text;
	}

	async function loadChapter(chapterIndex: number): Promise<string> {
		const path = chapterPaths[chapterIndex];
		const doc = parseChapter(await readChapter(path));

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
		chapterTitles,
		loadChapter,
		async chapterLengths() {
			const lengths: number[] = [];
			for (const path of chapterPaths) {
				// Reparse the serialization as HTML, as the reader's srcDoc iframe
				// does, so whitespace handling matches the rendered chapter.
				const html = new DOMParser().parseFromString(
					new XMLSerializer().serializeToString(
						parseChapter(await readChapter(path)),
					),
					"text/html",
				);
				lengths.push(chapterTextNodes(html.body).length);
			}
			return lengths;
		},
		dispose() {
			for (const url of blobUrls) {
				URL.revokeObjectURL(url);
			}
			blobUrls.length = 0;
			resourceUrls.clear();
		},
	};
}
