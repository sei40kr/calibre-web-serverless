"use client";

import type { BookFileFormat } from "@calibre-web-serverless/domain/models/bookFile";
import type { Bookshelf } from "@calibre-web-serverless/domain/models/bookshelf";
import { bookFileRepository } from "@calibre-web-serverless/infrastructure/repositories/bookFileRepository";
import { bookRepository } from "@calibre-web-serverless/infrastructure/repositories/bookRepository";
import { Center, Spinner } from "@chakra-ui/react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { BookDetailsPage } from "@/components/pages/BookDetailsPage";
import { BookNotFoundPage } from "@/components/pages/BookNotFoundPage";
import { toaster } from "@/components/ui/toaster";
import { useAuthors } from "@/hooks/useAuthors";
import { useBook } from "@/hooks/useBook";
import { useBookCoverUrl } from "@/hooks/useBookCoverUrl";
import { useBookshelfMembership } from "@/hooks/useBookshelfMembership";
import { useBookshelves } from "@/hooks/useBookshelves";
import { usePublishers } from "@/hooks/usePublishers";
import { useReadingStatus } from "@/hooks/useReadingStatus";
import { useSeries } from "@/hooks/useSeries";
import { useTags } from "@/hooks/useTags";

export default function BookDetailsRoute() {
	// Served as a static shell for any book id (see layout.tsx), so the route
	// params are a placeholder; derive the real id from the browser path.
	const pathname = usePathname();
	const bookId = pathname?.match(/\/books\/([^/]+)/)?.[1] ?? "";

	return (
		<AuthGuard>
			{({ user }) => (
				<BookDetailsRouteContent userId={user.uid} bookId={bookId} />
			)}
		</AuthGuard>
	);
}

function BookDetailsRouteContent({
	userId,
	bookId,
}: {
	userId: string;
	bookId: string;
}) {
	const router = useRouter();
	const { book, loading, error } = useBook(userId, bookId);
	const { authors } = useAuthors(userId);
	const { series } = useSeries(userId);
	const { tags } = useTags(userId);
	const { publishers } = usePublishers(userId);
	const { bookshelves } = useBookshelves(userId);
	const { coverUrl, loading: coverLoading } = useBookCoverUrl(
		userId,
		bookId,
		book?.hasCover ?? false,
		book?.hasCustomCover ?? false,
		book?.updatedAt?.getTime(),
	);
	const { setBookOnBookshelf } = useBookshelfMembership(userId);
	const { markRead, markUnread } = useReadingStatus(userId);

	const handleDownload = useCallback(
		async (format: BookFileFormat) => {
			try {
				const url = await bookFileRepository.getBookFileDownloadUrl(
					userId,
					bookId,
					format,
				);
				const a = document.createElement("a");
				a.href = url;
				a.download = `${book?.title || "book"}.${format}`;
				a.click();
				URL.revokeObjectURL(url);
			} catch (err) {
				toaster.error({
					title: "Download failed",
					description: "Please try again.",
				});
				throw err;
			}
		},
		[userId, bookId, book?.title],
	);

	const handleDelete = useCallback(async () => {
		try {
			await bookRepository.deleteBook(userId, bookId);
		} catch (err) {
			toaster.error({
				title: "Failed to delete book",
				description: "Please try again.",
			});
			throw err;
		}
		toaster.success({
			title: "Book deleted",
			description: `"${book?.title || "Untitled"}" has been deleted.`,
		});
		router.push("/dashboard");
	}, [userId, bookId, book?.title, router]);

	const handleToggleBookshelf = useCallback(
		async (bookshelf: Bookshelf, member: boolean) => {
			if (book) await setBookOnBookshelf(book, bookshelf, member);
		},
		[book, setBookOnBookshelf],
	);

	if (loading) {
		return (
			<Center py={16}>
				<Spinner size="lg" />
			</Center>
		);
	}

	if (error || !book) {
		return <BookNotFoundPage onBack={() => router.push("/dashboard")} />;
	}

	return (
		<BookDetailsPage
			book={book}
			authors={book.authorIds.flatMap(
				(id) => authors.find((a) => a.id === id) ?? [],
			)}
			series={series.find((s) => s.id === book.seriesId) ?? null}
			tags={book.tagIds.flatMap((id) => tags.find((t) => t.id === id) ?? [])}
			publisher={publishers.find((p) => p.id === book.publisherId) ?? null}
			bookshelves={bookshelves}
			coverUrl={coverUrl}
			coverLoading={coverLoading}
			onDownload={handleDownload}
			onDelete={handleDelete}
			onToggleBookshelf={handleToggleBookshelf}
			onMarkRead={() => markRead(book)}
			onMarkUnread={() => markUnread(book)}
		/>
	);
}
