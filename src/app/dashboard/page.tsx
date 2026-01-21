"use client";

import { Button, Container, Heading, HStack, VStack } from "@chakra-ui/react";
import type { User } from "firebase/auth";
import { useState } from "react";
import { LuPlus } from "react-icons/lu";
import { AuthGuard } from "@/components/AuthGuard";
import { BookGrid } from "@/components/BookGrid";
import { UploadBookDialog } from "@/components/UploadBookDialog";
import { Toaster } from "@/components/ui/toaster";
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

					<BookGrid books={books} loading={loading} />
				</VStack>
			</Container>

			<UploadBookDialog
				user={user}
				open={isUploadDialogOpen}
				onOpenChange={setIsUploadDialogOpen}
			/>
			<Toaster />
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
