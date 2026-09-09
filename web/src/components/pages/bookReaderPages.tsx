import {
	type BookFile,
	type BookFileFormat,
	readyFiles,
} from "@calibre-web-serverless/domain/models/bookFile";
import type { ComponentType } from "react";
import { EpubReaderPage } from "./EpubReaderPage";
import { PdfReaderPage } from "./PdfReaderPage";

/** The interface every reader page shares with the reader route. */
export interface BookReaderPageProps {
	title: string;
	coverUrl: string | null;
	fileUrl: string | null;
	fileLoading: boolean;
	/** 1-based reading position from the URL; its unit is the reader's own
	 * (PDF: a page, EPUB: a spine chapter). */
	pageNo: number;
	onPageNoChange: (pageNo: number) => void;
	onBack: () => void;
}

/** Adapts the shared position props to the EPUB reader's chapter unit. */
function EpubBookReaderPage({
	pageNo,
	onPageNoChange,
	...rest
}: BookReaderPageProps) {
	return (
		<EpubReaderPage
			{...rest}
			chapterNo={pageNo}
			onChapterNoChange={onPageNoChange}
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
