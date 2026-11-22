"use client";

import type { Book } from "@calibre-web-serverless/domain/models/book";
import { readyFiles } from "@calibre-web-serverless/domain/models/bookFile";
import {
	type Bookshelf,
	isBookInBookshelf,
} from "@calibre-web-serverless/domain/models/bookshelf";
import { readingFraction } from "@calibre-web-serverless/domain/models/readingProgress";
import {
	Badge,
	Box,
	Button,
	Card,
	HStack,
	IconButton,
	Image,
	Menu,
	Portal,
	Progress,
	Skeleton,
	Span,
	Text,
	VStack,
	Wrap,
} from "@chakra-ui/react";
import Link from "next/link";
import { useState } from "react";
import {
	LuBook,
	LuBookmark,
	LuBookmarkMinus,
	LuCheck,
	LuChevronRight,
	LuClock,
	LuEllipsis,
	LuPencil,
	LuRotateCcw,
	LuTrash2,
	LuTriangleAlert,
} from "react-icons/lu";
import {
	readableBookFormats,
	readerHref,
} from "@/components/pages/bookReaderPages";
import {
	DialogBody,
	DialogCloseTrigger,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogRoot,
	DialogTitle,
} from "@/components/ui/dialog";
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
	const readableFormats = readableBookFormats(book.files);
	const [isFormatDialogOpen, setIsFormatDialogOpen] = useState(false);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [isRemoving, setIsRemoving] = useState(false);

	const handleDelete = async () => {
		if (!onDelete) return;
		setIsDeleting(true);
		try {
			await onDelete();
			setIsDeleteDialogOpen(false);
		} catch {
			// Keep the dialog open so the user can retry; the failure is surfaced
			// by the caller (e.g. a toast).
		} finally {
			setIsDeleting(false);
		}
	};

	const handleRemoveFromBookshelf = async () => {
		if (!onRemoveFromBookshelf) return;
		setIsRemoving(true);
		try {
			await onRemoveFromBookshelf();
		} catch {
			// Surfaced by the caller.
		} finally {
			setIsRemoving(false);
		}
	};

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
			{/* The cover doubles as the entry into the reader. With several
			    readable formats it opens a chooser dialog instead of linking
			    directly. */}
			{readableFormats.length === 1 ? (
				<Link
					href={readerHref(book, readableFormats[0])}
					aria-label="Read book"
				>
					{cover}
				</Link>
			) : readableFormats.length > 1 ? (
				<Box asChild cursor="pointer" width="100%">
					<button
						type="button"
						aria-label="Read book"
						onClick={() => setIsFormatDialogOpen(true)}
					>
						{cover}
					</button>
				</Box>
			) : (
				cover
			)}
			<Card.Body p={3}>
				<VStack align="start" gap={1}>
					<Text fontWeight="medium" lineClamp={2} title={book.title}>
						{isProcessing ? "Processing..." : book.title || "Untitled"}
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
					<Menu.Root positioning={{ placement: "bottom-end" }}>
						<Menu.Trigger asChild>
							<IconButton
								aria-label="Book actions"
								variant="surface"
								size="sm"
								rounded="full"
							>
								<LuEllipsis />
							</IconButton>
						</Menu.Trigger>
						<Portal>
							<Menu.Positioner>
								<Menu.Content minW="13rem">
									<Menu.Item value="edit" asChild>
										<Link href={`/dashboard/books/${book.id}/edit`}>
											<LuPencil />
											Edit
										</Link>
									</Menu.Item>
									{bookshelves && onToggleBookshelf && (
										<Menu.Root
											closeOnSelect={false}
											positioning={{ placement: "right-start", gutter: 2 }}
										>
											<Menu.TriggerItem>
												<LuBookmark />
												<Box flex="1">Add to bookshelf</Box>
												<LuChevronRight />
											</Menu.TriggerItem>
											<Portal>
												<Menu.Positioner>
													<Menu.Content>
														<Menu.ItemGroup>
															<Menu.ItemGroupLabel>
																Bookshelves
															</Menu.ItemGroupLabel>
															{bookshelves.length === 0 ? (
																<Menu.Item value="none" disabled>
																	No bookshelves yet
																</Menu.Item>
															) : (
																bookshelves.map((bookshelf) => {
																	const member = isBookInBookshelf(
																		book,
																		bookshelf.id,
																	);
																	return (
																		<Menu.CheckboxItem
																			key={bookshelf.id}
																			value={bookshelf.id}
																			checked={member}
																			onCheckedChange={() =>
																				onToggleBookshelf(bookshelf, !member)
																			}
																		>
																			{bookshelf.name}
																			<Menu.ItemIndicator />
																		</Menu.CheckboxItem>
																	);
																})
															)}
														</Menu.ItemGroup>
													</Menu.Content>
												</Menu.Positioner>
											</Portal>
										</Menu.Root>
									)}
									{onRemoveFromBookshelf && (
										<Menu.Item
											value="remove-from-bookshelf"
											disabled={isRemoving}
											onClick={handleRemoveFromBookshelf}
										>
											<LuBookmarkMinus />
											Remove from bookshelf
										</Menu.Item>
									)}
									{onMarkRead && book.reading.status !== "read" && (
										<Menu.Item value="mark-read" onClick={onMarkRead}>
											<LuCheck />
											Mark as read
										</Menu.Item>
									)}
									{onMarkUnread && book.reading.status !== "unread" && (
										<Menu.Item value="mark-unread" onClick={onMarkUnread}>
											<LuRotateCcw />
											Mark as unread
										</Menu.Item>
									)}
									{onDelete && (
										<>
											<Menu.Separator />
											<Menu.Item
												value="delete"
												color="fg.error"
												_hover={{ bg: "bg.error", color: "fg.error" }}
												onClick={() => setIsDeleteDialogOpen(true)}
											>
												<LuTrash2 />
												Delete
											</Menu.Item>
										</>
									)}
								</Menu.Content>
							</Menu.Positioner>
						</Portal>
					</Menu.Root>
				</Box>
			)}

			{readableFormats.length > 1 && (
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
								{readableFormats.map((format) => (
									<Button key={format} asChild variant="outline">
										<Link href={readerHref(book, format)}>
											{format.toUpperCase()}
										</Link>
									</Button>
								))}
							</VStack>
						</DialogBody>
						<DialogCloseTrigger />
					</DialogContent>
				</DialogRoot>
			)}

			{onDelete && (
				<DialogRoot
					role="alertdialog"
					open={isDeleteDialogOpen}
					onOpenChange={(e) => {
						if (!isDeleting) {
							setIsDeleteDialogOpen(e.open);
						}
					}}
				>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Delete Book</DialogTitle>
						</DialogHeader>
						<DialogBody>
							<Text>
								Are you sure you want to delete{" "}
								<Span fontWeight="semibold">{book.title || "this book"}</Span>?
								This action cannot be undone.
							</Text>
						</DialogBody>
						<DialogFooter>
							<Button
								variant="outline"
								onClick={() => setIsDeleteDialogOpen(false)}
								disabled={isDeleting}
							>
								Cancel
							</Button>
							<Button
								colorPalette="red"
								onClick={handleDelete}
								loading={isDeleting}
							>
								Delete
							</Button>
						</DialogFooter>
						<DialogCloseTrigger disabled={isDeleting} />
					</DialogContent>
				</DialogRoot>
			)}
		</Card.Root>
	);
}
