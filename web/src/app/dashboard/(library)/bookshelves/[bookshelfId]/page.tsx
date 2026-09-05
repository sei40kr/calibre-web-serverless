"use client";

import type { Book } from "@calibre-web-serverless/domain/models/book";
import type { Bookshelf } from "@calibre-web-serverless/domain/models/bookshelf";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useCallback } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { BookGrid } from "@/components/BookGrid";
import { BookshelfNotFoundPage } from "@/components/pages/BookshelfNotFoundPage";
import { BookshelfPage } from "@/components/pages/BookshelfPage";
import { useBookCoverUrls } from "@/hooks/useBookCoverUrls";
import { useBookFilter } from "@/hooks/useBookFilter";
import { useBooks } from "@/hooks/useBooks";
import { useBookshelfMembership } from "@/hooks/useBookshelfMembership";
import { useBookshelves } from "@/hooks/useBookshelves";

export default function BookshelfRoute() {
	// Served as a static shell for any bookshelf id (see layout.tsx), so the route
	// params are a placeholder; derive the real id from the browser path.
	const pathname = usePathname();
	const bookshelfId = pathname?.match(/\/bookshelves\/([^/]+)/)?.[1] ?? "";

	return (
		<AuthGuard>
			{({ user, signOut }) => (
				<Suspense fallback={null}>
					<BookshelfRouteContent
						userId={user.uid}
						bookshelfId={bookshelfId}
						signOut={signOut}
					/>
				</Suspense>
			)}
		</AuthGuard>
	);
}

interface BookshelfRouteContentProps {
	userId: string;
	bookshelfId: string;
	signOut: () => void;
}

function BookshelfRouteContent({
	userId,
	bookshelfId,
	signOut,
}: BookshelfRouteContentProps) {
	const router = useRouter();
	const { bookshelves, loading: bookshelvesLoading } = useBookshelves(userId);
	const bookshelf =
		bookshelves.find((candidate) => candidate.id === bookshelfId) ?? null;

	// Only the sort is taken from the URL: a bookshelf view has no filters, and a
	// bookshelf scope cannot share a query with an array-dimension filter anyway.
	const { sort, setSort } = useBookFilter();
	const { books, loading } = useBooks(userId, undefined, sort, bookshelfId);
	const bookCoverInfos = useBookCoverUrls(books);

	const { setBookOnBookshelf } = useBookshelfMembership(userId);

	const handleRemoveBook = useCallback(
		async (book: Book) => {
			if (!bookshelf) return;
			await setBookOnBookshelf(book, bookshelf, false);
		},
		[bookshelf, setBookOnBookshelf],
	);

	const handleToggleBookshelf = useCallback(
		(book: Book, target: Bookshelf, member: boolean) =>
			setBookOnBookshelf(book, target, member),
		[setBookOnBookshelf],
	);

	const handleBack = useCallback(() => router.push("/dashboard"), [router]);

	if (bookshelvesLoading) {
		return <BookGrid books={[]} loading bookCoverInfos={{}} />;
	}

	if (!bookshelf) {
		return <BookshelfNotFoundPage onBack={handleBack} />;
	}

	return (
		<BookshelfPage
			bookshelf={bookshelf}
			books={books}
			loading={loading}
			bookCoverInfos={bookCoverInfos}
			bookshelves={bookshelves}
			sort={sort}
			onSortChange={setSort}
			onRemoveBook={handleRemoveBook}
			onToggleBookshelf={handleToggleBookshelf}
			onSignOut={signOut}
		/>
	);
}
