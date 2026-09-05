"use client";

import type { Book } from "@calibre-web-serverless/domain/models/book";
import type { User } from "@calibre-web-serverless/domain/models/user";
import { bookRepository } from "@calibre-web-serverless/infrastructure/repositories/bookRepository";
import { Button, Container, Heading, HStack, VStack } from "@chakra-ui/react";
import { Suspense, useCallback, useMemo, useState } from "react";
import { LuPlus } from "react-icons/lu";
import { AuthGuard } from "@/components/AuthGuard";
import { BookFilterToolbar } from "@/components/BookFilterToolbar";
import { BookGrid } from "@/components/BookGrid";
import { UploadBookDialog } from "@/components/UploadBookDialog";
import { toaster } from "@/components/ui/toaster";
import { useBookUploads } from "@/contexts/BookUploadContext";
import { useAuthors } from "@/hooks/useAuthors";
import { useBookCoverUrls } from "@/hooks/useBookCoverUrls";
import { useBookFilter } from "@/hooks/useBookFilter";
import { useBooks } from "@/hooks/useBooks";
import { usePublishers } from "@/hooks/usePublishers";
import { useSeries } from "@/hooks/useSeries";
import { useTags } from "@/hooks/useTags";
import { buildBookFacets } from "@/lib/bookFacets";
import { isFilterActive } from "@/lib/bookFilter";

interface DashboardContentProps {
	user: User;
	signOut: () => void;
	isUploadDialogOpen: boolean;
	setIsUploadDialogOpen: (open: boolean) => void;
}

function DashboardContent({
	user,
	signOut,
	isUploadDialogOpen,
	setIsUploadDialogOpen,
}: DashboardContentProps) {
	const { filter, sort, setFilter, setSort } = useBookFilter();
	const { enqueue } = useBookUploads();

	// Books are filtered and sorted server-side via the Firestore query.
	const { books, loading } = useBooks(user.uid, filter, sort);
	const bookCoverInfos = useBookCoverUrls(books);

	// Filter options come from the full entity lists, independent of the
	// (filtered) book results, so every choice stays available.
	const { authors } = useAuthors(user.uid);
	const { series } = useSeries(user.uid);
	const { tags } = useTags(user.uid);
	const { publishers } = usePublishers(user.uid);

	const facets = useMemo(
		() => buildBookFacets({ authors, series, tags, publishers }),
		[authors, series, tags, publishers],
	);

	const filtering = isFilterActive(filter);

	// Uploads run in the app-wide queue so the dialog can close immediately and
	// the progress overlay takes over.
	const handleUpload = useCallback(
		(files: File[]) => enqueue(user.uid, files),
		[enqueue, user.uid],
	);

	const handleDeleteBook = useCallback(
		async (book: Book) => {
			try {
				await bookRepository.deleteBook(user.uid, book.id);
				toaster.success({
					title: "Book deleted",
					description: `"${book.title || "Untitled"}" has been deleted.`,
				});
			} catch (error) {
				toaster.error({
					title: "Failed to delete book",
					description: "Please try again.",
				});
				throw error;
			}
		},
		[user.uid],
	);

	return (
		<>
			<Container maxW="container.lg" py={8}>
				<VStack gap={6} align="stretch">
					<HStack
						justify="space-between"
						align="center"
						flexWrap="wrap"
						gap={3}
					>
						<Heading size="xl">My Books</Heading>
						<HStack flexShrink={0}>
							<Button
								colorPalette="blue"
								onClick={() => setIsUploadDialogOpen(true)}
							>
								<LuPlus />
								Upload Books
							</Button>
							<Button variant="outline" onClick={signOut}>
								Logout
							</Button>
						</HStack>
					</HStack>

					{!loading && (books.length > 0 || filtering) && (
						<BookFilterToolbar
							filter={filter}
							sort={sort}
							facets={facets}
							onFilterChange={setFilter}
							onSortChange={setSort}
						/>
					)}

					<BookGrid
						books={books}
						loading={loading}
						bookCoverInfos={bookCoverInfos}
						onDeleteBook={handleDeleteBook}
						isFiltering={filtering}
					/>
				</VStack>
			</Container>

			<UploadBookDialog
				open={isUploadDialogOpen}
				onOpenChange={setIsUploadDialogOpen}
				onUpload={handleUpload}
			/>
		</>
	);
}

export default function DashboardPage() {
	const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);

	return (
		<AuthGuard>
			{({ user, signOut }) => (
				<Suspense fallback={null}>
					<DashboardContent
						user={user}
						signOut={signOut}
						isUploadDialogOpen={isUploadDialogOpen}
						setIsUploadDialogOpen={setIsUploadDialogOpen}
					/>
				</Suspense>
			)}
		</AuthGuard>
	);
}
