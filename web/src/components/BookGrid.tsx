import type { Book } from "@calibre-web-serverless/domain/models/book";
import type { Bookshelf } from "@calibre-web-serverless/domain/models/bookshelf";
import { Box, SimpleGrid, Skeleton, VStack } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { LuBookOpen, LuSearchX } from "react-icons/lu";
import { BookCard } from "./BookCard";
import { EmptyState } from "./ui/empty-state";

interface BookCoverInfo {
	coverUrl: string | null;
	loading: boolean;
}

interface BookGridProps {
	books: Book[];
	loading: boolean;
	bookCoverInfos: Record<string, BookCoverInfo>;
	/** Offers to delete books from the library. Omit to hide the action. */
	onDeleteBook?: (book: Book) => Promise<void>;
	/** When true, an empty result is shown as "no matches" rather than "no books". */
	isFiltering?: boolean;
	/** Bookshelves offered in each card's "add to bookshelf" menu. */
	bookshelves?: Bookshelf[];
	onToggleBookshelf?: (
		book: Book,
		bookshelf: Bookshelf,
		member: boolean,
	) => Promise<void>;
	/** Offers to take each book off the bookshelf being viewed. */
	onRemoveFromBookshelf?: (book: Book) => Promise<void>;
	/** Replaces the default "no books" state (e.g. for an empty bookshelf). */
	emptyState?: ReactNode;
}

function BookCardSkeleton() {
	return (
		<Box>
			<Skeleton aspectRatio={2 / 3} borderRadius="md" />
			<VStack align="start" gap={1} mt={3}>
				<Skeleton height={5} width="100%" />
				<Skeleton height={4} width="40px" />
			</VStack>
		</Box>
	);
}

export function BookGrid({
	books,
	loading,
	bookCoverInfos,
	onDeleteBook,
	isFiltering = false,
	bookshelves,
	onToggleBookshelf,
	onRemoveFromBookshelf,
	emptyState,
}: BookGridProps) {
	if (loading) {
		return (
			<SimpleGrid columns={{ base: 2, sm: 3, md: 4, lg: 5, xl: 6 }} gap={4}>
				{Array.from({ length: 8 }).map((_, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: static skeleton items
					<BookCardSkeleton key={i} />
				))}
			</SimpleGrid>
		);
	}

	if (books.length === 0) {
		if (isFiltering) {
			return (
				<EmptyState
					icon={<LuSearchX />}
					title="No matching books"
					description="Try adjusting or clearing your filters"
				/>
			);
		}
		return (
			emptyState ?? (
				<EmptyState
					icon={<LuBookOpen />}
					title="No books yet"
					description="Upload your first book to get started"
				/>
			)
		);
	}

	return (
		<SimpleGrid columns={{ base: 2, sm: 3, md: 4, lg: 5, xl: 6 }} gap={4}>
			{books.map((book) => {
				const coverInfo = bookCoverInfos[book.id];
				return (
					<BookCard
						key={book.id}
						book={book}
						coverUrl={coverInfo?.coverUrl ?? null}
						coverLoading={coverInfo?.loading ?? false}
						onDelete={onDeleteBook ? () => onDeleteBook(book) : undefined}
						bookshelves={bookshelves}
						onToggleBookshelf={
							onToggleBookshelf
								? (bookshelf, member) =>
										onToggleBookshelf(book, bookshelf, member)
								: undefined
						}
						onRemoveFromBookshelf={
							onRemoveFromBookshelf
								? () => onRemoveFromBookshelf(book)
								: undefined
						}
					/>
				);
			})}
		</SimpleGrid>
	);
}
