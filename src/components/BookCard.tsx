"use client";

import { Badge, Box, Card, Text, VStack } from "@chakra-ui/react";
import { LuBook } from "react-icons/lu";
import type { Book } from "@/types/book";

interface BookCardProps {
	book: Book;
}

export function BookCard({ book }: BookCardProps) {
	return (
		<Card.Root
			overflow="hidden"
			cursor="pointer"
			_hover={{ shadow: "md", transform: "translateY(-2px)" }}
			transition="all 0.2s"
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
		</Card.Root>
	);
}
