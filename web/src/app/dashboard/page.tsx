"use client";

import type { Book } from "@calibre-web-serverless/domain/models/book";
import type { User } from "@calibre-web-serverless/domain/models/user";
import { bookRepository } from "@calibre-web-serverless/infrastructure/repositories/bookRepository";
import { Button, Container, Heading, HStack, VStack } from "@chakra-ui/react";
import { useCallback, useState } from "react";
import { LuPlus } from "react-icons/lu";
import { AuthGuard } from "@/components/AuthGuard";
import { BookGrid } from "@/components/BookGrid";
import { UploadBookDialog } from "@/components/UploadBookDialog";
import { toaster } from "@/components/ui/toaster";
import { useBookCoverUrls } from "@/hooks/useBookCoverUrls";
import { useBooks } from "@/hooks/useBooks";

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
	const { books, loading } = useBooks(user.uid);
	const bookCoverInfos = useBookCoverUrls(books);

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
					<HStack justify="space-between">
						<Heading size="xl">My Books</Heading>
						<HStack>
							<Button
								colorPalette="blue"
								onClick={() => setIsUploadDialogOpen(true)}
							>
								<LuPlus />
								Upload Book
							</Button>
							<Button variant="outline" onClick={signOut}>
								Logout
							</Button>
						</HStack>
					</HStack>

					<BookGrid
						books={books}
						loading={loading}
						bookCoverInfos={bookCoverInfos}
						onDeleteBook={handleDeleteBook}
					/>
				</VStack>
			</Container>

			<UploadBookDialog
				user={user}
				open={isUploadDialogOpen}
				onOpenChange={setIsUploadDialogOpen}
			/>
		</>
	);
}

export default function DashboardPage() {
	const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);

	return (
		<AuthGuard>
			{({ user, signOut }) => (
				<DashboardContent
					user={user}
					signOut={signOut}
					isUploadDialogOpen={isUploadDialogOpen}
					setIsUploadDialogOpen={setIsUploadDialogOpen}
				/>
			)}
		</AuthGuard>
	);
}
