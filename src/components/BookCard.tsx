"use client";

import { Badge, Box, Card, IconButton, Text, VStack } from "@chakra-ui/react";
import Link from "next/link";
import { LuBook, LuPencil } from "react-icons/lu";
import type { Book } from "@/models/book";

interface BookCardProps {
	book: Book;
}

export function BookCard({ book }: BookCardProps) {
	return (
		<Card.Root
			overflow="hidden"
			_hover={{ shadow: "md", transform: "translateY(-2px)" }}
			transition="all 0.2s"
			position="relative"
		>
			<Box
				bg="bg.muted"
				aspectRatio={2 / 3}
				display="flex"
				alignItems="center"
				justifyContent="center"
			>
				<LuBook size={48} color="var(--chakra-colors-fg-muted)" />
			</Box>
			<Card.Body p={3}>
				<VStack align="start" gap={1}>
					<Text fontWeight="medium" lineClamp={2} title={book.title}>
						{book.title}
					</Text>
					<Badge size="sm" colorPalette="blue">
						{book.format.toUpperCase()}
					</Badge>
				</VStack>
			</Card.Body>

			<Box position="absolute" top={2} right={2}>
				<IconButton
					asChild
					aria-label="Edit book"
					variant="solid"
					size="sm"
					rounded="full"
				>
					<Link href={`/dashboard/books/${book.id}/edit`}>
						<LuPencil />
					</Link>
				</IconButton>
			</Box>
		</Card.Root>
	);
}
