"use client";

import type { Book } from "@calibre-web-serverless/domain/models/book";
import {
	Badge,
	Box,
	Button,
	Card,
	HStack,
	IconButton,
	Image,
	Skeleton,
	Span,
	Text,
	VStack,
} from "@chakra-ui/react";
import Link from "next/link";
import { useState } from "react";
import { LuBook, LuPencil, LuTrash2, LuTriangleAlert } from "react-icons/lu";
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
	onDelete: () => Promise<void>;
}

export function BookCard({
	book,
	coverUrl,
	coverLoading,
	onDelete,
}: BookCardProps) {
	const isProcessing = book.status === "processing";
	const isError = book.status === "error";
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);

	const handleDelete = async () => {
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
					<Badge size="sm" colorPalette="blue">
						{book.format.toUpperCase()}
					</Badge>
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
					</HStack>
				</Box>
			)}

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
		</Card.Root>
	);
}
