"use client";

import { Button, Container, HStack, VStack } from "@chakra-ui/react";
import { LuArrowLeft } from "react-icons/lu";
import { EmptyState } from "@/components/ui/empty-state";

export interface BookNotFoundPageProps {
	onBack: () => void;
}

export function BookNotFoundPage({ onBack }: BookNotFoundPageProps) {
	return (
		<Container maxW="container.lg" py={8}>
			<VStack gap={6} align="stretch">
				<HStack>
					<Button variant="ghost" onClick={onBack}>
						<LuArrowLeft />
						Back
					</Button>
				</HStack>

				<EmptyState
					title="Book not found"
					description="The book you're looking for doesn't exist."
				/>
			</VStack>
		</Container>
	);
}
