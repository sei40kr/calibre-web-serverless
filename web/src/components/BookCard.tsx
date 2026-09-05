"use client";

import type { Book } from "@calibre-web-serverless/domain/models/book";
import { readyFiles } from "@calibre-web-serverless/domain/models/bookFile";
import {
	type Bookshelf,
	isBookInBookshelf,
} from "@calibre-web-serverless/domain/models/bookshelf";
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
	LuPencil,
	LuTrash2,
	LuTriangleAlert,
} from "react-icons/lu";
import {
	DialogBody,
	DialogCloseTrigger,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogRoot,
	DialogTitle,
} from "@/components/ui/dialog";

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
}

export function BookCard({
	book,
	coverUrl,
	coverLoading,
	onDelete,
	bookshelves,
	onToggleBookshelf,
	onRemoveFromBookshelf,
}: BookCardProps) {
	const isProcessing = book.status === "processing";
	const isError = book.status === "error";
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
			</Box>
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
				</VStack>
			</Card.Body>

			{!isProcessing && (
				<Box position="absolute" top={2} right={2}>
					<HStack gap={1}>
						<IconButton
							asChild
							aria-label="Edit book"
							variant="surface"
							size="sm"
							rounded="full"
						>
							<Link href={`/dashboard/books/${book.id}/edit`}>
								<LuPencil />
							</Link>
						</IconButton>
						{bookshelves && onToggleBookshelf && (
							<Menu.Root
								closeOnSelect={false}
								positioning={{ placement: "bottom-end" }}
							>
								<Menu.Trigger asChild>
									<IconButton
										aria-label="Add to bookshelf"
										variant="surface"
										size="sm"
										rounded="full"
									>
										<LuBookmark />
									</IconButton>
								</Menu.Trigger>
								<Portal>
									<Menu.Positioner>
										<Menu.Content>
											<Menu.ItemGroup>
												<Menu.ItemGroupLabel>Bookshelves</Menu.ItemGroupLabel>
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
							<IconButton
								aria-label="Remove from bookshelf"
								variant="surface"
								size="sm"
								rounded="full"
								loading={isRemoving}
								onClick={handleRemoveFromBookshelf}
							>
								<LuBookmarkMinus />
							</IconButton>
						)}
						{onDelete && (
							<IconButton
								aria-label="Delete book"
								variant="surface"
								colorPalette="red"
								size="sm"
								rounded="full"
								onClick={() => setIsDeleteDialogOpen(true)}
							>
								<LuTrash2 />
							</IconButton>
						)}
					</HStack>
				</Box>
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
