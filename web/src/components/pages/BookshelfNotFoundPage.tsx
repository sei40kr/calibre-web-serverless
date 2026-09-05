"use client";

import { Button, Container, HStack, VStack } from "@chakra-ui/react";
import { LuArrowLeft } from "react-icons/lu";
import { EmptyState } from "@/components/ui/empty-state";

export interface BookshelfNotFoundPageProps {
	onBack: () => void;
}

export function BookshelfNotFoundPage({ onBack }: BookshelfNotFoundPageProps) {
	return (
		<Container maxW="container.lg" py={8}>
			<VStack gap={6} align="stretch">
				<HStack>
					<Button variant="ghost" onClick={onBack}>
						<LuArrowLeft />
						All Books
					</Button>
				</HStack>

				<EmptyState
					title="Bookshelf not found"
					description="This bookshelf doesn't exist or has been deleted."
				/>
			</VStack>
		</Container>
	);
}
