"use client";

import {
	type EpubLocation,
	type EpubPosition,
	locationFraction,
} from "@calibre-web-serverless/domain/models/readingProgress";
import { Box, Center } from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookReaderLoading } from "@/components/BookReaderLoading";
import { BookReaderShell } from "@/components/BookReaderShell";
import { EmptyState } from "@/components/ui/empty-state";
import { useEpubBook } from "@/hooks/useEpubBook";
import { chapterTextNodes, type EpubBook } from "@/lib/epub";

export interface EpubReaderPageProps {
	title: string;
	/** Cover image shown while the EPUB loads, or null when the book has none. */
	coverUrl: string | null;
	/** Download URL of the book's EPUB, or null when the book has none. */
	fileUrl: string | null;
	/** True while the URL is still being resolved (fileUrl is null meanwhile). */
	fileLoading: boolean;
	/** 1-based spine chapter to show; chapters past the end display the last. */
	chapterNo: number;
	/** Called to move to another chapter; the caller updates the URL. */
	onChapterNoChange: (chapterNo: number) => void;
	/**
	 * The EPUB position saved as of opening the book. Opening at its chapter
	 * resumes at its character; its chapter lengths spare measuring them.
	 */
	savedPosition: EpubPosition | null;
	/** Called whenever another page is shown, once chapter lengths are known. */
	onLocationChange: (location: EpubLocation) => void;
	read: boolean;
	/** Called on request, and when the end of a book not yet read is shown. */
	onMarkRead: () => void;
	onBack: () => void;
}

export function EpubReaderPage({
	title,
	coverUrl,
	fileUrl,
	fileLoading,
	chapterNo,
	onChapterNoChange,
	savedPosition,
	onLocationChange,
	read,
	onMarkRead,
	onBack,
}: EpubReaderPageProps) {
	const {
		epubBook,
		loading: epubLoading,
		progress,
		error,
	} = useEpubBook(fileUrl);
	const chapterCount = epubBook?.chapterCount ?? null;
	const displayedChapterNo =
		chapterCount === null ? chapterNo : Math.min(chapterNo, chapterCount);
	const chapterIndex = displayedChapterNo - 1;

	// The saved character only applies when the book opens at its chapter.
	const [position, setPosition] = useState<ReaderPosition | null>(() =>
		savedPosition?.chapterNo === chapterNo
			? { chapterIndex: chapterNo - 1, charOffset: savedPosition.charOffset }
			: null,
	);
	// Tagged with its chapter so the previous chapter's pagination is never
	// applied to the next one.
	const [pagination, setPagination] = useState<{
		chapterIndex: number;
		paginator: Paginator;
	} | null>(null);
	const paginator =
		pagination?.chapterIndex === chapterIndex ? pagination.paginator : null;
	const handlePaginate = useCallback(
		(paginator: Paginator) => setPagination({ chapterIndex, paginator }),
		[chapterIndex],
	);

	// A chapter reached without a position (through the URL) opens at its
	// start.
	const page = useMemo(() => {
		if (!paginator) return null;
		const at = position?.chapterIndex === chapterIndex ? position : null;
		if (at?.page?.paginator === paginator) return at.page.page;
		const charOffset = at?.charOffset ?? 0;
		return charOffset === "end"
			? paginator.pageCount - 1
			: paginator.pageOf(charOffset);
	}, [paginator, position, chapterIndex]);
	const pageCount = paginator?.pageCount ?? null;
	const displayedPage = page ?? 0;
	const shownCharOffset = useMemo(
		() => (paginator && page !== null ? paginator.offsetOfPage(page) : null),
		[paginator, page],
	);

	const [savedChapterLengths] = useState(savedPosition?.chapterLengths);
	const [chapterLengths, setChapterLengths] = useState<number[] | null>(null);
	useEffect(() => {
		if (!epubBook) return;
		if (savedChapterLengths?.length === epubBook.chapterCount) {
			setChapterLengths(savedChapterLengths);
			return;
		}
		let active = true;
		setChapterLengths(null);
		epubBook
			.chapterLengths()
			.then((lengths) => {
				if (active) setChapterLengths(lengths);
			})
			.catch(() => {
				// Without lengths the position is still worth saving; only the
				// fraction read is lost.
				if (active) setChapterLengths(Array(epubBook.chapterCount).fill(0));
			});
		return () => {
			active = false;
		};
	}, [epubBook, savedChapterLengths]);

	const chapterTitle = epubBook?.chapterTitles[chapterIndex] ?? null;
	const location: EpubLocation | null =
		chapterLengths && shownCharOffset !== null
			? {
					chapterNo: displayedChapterNo,
					charOffset: shownCharOffset,
					chapterTitle,
					chapterLengths,
				}
			: null;

	useEffect(() => {
		if (!chapterLengths || shownCharOffset === null) return;
		onLocationChange({
			chapterNo: displayedChapterNo,
			charOffset: shownCharOffset,
			chapterTitle,
			chapterLengths,
		});
	}, [
		chapterLengths,
		shownCharOffset,
		displayedChapterNo,
		chapterTitle,
		onLocationChange,
	]);

	const goForward = useCallback(() => {
		if (!paginator || page === null || chapterCount === null) return;
		if (page < paginator.pageCount - 1) {
			setPosition(positionAtPage(chapterIndex, paginator, page + 1));
		} else if (displayedChapterNo < chapterCount) {
			setPosition({ chapterIndex: chapterIndex + 1, charOffset: 0 });
			onChapterNoChange(displayedChapterNo + 1);
		}
	}, [
		paginator,
		page,
		chapterCount,
		chapterIndex,
		displayedChapterNo,
		onChapterNoChange,
	]);

	const goBackward = useCallback(() => {
		if (!paginator || page === null) return;
		if (page > 0) {
			setPosition(positionAtPage(chapterIndex, paginator, page - 1));
		} else if (displayedChapterNo > 1) {
			setPosition({ chapterIndex: chapterIndex - 1, charOffset: "end" });
			onChapterNoChange(displayedChapterNo - 1);
		}
	}, [paginator, page, chapterIndex, displayedChapterNo, onChapterNoChange]);

	// In an rtl book (Japanese vertical writing) the next page is to the left,
	// so the physical arrows swap meaning.
	const rtl = epubBook?.pageProgression === "rtl";
	const goLeft = rtl ? goForward : goBackward;
	const goRight = rtl ? goBackward : goForward;

	const handleKey = useCallback(
		(key: string) => {
			if (key === "ArrowLeft") {
				goLeft();
			} else if (key === "ArrowRight") {
				goRight();
			}
		},
		[goLeft, goRight],
	);

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => handleKey(event.key);
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [handleKey]);

	const loading = fileLoading || epubLoading;
	const canGoForward =
		chapterCount !== null &&
		pageCount !== null &&
		(displayedPage < pageCount - 1 || displayedChapterNo < chapterCount);
	const canGoBackward =
		pageCount !== null && (displayedPage > 0 || displayedChapterNo > 1);

	// While the chapter is still being measured the page half stays a
	// placeholder; the chapter half is always known once the book is open.
	const pageIndicator =
		pageCount === null ? "p. – / –" : `p. ${displayedPage + 1} / ${pageCount}`;

	return (
		<BookReaderShell
			title={title}
			subtitle={chapterTitle}
			progress={location ? locationFraction(location) : undefined}
			read={read}
			atEnd={chapterCount !== null && pageCount !== null && !canGoForward}
			onMarkRead={onMarkRead}
			onBack={onBack}
			pageTurn={
				chapterCount === null
					? undefined
					: {
							indicator: `${displayedChapterNo} / ${chapterCount} · ${pageIndicator}`,
							leftButton: {
								label: rtl ? "Next page" : "Previous page",
								disabled: rtl ? !canGoForward : !canGoBackward,
								onClick: goLeft,
							},
							rightButton: {
								label: rtl ? "Previous page" : "Next page",
								disabled: rtl ? !canGoBackward : !canGoForward,
								onClick: goRight,
							},
						}
			}
		>
			{loading ? (
				<BookReaderLoading coverUrl={coverUrl} progress={progress} />
			) : error ? (
				<Center height="100%">
					<EmptyState
						title="Couldn't open the EPUB"
						description="The file may be corrupted or the download failed. Try again later."
					/>
				</Center>
			) : !fileUrl ? (
				<Center height="100%">
					<EmptyState
						title="No EPUB file"
						description="This book doesn't have an EPUB file to read."
					/>
				</Center>
			) : epubBook ? (
				<EpubChapterView
					key={chapterIndex}
					epubBook={epubBook}
					chapterIndex={chapterIndex}
					page={displayedPage}
					onPaginate={handlePaginate}
					onKeyDown={handleKey}
				/>
			) : null}
		</BookReaderShell>
	);
}

/** Space between the page edge and the text, inside the iframe. */
const PAGE_MARGIN = 24;
const PAGINATION_STYLE_ID = "epub-reader-pagination";

interface ChapterLayout {
	/** True for vertical writing: pages advance along the y axis. */
	vertical: boolean;
	/** Scroll offset between the starts of two consecutive pages. */
	stride: number;
	pageCount: number;
}

/** Measurements of one pagination of the shown chapter. */
interface Paginator {
	pageCount: number;
	/** The page showing the character at `charOffset`. */
	pageOf: (charOffset: number) => number;
	/** The offset of the first character laid out on `page` or later. */
	offsetOfPage: (page: number) => number;
}

/**
 * The reader's place in a chapter. The character survives repagination;
 * `page` pins the exact page while the pagination it was picked in is still
 * current, since a page without text (a full-page image) has no character
 * of its own. "end" is the last page, for entering a chapter backwards.
 */
interface ReaderPosition {
	chapterIndex: number;
	charOffset: number | "end";
	page?: { paginator: Paginator; page: number };
}

function positionAtPage(
	chapterIndex: number,
	paginator: Paginator,
	page: number,
): ReaderPosition {
	return {
		chapterIndex,
		charOffset: paginator.offsetOfPage(page),
		page: { paginator, page },
	};
}

interface EpubChapterViewProps {
	epubBook: EpubBook;
	/** 0-based linear spine index. */
	chapterIndex: number;
	/** 0-based page within the chapter to scroll to. */
	page: number;
	/** Called after every pagination, including reflows. */
	onPaginate: (paginator: Paginator) => void;
	/** Forwards key presses landing inside the iframe. */
	onKeyDown: (key: string) => void;
}

/**
 * Renders one spine chapter in a sandboxed iframe and paginates it with CSS
 * columns sized to the viewport: pages are overflow columns, which advance
 * rightward for horizontal writing and downward for vertical writing, so
 * lines are never cut at a page boundary. Turning a page scrolls the iframe
 * document by one viewport.
 */
function EpubChapterView({
	epubBook,
	chapterIndex,
	page,
	onPaginate,
	onKeyDown,
}: EpubChapterViewProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const [html, setHtml] = useState<string | null>(null);
	const [chapterError, setChapterError] = useState(false);
	const [docLoaded, setDocLoaded] = useState(false);
	const [containerSize, setContainerSize] = useState<{
		width: number;
		height: number;
	} | null>(null);
	const [layout, setLayout] = useState<ChapterLayout | null>(null);

	useEffect(() => {
		let active = true;
		setHtml(null);
		setChapterError(false);
		setDocLoaded(false);
		setLayout(null);
		epubBook
			.loadChapter(chapterIndex)
			.then((chapterHtml) => {
				if (active) setHtml(chapterHtml);
			})
			.catch(() => {
				if (active) setChapterError(true);
			});
		return () => {
			active = false;
		};
	}, [epubBook, chapterIndex]);

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;
		const observer = new ResizeObserver(([entry]) => {
			setContainerSize({
				width: Math.floor(entry.contentRect.width),
				height: Math.floor(entry.contentRect.height),
			});
		});
		observer.observe(container);
		return () => observer.disconnect();
	}, []);

	// Paginate: measure the chapter's writing mode, then constrain the body to
	// one viewport-sized column so the rest of the content flows into overflow
	// columns (the following pages). Remeasured when fonts finish loading,
	// since that can reflow the chapter.
	useEffect(() => {
		if (!docLoaded || !containerSize) return;
		const { width, height } = containerSize;
		if (width <= 0 || height <= 0) return;
		const doc = iframeRef.current?.contentDocument;
		if (!doc?.body) return;

		let active = true;
		const apply = () => {
			const vertical = doc.defaultView
				?.getComputedStyle(doc.body)
				.writingMode.startsWith("vertical");
			const style =
				doc.getElementById(PAGINATION_STYLE_ID) ??
				doc.head.appendChild(doc.createElement("style"));
			style.id = PAGINATION_STYLE_ID;
			style.textContent = `
				html {
					overflow: hidden !important;
					background: #fff;
					color-scheme: light;
				}
				html, body { margin: 0 !important; }
				body {
					box-sizing: border-box !important;
					width: ${width}px !important;
					height: ${height}px !important;
					padding: ${PAGE_MARGIN}px !important;
					column-fill: auto !important;
					column-gap: ${PAGE_MARGIN * 2}px !important;
					column-width: ${(vertical ? height : width) - PAGE_MARGIN * 2}px !important;
				}
				img, svg { max-width: 100%; max-height: 100vh; }
			`;
			const stride = vertical ? height : width;
			const scrollSize = vertical
				? doc.documentElement.scrollHeight
				: doc.documentElement.scrollWidth;
			const pageCount = Math.max(1, Math.round(scrollSize / stride));
			const nextLayout = { vertical: vertical ?? false, stride, pageCount };
			setLayout(nextLayout);
			onPaginate({
				pageCount,
				pageOf: (charOffset) =>
					pageOfCharOffset(
						doc,
						nextLayout,
						chapterTextNodes(doc.body),
						charOffset,
					),
				offsetOfPage: (page) =>
					charOffsetOfPage(doc, nextLayout, chapterTextNodes(doc.body), page),
			});
		};
		apply();
		doc.fonts?.ready.then(() => {
			if (active) apply();
		});
		return () => {
			active = false;
		};
	}, [docLoaded, containerSize, onPaginate]);

	// Key presses land in the iframe once the reader has been clicked.
	useEffect(() => {
		if (!docLoaded) return;
		const doc = iframeRef.current?.contentDocument;
		if (!doc) return;
		const handleKeyDown = (event: KeyboardEvent) => onKeyDown(event.key);
		doc.addEventListener("keydown", handleKeyDown);
		return () => doc.removeEventListener("keydown", handleKeyDown);
	}, [docLoaded, onKeyDown]);

	useEffect(() => {
		if (!docLoaded || !layout) return;
		const doc = iframeRef.current?.contentDocument;
		if (!doc?.body) return;
		const root = doc.documentElement;
		const shownPage = Math.min(page, layout.pageCount - 1);
		const offset = shownPage * layout.stride;
		root.scrollLeft = layout.vertical ? 0 : offset;
		root.scrollTop = layout.vertical ? offset : 0;
	}, [docLoaded, layout, page]);

	if (chapterError) {
		return (
			<Center height="100%">
				<EmptyState
					title="Couldn't display this chapter"
					description="The chapter file is missing or corrupted."
				/>
			</Center>
		);
	}

	return (
		<Box ref={containerRef} height="100%" overflow="hidden" p={4}>
			{html !== null && containerSize && (
				<Box asChild shadow="md" bg="white" display="block" border="none">
					<iframe
						ref={iframeRef}
						title="Book content"
						sandbox="allow-same-origin"
						srcDoc={html}
						width={containerSize.width}
						height={containerSize.height}
						onLoad={() => setDocLoaded(true)}
					/>
				</Box>
			)}
		</Box>
	);
}

type ChapterText = ReturnType<typeof chapterTextNodes>;

/**
 * The 0-based page a character is laid out on, or null when it has no box
 * (whitespace collapsed away). Independent of the current scroll position.
 */
function charPage(
	doc: Document,
	layout: ChapterLayout,
	node: Text,
	offset: number,
): number | null {
	const range = doc.createRange();
	range.setStart(node, offset);
	range.setEnd(node, offset + 1);
	const rect = range.getClientRects()[0];
	if (!rect) return null;
	const root = doc.documentElement;
	const position = layout.vertical
		? rect.top + rect.height / 2 + root.scrollTop
		: rect.left + rect.width / 2 + root.scrollLeft;
	return Math.min(
		Math.max(Math.floor(position / layout.stride), 0),
		layout.pageCount - 1,
	);
}

/** The page showing the character at `charOffset`, or the first one laid out after it. */
function pageOfCharOffset(
	doc: Document,
	layout: ChapterLayout,
	{ nodes }: ChapterText,
	charOffset: number,
): number {
	const first = nodes.findLastIndex(({ start }) => start <= charOffset);
	for (let i = Math.max(first, 0); i < nodes.length; i++) {
		const { node, start } = nodes[i];
		for (
			let offset = Math.max(charOffset - start, 0);
			offset < node.length;
			offset++
		) {
			const page = charPage(doc, layout, node, offset);
			if (page !== null) return page;
		}
	}
	return layout.pageCount - 1;
}

/** The offset of the first character laid out on `page` or later. */
function charOffsetOfPage(
	doc: Document,
	layout: ChapterLayout,
	{ nodes, length }: ChapterText,
	page: number,
): number {
	if (page === 0) return 0;
	for (const { node, start } of nodes) {
		let lastPage: number | null = null;
		for (
			let offset = node.length - 1;
			offset >= 0 && lastPage === null;
			offset--
		) {
			lastPage = charPage(doc, layout, node, offset);
		}
		if (lastPage === null || lastPage < page) continue;
		// Pages only grow through a node; a boxless character counts as before.
		let low = 0;
		let high = node.length - 1;
		while (low < high) {
			const mid = (low + high) >> 1;
			const midPage = charPage(doc, layout, node, mid);
			if (midPage !== null && midPage >= page) high = mid;
			else low = mid + 1;
		}
		return start + low;
	}
	return length;
}
