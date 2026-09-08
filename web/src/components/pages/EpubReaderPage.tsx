"use client";

import { Box, Center } from "@chakra-ui/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { BookReaderLoading } from "@/components/BookReaderLoading";
import { BookReaderShell } from "@/components/BookReaderShell";
import { EmptyState } from "@/components/ui/empty-state";
import { useEpubBook } from "@/hooks/useEpubBook";
import type { EpubBook } from "@/lib/epub";

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
	onBack: () => void;
}

export function EpubReaderPage({
	title,
	coverUrl,
	fileUrl,
	fileLoading,
	chapterNo,
	onChapterNoChange,
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

	// Within-chapter position. `page` is a request that the view clamps once
	// the chapter is measured, so "last page of the previous chapter" can be
	// requested before its page count is known.
	const [page, setPage] = useState(0);
	const [pageCount, setPageCount] = useState<number | null>(null);
	const entryPageRef = useRef(0);
	const chapterIndex = displayedChapterNo - 1;

	// biome-ignore lint/correctness/useExhaustiveDependencies: reset per chapter
	useEffect(() => {
		setPage(entryPageRef.current);
		setPageCount(null);
		entryPageRef.current = 0;
	}, [chapterIndex]);

	const displayedPage = Math.min(page, Math.max((pageCount ?? 1) - 1, 0));

	const goForward = useCallback(() => {
		if (pageCount === null || chapterCount === null) return;
		if (displayedPage < pageCount - 1) {
			setPage(displayedPage + 1);
		} else if (displayedChapterNo < chapterCount) {
			entryPageRef.current = 0;
			onChapterNoChange(displayedChapterNo + 1);
		}
	}, [
		pageCount,
		chapterCount,
		displayedPage,
		displayedChapterNo,
		onChapterNoChange,
	]);

	const goBackward = useCallback(() => {
		if (pageCount === null || chapterCount === null) return;
		if (displayedPage > 0) {
			setPage(displayedPage - 1);
		} else if (displayedChapterNo > 1) {
			entryPageRef.current = Number.MAX_SAFE_INTEGER;
			onChapterNoChange(displayedChapterNo - 1);
		}
	}, [
		pageCount,
		chapterCount,
		displayedPage,
		displayedChapterNo,
		onChapterNoChange,
	]);

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
					epubBook={epubBook}
					chapterIndex={chapterIndex}
					page={displayedPage}
					onPageCountChange={setPageCount}
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

interface EpubChapterViewProps {
	epubBook: EpubBook;
	/** 0-based linear spine index. */
	chapterIndex: number;
	/** 0-based page within the chapter, already clamped by the caller. */
	page: number;
	onPageCountChange: (pageCount: number) => void;
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
	onPageCountChange,
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
			setLayout({ vertical: vertical ?? false, stride, pageCount });
			onPageCountChange(pageCount);
		};
		apply();
		doc.fonts?.ready.then(() => {
			if (active) apply();
		});
		return () => {
			active = false;
		};
	}, [docLoaded, containerSize, onPageCountChange]);

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
		const root = iframeRef.current?.contentDocument?.documentElement;
		if (!root) return;
		const offset = Math.min(page, layout.pageCount - 1) * layout.stride;
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
