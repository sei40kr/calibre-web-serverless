"use client";

import type { Bookshelf } from "@calibre-web-serverless/domain/models/bookshelf";
import {
	Badge,
	Box,
	Button,
	HStack,
	IconButton,
	Menu,
	Portal,
	Span,
	Text,
	VStack,
} from "@chakra-ui/react";
import NextLink from "next/link";
import { useState } from "react";
import {
	LuEllipsis,
	LuLibrary,
	LuPencil,
	LuPlus,
	LuTrash2,
} from "react-icons/lu";
import { CreateBookshelfDialog } from "@/components/CreateBookshelfDialog";
import { RenameBookshelfDialog } from "@/components/RenameBookshelfDialog";
import {
	DialogBody,
	DialogCloseTrigger,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogRoot,
	DialogTitle,
} from "@/components/ui/dialog";

export const bookshelfHref = (bookshelfId: string) =>
	`/dashboard/bookshelves/${bookshelfId}`;

interface SidebarProps {
	bookshelves: Bookshelf[];
	/** The bookshelf currently being viewed, or null on the all-books view. */
	activeBookshelfId: string | null;
	onCreateBookshelf: (name: string) => Promise<void>;
	onRenameBookshelf: (bookshelf: Bookshelf, name: string) => Promise<void>;
	onDeleteBookshelf: (bookshelf: Bookshelf) => Promise<void>;
	/** Called after a navigation link is followed (e.g. to close a drawer). */
	onNavigate?: () => void;
}

/**
 * Library navigation: the all-books view plus the user's bookshelves, with the
 * controls to create, rename, and delete bookshelves. Purely presentational; persistence is
 * delegated to the callbacks.
 */
export function Sidebar({
	bookshelves,
	activeBookshelfId,
	onCreateBookshelf,
	onRenameBookshelf,
	onDeleteBookshelf,
	onNavigate,
}: SidebarProps) {
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [pendingRename, setPendingRename] = useState<Bookshelf | null>(null);
	const [pendingDelete, setPendingDelete] = useState<Bookshelf | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);

	const handleDelete = async () => {
		if (!pendingDelete) return;
		setIsDeleting(true);
		try {
			await onDeleteBookshelf(pendingDelete);
			setPendingDelete(null);
		} catch {
			// The caller reports the failure; keep the dialog open for a retry.
		} finally {
			setIsDeleting(false);
		}
	};

	return (
		<VStack as="nav" aria-label="Library" align="stretch" gap={6}>
			<Button
				asChild
				variant={activeBookshelfId === null ? "subtle" : "ghost"}
				justifyContent="flex-start"
				aria-current={activeBookshelfId === null ? "page" : undefined}
				onClick={onNavigate}
			>
				<NextLink href="/dashboard">
					<LuLibrary />
					All Books
				</NextLink>
			</Button>

			<VStack align="stretch" gap={1}>
				<HStack justify="space-between" px={2}>
					<Text
						fontSize="xs"
						fontWeight="semibold"
						textTransform="uppercase"
						color="fg.muted"
					>
						Bookshelves
					</Text>
					<IconButton
						aria-label="New bookshelf"
						size="xs"
						variant="ghost"
						onClick={() => setIsCreateOpen(true)}
					>
						<LuPlus />
					</IconButton>
				</HStack>

				{bookshelves.length === 0 ? (
					<Text fontSize="sm" color="fg.muted" px={2} py={1}>
						No bookshelves yet
					</Text>
				) : (
					<VStack as="ul" align="stretch" gap={1} listStyleType="none">
						{bookshelves.map((bookshelf) => {
							const active = bookshelf.id === activeBookshelfId;
							return (
								<Box as="li" key={bookshelf.id} position="relative">
									<Button
										asChild
										w="full"
										minW={0}
										variant={active ? "subtle" : "ghost"}
										justifyContent="flex-start"
										aria-current={active ? "page" : undefined}
										onClick={onNavigate}
										pe={10}
									>
										<NextLink href={bookshelfHref(bookshelf.id)}>
											<Span truncate flex="1" textAlign="start">
												{bookshelf.name}
											</Span>
											<Badge variant="subtle" colorPalette="gray">
												{bookshelf.bookCount}
											</Badge>
										</NextLink>
									</Button>
									<Menu.Root
										positioning={{ placement: "bottom-end" }}
										onSelect={({ value }) => {
											if (value === "rename") setPendingRename(bookshelf);
											if (value === "delete") setPendingDelete(bookshelf);
										}}
									>
										{/* Overlaid on the link's padding, not nested in it, so
										    opening the menu can never also follow the link. */}
										<Menu.Trigger asChild>
											<IconButton
												aria-label={`Bookshelf actions for ${bookshelf.name}`}
												size="xs"
												variant="ghost"
												position="absolute"
												insetEnd={1}
												top="50%"
												transform="translateY(-50%)"
											>
												<LuEllipsis />
											</IconButton>
										</Menu.Trigger>
										<Portal>
											<Menu.Positioner>
												<Menu.Content>
													<Menu.Item value="rename">
														<LuPencil />
														Rename
													</Menu.Item>
													<Menu.Item
														value="delete"
														color="fg.error"
														_hover={{ bg: "bg.error", color: "fg.error" }}
													>
														<LuTrash2 />
														Delete
													</Menu.Item>
												</Menu.Content>
											</Menu.Positioner>
										</Portal>
									</Menu.Root>
								</Box>
							);
						})}
					</VStack>
				)}
			</VStack>

			<CreateBookshelfDialog
				open={isCreateOpen}
				onOpenChange={setIsCreateOpen}
				onCreate={onCreateBookshelf}
			/>

			<RenameBookshelfDialog
				open={pendingRename !== null}
				onOpenChange={(open) => {
					if (!open) setPendingRename(null);
				}}
				currentName={pendingRename?.name ?? ""}
				onRename={async (name) => {
					if (!pendingRename) return;
					await onRenameBookshelf(pendingRename, name);
				}}
			/>

			<DialogRoot
				role="alertdialog"
				open={pendingDelete !== null}
				onOpenChange={(e) => {
					if (!e.open && !isDeleting) setPendingDelete(null);
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete Bookshelf</DialogTitle>
					</DialogHeader>
					<DialogBody>
						<Text>
							Are you sure you want to delete{" "}
							<Span fontWeight="semibold">{pendingDelete?.name}</Span>? The
							books on it stay in your library.
						</Text>
					</DialogBody>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setPendingDelete(null)}
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
		</VStack>
	);
}
