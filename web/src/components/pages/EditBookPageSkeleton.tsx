"use client";

import {
	Box,
	Button,
	Container,
	Grid,
	Heading,
	HStack,
	Skeleton,
	Stack,
	VStack,
} from "@chakra-ui/react";
import { LuArrowLeft } from "react-icons/lu";

export function EditBookPageSkeleton() {
	return (
		<Container maxW="container.lg" py={8}>
			<VStack gap={6} align="stretch">
				<HStack>
					<Button variant="ghost" disabled>
						<LuArrowLeft />
						Back
					</Button>
				</HStack>

				<Heading size="xl">Edit Book</Heading>

				<Grid templateColumns={{ base: "1fr", md: "200px 1fr" }} gap={8}>
					{/* Cover skeleton */}
					<Box>
						<Skeleton aspectRatio={2 / 3} borderRadius="md" />
						<Skeleton height={4} width="80%" mx="auto" mt={2} />
					</Box>

					{/* Form fields skeleton */}
					<Stack gap={4}>
						{/* Title */}
						<Stack gap={1}>
							<Skeleton height={4} width="40px" />
							<Skeleton height={10} />
						</Stack>
						{/* Sort Title */}
						<Stack gap={1}>
							<Skeleton height={4} width="70px" />
							<Skeleton height={10} />
							<Skeleton height={3} width="250px" />
						</Stack>
						{/* Authors */}
						<Stack gap={1}>
							<Skeleton height={4} width="55px" />
							<Skeleton height={10} />
						</Stack>
						{/* Series + Series Index */}
						<Grid templateColumns={{ base: "1fr", sm: "2fr 1fr" }} gap={4}>
							<Stack gap={1}>
								<Skeleton height={4} width="45px" />
								<Skeleton height={10} />
							</Stack>
							<Stack gap={1}>
								<Skeleton height={4} width="80px" />
								<Skeleton height={10} />
							</Stack>
						</Grid>
						{/* Tags */}
						<Stack gap={1}>
							<Skeleton height={4} width="35px" />
							<Skeleton height={10} />
						</Stack>
						{/* Description */}
						<Stack gap={1}>
							<Skeleton height={4} width="75px" />
							<Skeleton height={24} />
						</Stack>
						{/* Publisher + Publication Date */}
						<Grid templateColumns={{ base: "1fr", sm: "1fr 1fr" }} gap={4}>
							<Stack gap={1}>
								<Skeleton height={4} width="65px" />
								<Skeleton height={10} />
							</Stack>
							<Stack gap={1}>
								<Skeleton height={4} width="110px" />
								<Skeleton height={10} />
							</Stack>
						</Grid>
						{/* Languages */}
						<Stack gap={1}>
							<Skeleton height={4} width="160px" />
							<Skeleton height={10} />
						</Stack>
						{/* Rating */}
						<Stack gap={1}>
							<Skeleton height={4} width="45px" />
							<Skeleton height={6} width="120px" />
						</Stack>
						{/* Identifiers heading */}
						<Skeleton height={6} width="90px" mt={4} />
					</Stack>
				</Grid>

				{/* Sticky footer */}
				<Box
					position="sticky"
					bottom={0}
					bg="bg"
					borderTopWidth="1px"
					py={4}
					mt={4}
					mx={-4}
					px={4}
				>
					<HStack justify="flex-end">
						<Button variant="outline" disabled>
							Cancel
						</Button>
						<Button colorPalette="blue" disabled>
							Save
						</Button>
					</HStack>
				</Box>
			</VStack>
		</Container>
	);
}
