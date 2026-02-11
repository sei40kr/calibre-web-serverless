import type { Book } from "@calibre-web-serverless/domain/models/book";
import {
	Badge,
	Box,
	Card,
	IconButton,
	Image,
	Skeleton,
	Text,
	VStack,
} from "@chakra-ui/react";
import Link from "next/link";
import { LuBook, LuPencil } from "react-icons/lu";

interface BookCardProps {
	book: Book;
	coverUrl: string | null;
	coverLoading: boolean;
}

export function BookCard({ book, coverUrl, coverLoading }: BookCardProps) {
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
				overflow="hidden"
			>
				{coverLoading ? (
					<Skeleton width="100%" height="100%" />
				) : coverUrl ? (
					<Image
						src={coverUrl}
						alt={book.title || "Book cover"}
						width="100%"
						height="100%"
						objectFit="cover"
					/>
				) : (
					<LuBook size={48} color="var(--chakra-colors-fg-muted)" />
				)}
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
