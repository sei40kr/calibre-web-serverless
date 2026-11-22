"use client";

import type { Book } from "@calibre-web-serverless/domain/models/book";
import { readyFiles } from "@calibre-web-serverless/domain/models/bookFile";
import type { Bookshelf } from "@calibre-web-serverless/domain/models/bookshelf";
import { readingFraction } from "@calibre-web-serverless/domain/models/readingProgress";
import {
	Badge,
	Box,
	Card,
	HStack,
	IconButton,
	Image,
	Progress,
	Skeleton,
	Text,
	VStack,
	Wrap,
} from "@chakra-ui/react";
import Link from "next/link";
import {
	LuBook,
	LuCheck,
	LuClock,
	LuEllipsis,
	LuTriangleAlert,
} from "react-icons/lu";
import { BookActionsMenu } from "@/components/BookActionsMenu";
import { bookDetailsHref } from "@/components/pages/BookDetailsPage";
import { readingTimeLeft } from "@/lib/timeLeft";

interface BookCardProps {
	book: Book;
	coverUrl: string | null;
	coverLoading: boolean;
	/** Offers to delete the book from the library. Omit to hide the action. */
	onDelete?: () => Promise<void>;
	/**
	 * The user's bookshelves, offered in an "add to bookshelf" menu that reflects the
	 * book's current membership. Omit (with `onToggleBookshelf`) to hide the menu.
	 */
	bookshelves?: Bookshelf[];
	/** `member` is the desired state: true to add, false to remove. */
	onToggleBookshelf?: (bookshelf: Bookshelf, member: boolean) => Promise<void>;
	/** Offers to take the book off the bookshelf being viewed. */
	onRemoveFromBookshelf?: () => Promise<void>;
	/** Offers to mark a book not yet read as read. Omit to hide the action. */
	onMarkRead?: () => void;
	/** Offers to clear a started book's reading progress. Omit to hide it. */
	onMarkUnread?: () => void;
}

export function BookCard({
	book,
	coverUrl,
	coverLoading,
	onDelete,
	bookshelves,
	onToggleBookshelf,
	onRemoveFromBookshelf,
	onMarkRead,
	onMarkUnread,
}: BookCardProps) {
	const isProcessing = book.status === "processing";
	const isError = book.status === "error";
	const title = book.title || "Untitled";

	const fraction = readingFraction(book.reading);
	const timeLeft = readingTimeLeft(book.reading);
	const cover = (
		<Box
			bg="bg.muted"
			aspectRatio={2 / 3}
			display="flex"
			alignItems="center"
			justifyContent="center"
			overflow="hidden"
			position="relative"
		>
			{isProcessing ? (
				<Skeleton width="100%" height="100%" />
			) : isError ? (
				<LuTriangleAlert size={48} color="var(--chakra-colors-fg-muted)" />
			) : coverLoading ? (
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
			{fraction !== null && (
				<>
					{book.reading.status === "read" ? (
						<Badge
							position="absolute"
							left={2}
							bottom={3}
							boxSize={5}
							justifyContent="center"
							px={0}
							bg="blackAlpha.700"
							color="white"
							role="img"
							aria-label="Read"
						>
							<LuCheck strokeWidth={2.5} aria-hidden />
						</Badge>
					) : (
						<Badge
							position="absolute"
							left={2}
							bottom={3}
							bg="blackAlpha.700"
							color="white"
							fontVariantNumeric="tabular-nums"
						>
							{Math.round(fraction * 100)}%
						</Badge>
					)}
					<Progress.Root
						position="absolute"
						insetX={0}
						bottom={0}
						size="xs"
						value={fraction * 100}
						colorPalette="blue"
						aria-hidden
					>
						<Progress.Track borderRadius={0} bg="blackAlpha.500">
							<Progress.Range />
						</Progress.Track>
					</Progress.Root>
				</>
			)}
		</Box>
	);

	return (
		<Card.Root
			overflow="hidden"
			_hover={{ shadow: "md", transform: "translateY(-2px)" }}
			transition="all 0.2s"
			position="relative"
		>
			{/* A processing book has nothing to show yet, so it links nowhere. */}
			{isProcessing ? (
				cover
			) : (
				<Link
					href={bookDetailsHref(book.id)}
					aria-label={`View details for ${title}`}
				>
					{cover}
				</Link>
			)}
			<Card.Body p={3}>
				<VStack align="start" gap={1}>
					<Text fontWeight="medium" lineClamp={2} title={book.title}>
						{isProcessing ? (
							"Processing..."
						) : (
							<Link href={bookDetailsHref(book.id)}>{title}</Link>
						)}
					</Text>
					<Wrap gap={1}>
						{readyFiles(book.files).map((file) => (
							<Badge key={file.format} size="sm" colorPalette="blue">
								{file.format.toUpperCase()}
							</Badge>
						))}
					</Wrap>
					{timeLeft && (
						<HStack gap={1} textStyle="xs" color="fg.muted">
							<LuClock aria-hidden />
							{timeLeft}
						</HStack>
					)}
				</VStack>
			</Card.Body>

			{!isProcessing && (
				<Box position="absolute" top={2} right={2}>
					<BookActionsMenu
						book={book}
						trigger={
							<IconButton
								aria-label="Book actions"
								variant="surface"
								size="sm"
								rounded="full"
							>
								<LuEllipsis />
							</IconButton>
						}
						editHref={`/dashboard/books/${book.id}/edit`}
						onDelete={onDelete}
						bookshelves={bookshelves}
						onToggleBookshelf={onToggleBookshelf}
						onRemoveFromBookshelf={onRemoveFromBookshelf}
						onMarkRead={onMarkRead}
						onMarkUnread={onMarkUnread}
					/>
				</Box>
			)}
		</Card.Root>
	);
}
