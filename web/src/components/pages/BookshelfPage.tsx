"use client";

import type { Book } from "@calibre-web-serverless/domain/models/book";
import type { Bookshelf } from "@calibre-web-serverless/domain/models/bookshelf";
import {
	Button,
	Container,
	Heading,
	HStack,
	Text,
	VStack,
} from "@chakra-ui/react";
import { LuBookmark } from "react-icons/lu";
import { BookGrid } from "@/components/BookGrid";
import { BookSortSelect } from "@/components/BookSortSelect";
import { EmptyState } from "@/components/ui/empty-state";
import type { BookSort } from "@/lib/bookFilter";

interface BookCoverInfo {
	coverUrl: string | null;
	loading: boolean;
}

export interface BookshelfPageProps {
	bookshelf: Bookshelf;
	/** The books on the bookshelf, already sorted. */
	books: Book[];
	loading: boolean;
	bookCoverInfos: Record<string, BookCoverInfo>;
	/** Every bookshelf, for the per-book "add to bookshelf" menu. */
	bookshelves: Bookshelf[];
	sort: BookSort;
	onSortChange: (sort: BookSort) => void;
	onRemoveBook: (book: Book) => Promise<void>;
	onToggleBookshelf: (
		book: Book,
		bookshelf: Bookshelf,
		member: boolean,
	) => Promise<void>;
	onSignOut: () => void;
}

export function BookshelfPage({
	bookshelf,
	books,
	loading,
	bookCoverInfos,
	bookshelves,
	sort,
	onSortChange,
	onRemoveBook,
	onToggleBookshelf,
	onSignOut,
}: BookshelfPageProps) {
	return (
		<Container maxW="container.lg" py={8}>
			<VStack gap={6} align="stretch">
				<HStack justify="space-between" align="center" flexWrap="wrap" gap={3}>
					<VStack align="start" gap={0} minW={0}>
						<Heading size="xl" lineClamp={1}>
							{bookshelf.name}
						</Heading>
						<Text color="fg.muted" fontSize="sm">
							{bookshelf.bookCount}{" "}
							{bookshelf.bookCount === 1 ? "book" : "books"}
						</Text>
					</VStack>
					<Button variant="outline" flexShrink={0} onClick={onSignOut}>
						Logout
					</Button>
				</HStack>

				{!loading && books.length > 0 && (
					<HStack justify="flex-end">
						<BookSortSelect sort={sort} onSortChange={onSortChange} />
					</HStack>
				)}

				<BookGrid
					books={books}
					loading={loading}
					bookCoverInfos={bookCoverInfos}
					bookshelves={bookshelves}
					onToggleBookshelf={onToggleBookshelf}
					onRemoveFromBookshelf={onRemoveBook}
					emptyState={
						<EmptyState
							icon={<LuBookmark />}
							title="This bookshelf is empty"
							description="Add books from your library to see them here"
						/>
					}
				/>
			</VStack>
		</Container>
	);
}
