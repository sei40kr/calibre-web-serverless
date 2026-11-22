"use client";

import {
	type EpubPosition,
	type PagePosition,
	type ReadingLocation,
	readingPositions,
} from "@calibre-web-serverless/domain/models/readingProgress";
import { Center, Spinner } from "@chakra-ui/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { bookDetailsHref } from "@/components/pages/BookDetailsPage";
import { BookNotFoundPage } from "@/components/pages/BookNotFoundPage";
import {
	READER_PAGES_BY_FORMAT,
	readableBookFormats,
} from "@/components/pages/bookReaderPages";
import { toaster } from "@/components/ui/toaster";
import { useBook } from "@/hooks/useBook";
import { useBookCoverUrl } from "@/hooks/useBookCoverUrl";
import { useBookFileUrl } from "@/hooks/useBookFileUrl";
import { useReadingProgressRecorder } from "@/hooks/useReadingProgressRecorder";

export default function BookReaderRoute() {
	// This route is served as a static shell (rewritten from any book id and
	// page number), so the prerendered route params are a placeholder. Derive
	// the real values reactively from the browser path instead — usePathname()
	// updates on client-side navigation, whereas a one-time window.location
	// read can run before the URL has changed and capture empty values.
	const pathname = usePathname();
	const match = pathname?.match(/\/books\/([^/]+)\/pages\/([^/]+)/);
	const bookId = match?.[1] ?? "";
	const pageNo = Number(match?.[2]);

	return (
		<AuthGuard>
			{({ user }) => (
				<Suspense fallback={null}>
					<BookReaderRouteContent
						userId={user.uid}
						bookId={bookId}
						pageNo={pageNo}
					/>
				</Suspense>
			)}
		</AuthGuard>
	);
}

interface BookReaderRouteContentProps {
	userId: string;
	bookId: string;
	pageNo: number;
}

function BookReaderRouteContent({
	userId,
	bookId,
	pageNo,
}: BookReaderRouteContentProps) {
	const router = useRouter();
	const searchParams = useSearchParams();
	const { book, loading, error } = useBook(userId, bookId);
	// The ?format= param (set by the card's format chooser) picks the reader;
	// without one, the first readable format wins (READER_PAGES_BY_FORMAT is
	// in preference order).
	const formats = readableBookFormats(book?.files ?? []);
	const requestedFormat =
		formats.find((format) => format === searchParams?.get("format")) ?? null;
	const format = requestedFormat ?? formats[0] ?? "pdf";
	const { fileUrl, loading: fileLoading } = useBookFileUrl(
		userId,
		bookId,
		format,
		formats.includes(format),
	);
	const { coverUrl } = useBookCoverUrl(
		userId,
		bookId,
		book?.hasCover ?? false,
		book?.hasCustomCover ?? false,
		book?.updatedAt?.getTime(),
	);

	// Page turns replace instead of push so Back leaves the reader rather than
	// stepping through every visited page.
	const goToPage = useCallback(
		(nextPageNo: number) => {
			const query = requestedFormat ? `?format=${requestedFormat}` : "";
			router.replace(`/books/${bookId}/pages/${nextPageNo}${query}`);
		},
		[router, bookId, requestedFormat],
	);

	const { record, markRead } = useReadingProgressRecorder(
		userId,
		bookId,
		book?.reading,
	);
	const handleLocationChange = useCallback(
		(location: ReadingLocation) => record(format, location),
		[record, format],
	);

	const validPageNo = Number.isInteger(pageNo) && pageNo >= 1;

	// Announced once per visit, when the URL opens the saved position.
	const resumeAnnouncedRef = useRef(false);
	useEffect(() => {
		if (!book || resumeAnnouncedRef.current) return;
		resumeAnnouncedRef.current = true;
		const label = resumedAtLabel(
			readingPositions(book.reading)[format],
			pageNo,
		);
		// The toaster flushes synchronously, which React forbids during an effect.
		if (label)
			queueMicrotask(() => toaster.info({ title: `Resumed at ${label}` }));
	}, [book, format, pageNo]);

	// Normalize a malformed or sub-1 page segment to the first page.
	useEffect(() => {
		if (!validPageNo) {
			goToPage(1);
		}
	}, [validPageNo, goToPage]);

	if (loading) {
		return (
			<Center height="100dvh">
				<Spinner size="lg" />
			</Center>
		);
	}

	if (error || !book) {
		return <BookNotFoundPage onBack={() => router.push("/dashboard")} />;
	}

	const ReaderPage = READER_PAGES_BY_FORMAT[format];
	return (
		<ReaderPage
			title={book.title}
			coverUrl={coverUrl}
			fileUrl={fileUrl}
			fileLoading={fileLoading}
			pageNo={validPageNo ? pageNo : 1}
			onPageNoChange={goToPage}
			savedPositions={readingPositions(book.reading)}
			onLocationChange={handleLocationChange}
			read={book.reading.status === "read"}
			onMarkRead={markRead}
			onBack={() => router.push(bookDetailsHref(bookId))}
		/>
	);
}

/**
 * Where the reader resumes when opened at `pageNo` (the EPUB chapter or the
 * page), or null when that is not the saved position or is the very start.
 */
function resumedAtLabel(
	position: EpubPosition | PagePosition | undefined,
	pageNo: number,
): string | null {
	if (!position) return null;
	if ("chapterNo" in position) {
		if (position.chapterNo !== pageNo) return null;
		if (position.chapterNo === 1 && position.charOffset === 0) return null;
		return position.chapterTitle ?? `chapter ${position.chapterNo}`;
	}
	return position.pageNo === pageNo && pageNo > 1 ? `page ${pageNo}` : null;
}
