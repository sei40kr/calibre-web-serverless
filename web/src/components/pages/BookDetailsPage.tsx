"use client";

import type { Author } from "@calibre-web-serverless/domain/models/author";
import type { Book } from "@calibre-web-serverless/domain/models/book";
import type {
	BookFile,
	BookFileFormat,
} from "@calibre-web-serverless/domain/models/bookFile";
import type { Bookshelf } from "@calibre-web-serverless/domain/models/bookshelf";
import type { Publisher } from "@calibre-web-serverless/domain/models/publisher";
import {
	currentPosition,
	readingFraction,
} from "@calibre-web-serverless/domain/models/readingProgress";
import type { Series } from "@calibre-web-serverless/domain/models/series";
import type { Tag as BookTag } from "@calibre-web-serverless/domain/models/tag";
import {
	Badge,
	Box,
	Button,
	Link as ChakraLink,
	Container,
	DataList,
	Flex,
	Heading,
	HStack,
	IconButton,
	Image,
	Progress,
	RatingGroup,
	Stack,
	Text,
	VStack,
	Wrap,
} from "@chakra-ui/react";
import Link from "next/link";
import { useId, useState } from "react";
import {
	LuArrowLeft,
	LuBook,
	LuBookOpen,
	LuDownload,
	LuEllipsis,
	LuPencil,
} from "react-icons/lu";
import { BookActionsMenu } from "@/components/BookActionsMenu";
import { bookshelfHref } from "@/components/Sidebar";
import {
	DialogBody,
	DialogCloseTrigger,
	DialogContent,
	DialogHeader,
	DialogRoot,
	DialogTitle,
} from "@/components/ui/dialog";
import { Tag } from "@/components/ui/tag";
import {
	type BookFilter,
	defaultBookSort,
	emptyBookFilter,
	withArrayDimension,
} from "@/lib/bookFilter";
import { filterToSearchParams } from "@/lib/bookFilterParams";
import { formatAgo } from "@/lib/formatAgo";
import { readingTimeLeft } from "@/lib/timeLeft";
import { readableBookFormats, readerHref } from "./bookReaderPages";

export const bookDetailsHref = (bookId: string) => `/books/${bookId}`;

const libraryHref = (filter: BookFilter) =>
	`/dashboard?${filterToSearchParams(filter, defaultBookSort)}`;

/** "187 kB", "1.2 MB". */
const formatFileSize = (bytes: number) =>
	bytes < 1_000_000
		? `${Math.max(1, Math.round(bytes / 1000))} kB`
		: `${(bytes / 1_000_000).toFixed(1)} MB`;

export interface BookDetailsPageProps {
	book: Book;
	/** The book's authors, in credit order. */
	authors: Author[];
	series: Series | null;
	tags: BookTag[];
	publisher: Publisher | null;
	/** Every bookshelf, for the membership list and the "add to bookshelf" menu. */
	bookshelves: Bookshelf[];
	coverUrl: string | null;
	coverLoading: boolean;
	/** Reports its own failures; the page only shows the download as finished. */
	onDownload: (format: BookFileFormat) => Promise<void>;
	onDelete: () => Promise<void>;
	onToggleBookshelf: (bookshelf: Bookshelf, member: boolean) => Promise<void>;
	onMarkRead: () => void;
	onMarkUnread: () => void;
}

export function BookDetailsPage({
	book,
	authors,
	series,
	tags,
	publisher,
	bookshelves,
	coverUrl,
	coverLoading,
	onDownload,
	onDelete,
	onToggleBookshelf,
	onMarkRead,
	onMarkUnread,
}: BookDetailsPageProps) {
	const title = book.title || "Untitled";
	const fraction = readingFraction(book.reading);
	const memberBookshelves = bookshelves.filter((bookshelf) =>
		book.bookshelfIds.includes(bookshelf.id),
	);

	return (
		<Container maxW="container.lg" py={8}>
			<VStack gap={6} align="stretch">
				<HStack justify="space-between" flexWrap="wrap" gap={3}>
					<Button asChild variant="ghost" ms={-3}>
						<Link href="/dashboard">
							<LuArrowLeft />
							All Books
						</Link>
					</Button>
					<HStack gap={2}>
						<Button asChild variant="outline">
							<Link href={`/dashboard/books/${book.id}/edit`}>
								<LuPencil />
								Edit
							</Link>
						</Button>
						<BookActionsMenu
							book={book}
							trigger={
								<IconButton aria-label="Book actions" variant="outline">
									<LuEllipsis />
								</IconButton>
							}
							onDelete={onDelete}
							bookshelves={bookshelves}
							onToggleBookshelf={onToggleBookshelf}
							onMarkRead={onMarkRead}
							onMarkUnread={onMarkUnread}
						/>
					</HStack>
				</HStack>

				<Flex wrap="wrap" gap={10} align="flex-start">
					<Box
						flex="0 0 220px"
						position="relative"
						aspectRatio={2 / 3}
						borderRadius="md"
						overflow="hidden"
						bg="bg.muted"
						display="flex"
						alignItems="center"
						justifyContent="center"
					>
						{coverUrl ? (
							<Image
								src={coverUrl}
								alt={`Cover of ${title}`}
								width="100%"
								height="100%"
								objectFit="cover"
							/>
						) : (
							!coverLoading && (
								<LuBook size={48} color="var(--chakra-colors-fg-muted)" />
							)
						)}
						{fraction !== null && (
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
						)}
					</Box>

					<Stack flex="999 1 420px" minW={0} maxW="720px" gap={7}>
						<Stack gap={2}>
							<Heading as="h1" size="2xl">
								{title}
							</Heading>
							{authors.length > 0 && (
								<Text color="fg.muted">
									by{" "}
									{authors.map((author, i) => (
										<span key={author.id}>
											{i > 0 && ", "}
											<ChakraLink
												asChild
												colorPalette="blue"
												color="colorPalette.fg"
											>
												<Link
													href={libraryHref(
														withArrayDimension(emptyBookFilter, "authorIds", [
															author.id,
														]),
													)}
												>
													{author.name}
												</Link>
											</ChakraLink>
										</span>
									))}
								</Text>
							)}
							{(book.rating || tags.length > 0) && (
								<HStack flexWrap="wrap" gap={3} mt={1}>
									{book.rating ? (
										<RatingGroup.Root
											readOnly
											count={5}
											value={book.rating}
											size="sm"
											colorPalette="yellow"
											aria-label={`Rated ${book.rating} out of 5`}
										>
											<RatingGroup.Control />
										</RatingGroup.Root>
									) : null}
									{tags.length > 0 && (
										<Wrap gap={1.5}>
											{tags.map((tag) => (
												<Tag key={tag.id} asChild>
													<Link
														href={libraryHref(
															withArrayDimension(emptyBookFilter, "tagIds", [
																tag.id,
															]),
														)}
													>
														{tag.name}
													</Link>
												</Tag>
											))}
										</Wrap>
									)}
								</HStack>
							)}
						</Stack>

						<ReadingSection book={book} />

						{book.description && (
							<Stack as="section" gap={2}>
								<Heading as="h2" size="md">
									Description
								</Heading>
								<Text textStyle="sm" whiteSpace="pre-wrap">
									{book.description}
								</Text>
							</Stack>
						)}

						<Stack as="section" gap={2}>
							<Heading as="h2" size="md">
								Details
							</Heading>
							<DataList.Root orientation="horizontal" size="md">
								{series && (
									<DataList.Item>
										<DataList.ItemLabel>Series</DataList.ItemLabel>
										<DataList.ItemValue>
											<ChakraLink
												asChild
												colorPalette="blue"
												color="colorPalette.fg"
											>
												<Link
													href={libraryHref({
														...emptyBookFilter,
														seriesIds: [series.id],
													})}
												>
													{series.name} #{book.seriesIndex}
												</Link>
											</ChakraLink>
										</DataList.ItemValue>
									</DataList.Item>
								)}
								{publisher && (
									<DataList.Item>
										<DataList.ItemLabel>Publisher</DataList.ItemLabel>
										<DataList.ItemValue>
											<ChakraLink
												asChild
												colorPalette="blue"
												color="colorPalette.fg"
											>
												<Link
													href={libraryHref({
														...emptyBookFilter,
														publisherIds: [publisher.id],
													})}
												>
													{publisher.name}
												</Link>
											</ChakraLink>
										</DataList.ItemValue>
									</DataList.Item>
								)}
								{book.pubDate && (
									<DataList.Item>
										<DataList.ItemLabel>Published</DataList.ItemLabel>
										<DataList.ItemValue>
											{book.pubDate.toLocaleDateString(undefined, {
												dateStyle: "long",
											})}
										</DataList.ItemValue>
									</DataList.Item>
								)}
								{book.languages.length > 0 && (
									<DataList.Item>
										<DataList.ItemLabel>Language</DataList.ItemLabel>
										<DataList.ItemValue>
											{book.languages
												.map((language) => language.name)
												.join(", ")}
										</DataList.ItemValue>
									</DataList.Item>
								)}
								{book.identifiers.length > 0 && (
									<DataList.Item>
										<DataList.ItemLabel>Identifiers</DataList.ItemLabel>
										<DataList.ItemValue>
											<Stack gap={0.5}>
												{book.identifiers.map((identifier) => (
													<Text
														key={`${identifier.type.value}:${identifier.value}`}
													>
														<Text as="span" color="fg.muted">
															{identifier.type.name}
														</Text>{" "}
														<Text as="span" fontFamily="mono">
															{identifier.value}
														</Text>
													</Text>
												))}
											</Stack>
										</DataList.ItemValue>
									</DataList.Item>
								)}
								{memberBookshelves.length > 0 && (
									<DataList.Item>
										<DataList.ItemLabel>Bookshelves</DataList.ItemLabel>
										<DataList.ItemValue>
											<Wrap gap={1.5}>
												{memberBookshelves.map((bookshelf) => (
													<Tag key={bookshelf.id} asChild>
														<Link href={bookshelfHref(bookshelf.id)}>
															{bookshelf.name}
														</Link>
													</Tag>
												))}
											</Wrap>
										</DataList.ItemValue>
									</DataList.Item>
								)}
							</DataList.Root>
						</Stack>

						<Stack as="section" gap={2}>
							<Heading as="h2" size="md">
								Files
							</Heading>
							<Stack
								as="ul"
								listStyleType="none"
								gap={0}
								borderWidth="1px"
								borderRadius="l3"
								divideY="1px"
							>
								{book.files.map((file) => (
									<FileRow
										key={file.format}
										file={file}
										onDownload={() => onDownload(file.format)}
									/>
								))}
							</Stack>
						</Stack>
					</Stack>
				</Flex>
			</VStack>
		</Container>
	);
}

function ReadingSection({ book }: { book: Book }) {
	const headingId = useId();
	const [isFormatDialogOpen, setIsFormatDialogOpen] = useState(false);
	const { reading } = book;
	const fraction = readingFraction(reading);
	const position = currentPosition(reading);
	const timeLeft = readingTimeLeft(reading);

	// The format read last may have been removed since; fall back to another.
	const formats = readableBookFormats(book.files);
	const lastFormat = reading.status === "unread" ? null : reading.lastFormat;
	const format = formats.find((f) => f === lastFormat) ?? formats[0];

	const where =
		reading.status === "unread"
			? "Not started"
			: reading.status === "read"
				? "Finished"
				: position && "chapterNo" in position
					? (position.chapterTitle ?? `Chapter ${position.chapterNo}`)
					: position
						? `Page ${position.pageNo} of ${position.pageCount}`
						: null;
	const meta = [
		timeLeft,
		reading.status !== "unread" && `Last read ${formatAgo(reading.lastReadAt)}`,
	].filter(Boolean);

	return (
		<Stack
			as="section"
			aria-labelledby={headingId}
			gap={2}
			p={4}
			borderWidth="1px"
			borderRadius="l3"
		>
			<Heading as="h2" id={headingId} size="sm">
				Reading progress
			</Heading>
			{where && <Text textStyle="sm">{where}</Text>}
			{fraction !== null && (
				<HStack gap={3}>
					<Progress.Root
						flex="1"
						size="sm"
						value={fraction * 100}
						colorPalette="blue"
					>
						<Progress.Track borderRadius="full" aria-label="Reading progress">
							<Progress.Range />
						</Progress.Track>
					</Progress.Root>
					<Text
						textStyle="sm"
						fontWeight="medium"
						fontVariantNumeric="tabular-nums"
					>
						{Math.round(fraction * 100)}%
					</Text>
				</HStack>
			)}
			{meta.length > 0 && (
				<Text textStyle="xs" color="fg.muted">
					{meta.join(" · ")}
				</Text>
			)}
			{format && (
				<Wrap gap={2} mt={2}>
					<Button asChild colorPalette="blue">
						<Link href={readerHref(book, format)}>
							<LuBookOpen />
							{reading.status === "unread" ? "Read" : "Continue reading"}
						</Link>
					</Button>
					{formats.length > 1 && (
						<Button
							variant="outline"
							onClick={() => setIsFormatDialogOpen(true)}
						>
							Read in another format
						</Button>
					)}
				</Wrap>
			)}

			<DialogRoot
				open={isFormatDialogOpen}
				onOpenChange={(e) => setIsFormatDialogOpen(e.open)}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Read Book</DialogTitle>
					</DialogHeader>
					<DialogBody>
						<Text mb={4}>Choose a format to read.</Text>
						<VStack gap={2} align="stretch">
							{formats.map((f) => (
								<Button key={f} asChild variant="outline">
									<Link href={readerHref(book, f)}>{f.toUpperCase()}</Link>
								</Button>
							))}
						</VStack>
					</DialogBody>
					<DialogCloseTrigger />
				</DialogContent>
			</DialogRoot>
		</Stack>
	);
}

function FileRow({
	file,
	onDownload,
}: {
	file: BookFile;
	onDownload: () => Promise<void>;
}) {
	const [downloading, setDownloading] = useState(false);
	const label = file.format.toUpperCase();

	const handleDownload = async () => {
		setDownloading(true);
		try {
			await onDownload();
		} catch {
			// Surfaced by the caller.
		} finally {
			setDownloading(false);
		}
	};

	return (
		<HStack as="li" gap={3} py={2} ps={4} pe={2}>
			<Badge colorPalette="blue">{label}</Badge>
			<Text flex="1" textStyle="sm" color="fg.muted">
				{file.status === "ready"
					? formatFileSize(file.fileSize)
					: file.status === "processing"
						? "Processing..."
						: "Processing failed"}
			</Text>
			<IconButton
				aria-label={`Download ${label}`}
				variant="ghost"
				size="sm"
				disabled={file.status !== "ready"}
				loading={downloading}
				onClick={handleDownload}
			>
				<LuDownload />
			</IconButton>
		</HStack>
	);
}
