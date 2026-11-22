"use client";

import type { Book } from "@calibre-web-serverless/domain/models/book";
import {
	type Bookshelf,
	isBookInBookshelf,
} from "@calibre-web-serverless/domain/models/bookshelf";
import { Box, Button, Menu, Portal, Span, Text } from "@chakra-ui/react";
import Link from "next/link";
import { type ReactElement, useState } from "react";
import {
	LuBookmark,
	LuBookmarkMinus,
	LuCheck,
	LuChevronRight,
	LuPencil,
	LuRotateCcw,
	LuTrash2,
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

export interface BookActionsMenuProps {
	book: Book;
	/** The button that opens the menu. */
	trigger: ReactElement;
	/** Links to the edit page. Omit to hide the action. */
	editHref?: string;
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

/** The per-book actions menu, with its delete confirmation. */
export function BookActionsMenu({
	book,
	trigger,
	editHref,
	onDelete,
	bookshelves,
	onToggleBookshelf,
	onRemoveFromBookshelf,
	onMarkRead,
	onMarkUnread,
}: BookActionsMenuProps) {
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
		<>
			<Menu.Root positioning={{ placement: "bottom-end" }}>
				<Menu.Trigger asChild>{trigger}</Menu.Trigger>
				<Portal>
					<Menu.Positioner>
						<Menu.Content minW="13rem">
							{editHref && (
								<Menu.Item value="edit" asChild>
									<Link href={editHref}>
										<LuPencil />
										Edit
									</Link>
								</Menu.Item>
							)}
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
		</>
	);
}
