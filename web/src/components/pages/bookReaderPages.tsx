import type { Book } from "@calibre-web-serverless/domain/models/book";
import {
	type BookFile,
	type BookFileFormat,
	readyFiles,
} from "@calibre-web-serverless/domain/models/bookFile";
import {
	type ReadingLocation,
	type ReadingPositions,
	readingPositions,
} from "@calibre-web-serverless/domain/models/readingProgress";
import type { ComponentType } from "react";
import { ComicReaderPage } from "./ComicReaderPage";
import { EpubReaderPage } from "./EpubReaderPage";
import { PdfReaderPage } from "./PdfReaderPage";

/** The interface every reader page shares with the reader route. */
export interface BookReaderPageProps {
	title: string;
	coverUrl: string | null;
	fileUrl: string | null;
	fileLoading: boolean;
	/** 1-based reading position from the URL; its unit is the reader's own
	 * (PDF/CBZ: a page, EPUB: a spine chapter). */
	pageNo: number;
	onPageNoChange: (pageNo: number) => void;
	/** Positions saved for the book, as of opening it. */
	savedPositions: ReadingPositions;
	/** Called whenever the reader shows another location. */
	onLocationChange: (location: ReadingLocation) => void;
	onBack: () => void;
}

/** Adapts the shared position props to the EPUB reader's chapter unit. */
function EpubBookReaderPage({
	pageNo,
	onPageNoChange,
	savedPositions,
	...rest
}: BookReaderPageProps) {
	return (
		<EpubReaderPage
			{...rest}
			chapterNo={pageNo}
			onChapterNoChange={onPageNoChange}
			savedPosition={savedPositions.epub ?? null}
		/>
	);
}

/**
 * The in-browser readers, keyed by book file format — the single source of
 * truth for which formats are readable. Key order is the preference order:
 * EPUB wins over PDF because it reflows to the viewport and supports
 * vertical writing.
 */
export const READER_PAGES_BY_FORMAT = {
	epub: EpubBookReaderPage,
	pdf: PdfReaderPage,
	cbz: ComicReaderPage,
} as const satisfies Partial<
	Record<BookFileFormat, ComponentType<BookReaderPageProps>>
>;

export type ReadableBookFormat = keyof typeof READER_PAGES_BY_FORMAT;

/** The book's ready formats that have a reader, in preference order. */
export function readableBookFormats(files: BookFile[]): ReadableBookFormat[] {
	const ready = new Set(readyFiles(files).map((file) => file.format));
	return (Object.keys(READER_PAGES_BY_FORMAT) as ReadableBookFormat[]).filter(
		(format) => ready.has(format),
	);
}

/** Opens the reader in `format` where the book was last read in it. */
export function readerHref(book: Book, format: ReadableBookFormat): string {
	const position = readingPositions(book.reading)[format];
	const pageNo = !position
		? 1
		: "chapterNo" in position
			? position.chapterNo
			: position.pageNo;
	return `/books/${book.id}/pages/${pageNo}?format=${format}`;
}
