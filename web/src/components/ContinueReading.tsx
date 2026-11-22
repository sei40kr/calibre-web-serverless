"use client";

import type { Book } from "@calibre-web-serverless/domain/models/book";
import {
	currentPosition,
	readingFraction,
} from "@calibre-web-serverless/domain/models/readingProgress";
import {
	Box,
	Heading,
	HStack,
	Image,
	Progress,
	SimpleGrid,
	Stack,
	Text,
} from "@chakra-ui/react";
import Link from "next/link";
import { useId } from "react";
import {
	readableBookFormats,
	readerHref,
} from "@/components/pages/bookReaderPages";
import { readingTimeLeft } from "@/lib/timeLeft";

interface ContinueReadingProps {
	/** Books being read, in the order to show them. Renders nothing when empty. */
	books: Book[];
	bookCoverInfos: Record<string, { coverUrl: string | null }>;
}

/** A row of the books being read, each opening the reader where it was left. */
export function ContinueReading({
	books,
	bookCoverInfos,
}: ContinueReadingProps) {
	const titleId = useId();
	if (books.length === 0) return null;

	return (
		<Stack as="section" aria-labelledby={titleId} gap={3}>
			<Heading id={titleId} size="md">
				Continue reading
			</Heading>
			{/* auto-fill keeps empty tracks, so a lone book stays one column wide. */}
			<SimpleGrid
				templateColumns="repeat(auto-fill, minmax(280px, 1fr))"
				gap={4}
			>
				{books.map((book) => (
					<ContinueReadingItem
						key={book.id}
						book={book}
						coverUrl={bookCoverInfos[book.id]?.coverUrl ?? null}
					/>
				))}
			</SimpleGrid>
		</Stack>
	);
}

function ContinueReadingItem({
	book,
	coverUrl,
}: {
	book: Book;
	coverUrl: string | null;
}) {
	const title = book.title || "Untitled";
	const lastFormat =
		book.reading.status === "unread" ? null : book.reading.lastFormat;
	const position = currentPosition(book.reading);
	const chapterTitle =
		position && "chapterTitle" in position ? position.chapterTitle : null;
	const percent = Math.round((readingFraction(book.reading) ?? 0) * 100);
	const timeLeft = readingTimeLeft(book.reading);

	// The format read last may have been removed since; fall back to another.
	const formats = readableBookFormats(book.files);
	const format = formats.find((f) => f === lastFormat) ?? formats[0];

	const content = (
		<HStack
			gap={3}
			p={3}
			bg="bg.panel"
			borderWidth="1px"
			borderRadius="l3"
			align="stretch"
		>
			<Box
				width="48px"
				height="72px"
				flexShrink={0}
				bg="bg.muted"
				borderRadius="sm"
				overflow="hidden"
			>
				{coverUrl && (
					<Image
						src={coverUrl}
						alt=""
						width="100%"
						height="100%"
						objectFit="cover"
					/>
				)}
			</Box>
			<Stack flex="1" minW={0} justify="center" gap={1.5}>
				<Text textStyle="sm" fontWeight="medium" truncate title={title}>
					{title}
				</Text>
				{chapterTitle && (
					<Text textStyle="xs" color="fg.muted" truncate title={chapterTitle}>
						{chapterTitle}
					</Text>
				)}
				<HStack gap={2}>
					<Progress.Root flex="1" size="xs" value={percent} colorPalette="blue">
						<Progress.Track
							borderRadius="full"
							aria-label={`${title} reading progress`}
						>
							<Progress.Range />
						</Progress.Track>
					</Progress.Root>
					<Text
						textStyle="xs"
						color="fg.muted"
						fontVariantNumeric="tabular-nums"
					>
						{percent}%
					</Text>
				</HStack>
				{timeLeft && (
					<Text textStyle="xs" color="fg.muted">
						{timeLeft}
					</Text>
				)}
			</Stack>
		</HStack>
	);

	return format ? (
		<Link href={readerHref(book, format)}>{content}</Link>
	) : (
		content
	);
}
