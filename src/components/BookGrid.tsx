"use client";

import { Box, SimpleGrid, Skeleton, VStack } from "@chakra-ui/react";
import { LuBookOpen } from "react-icons/lu";
import type { Book } from "@/types/book";
import { BookCard } from "./BookCard";
import { EmptyState } from "./ui/empty-state";

interface BookGridProps {
	books: Book[];
	loading: boolean;
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

export function BookGrid({ books, loading }: BookGridProps) {
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
		return (
			<EmptyState
				icon={<LuBookOpen />}
				title="No books yet"
				description="Upload your first book to get started"
			/>
		);
	}

	return (
		<SimpleGrid columns={{ base: 2, sm: 3, md: 4, lg: 5, xl: 6 }} gap={4}>
			{books.map((book) => (
				<BookCard key={book.id} book={book} />
			))}
		</SimpleGrid>
	);
}
