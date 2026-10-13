const PAGE_IMAGE = /\.(jpe?g|png|webp|gif|avif)$/i;
const naturalOrder = new Intl.Collator("en", { numeric: true }).compare;

/**
 * The page images of a comic archive (CBZ) in reading order, given the paths
 * of its entries. Archives carry no page list, so order is the natural sort
 * of the paths (`2.jpg` before `10.jpg`); hidden files and macOS resource
 * forks (`__MACOSX/`) are not pages.
 */
export function comicPagePaths(paths: string[]): string[] {
	return paths
		.filter(
			(p) =>
				PAGE_IMAGE.test(p) &&
				!p
					.split("/")
					.some((part) => part.startsWith(".") || part === "__MACOSX"),
		)
		.sort(naturalOrder);
}

/**
 * Group pages into the spreads of a two-page view, as 0-based page indices.
 * The cover and wide pages (spreads already scanned as one image) stand
 * alone, and pairing restarts after each of them so facing pages stay
 * together.
 */
export function comicSpreads(widePages: boolean[]): number[][] {
	const spreads: number[][] = [];
	let i = 0;
	while (i < widePages.length) {
		const pairs =
			i > 0 && !widePages[i] && i + 1 < widePages.length && !widePages[i + 1];
		spreads.push(pairs ? [i, i + 1] : [i]);
		i += pairs ? 2 : 1;
	}
	return spreads;
}
