"use client";

import { readyFiles } from "@calibre-web-serverless/domain/models/bookFile";
import { Center, Spinner } from "@chakra-ui/react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { BookNotFoundPage } from "@/components/pages/BookNotFoundPage";
import { BookReaderPage } from "@/components/pages/BookReaderPage";
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
				<BookReaderRouteContent
					userId={user.uid}
					bookId={bookId}
					pageNo={pageNo}
				/>
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
	const { book, loading, error } = useBook(userId, bookId);
	const hasPdfFile = book
		? readyFiles(book.files).some((file) => file.format === "pdf")
		: false;
	const { fileUrl, loading: fileLoading } = useBookFileUrl(
		userId,
		bookId,
		"pdf",
		hasPdfFile,
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
			router.replace(`/books/${bookId}/pages/${nextPageNo}`);
		},
		[router, bookId],
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

	return (
		<BookReaderPage
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
