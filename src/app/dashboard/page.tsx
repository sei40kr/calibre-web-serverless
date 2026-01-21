"use client";

import {
	Box,
	Button,
	Container,
	Heading,
	HStack,
	Text,
	VStack,
} from "@chakra-ui/react";
import { useState } from "react";
import { LuPlus } from "react-icons/lu";
import { AuthGuard } from "@/components/AuthGuard";
import { UploadBookDialog } from "@/components/UploadBookDialog";
import { Toaster } from "@/components/ui/toaster";

export default function DashboardPage() {
	const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);

	return (
		<AuthGuard>
			{({ user, signOut }) => (
				<>
					<Container maxW="container.lg" py={8}>
						<VStack gap={6} align="stretch">
							<HStack justify="space-between">
								<Heading size="xl">Dashboard</Heading>
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

							<Box p={6} borderWidth={1} borderRadius="lg">
								<VStack align="start" gap={2}>
									<Text fontWeight="bold">Logged in as:</Text>
									<Text>{user.email}</Text>
								</VStack>
							</Box>

							<Box p={6} borderWidth={1} borderRadius="lg">
								<Text color="fg.muted">Your books will appear here.</Text>
							</Box>
						</VStack>
					</Container>

					<UploadBookDialog
						user={user}
						open={isUploadDialogOpen}
						onOpenChange={setIsUploadDialogOpen}
					/>
					<Toaster />
				</>
			)}
		</AuthGuard>
	);
}
