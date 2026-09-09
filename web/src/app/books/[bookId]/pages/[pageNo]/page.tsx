"use client";

import { Center, Spinner } from "@chakra-ui/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { BookNotFoundPage } from "@/components/pages/BookNotFoundPage";
import {
	READER_PAGES_BY_FORMAT,
	readableBookFormats,
} from "@/components/pages/bookReaderPages";
import { useBook } from "@/hooks/useBook";
import { useBookCoverUrl } from "@/hooks/useBookCoverUrl";
import { useBookFileUrl } from "@/hooks/useBookFileUrl";

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

	const validPageNo = Number.isInteger(pageNo) && pageNo >= 1;

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
			onBack={() => router.push("/dashboard")}
		/>
	);
}
