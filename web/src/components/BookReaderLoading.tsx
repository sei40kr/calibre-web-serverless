"use client";

import { Box, Center, Image, Progress, Text, VStack } from "@chakra-ui/react";
import { LuBook } from "react-icons/lu";

interface BookReaderLoadingProps {
	coverUrl: string | null;
	/** Download progress in [0, 1], or null for an indeterminate bar. */
	progress: number | null;
}

/** Cover stand-in with a progress bar, shown while the book file loads. */
export function BookReaderLoading({
	coverUrl,
	progress,
}: BookReaderLoadingProps) {
	return (
		<Center height="100%">
			<VStack gap={4}>
				{/* Fixed-size stand-in so the layout doesn't shift while the
				    cover (and then the book) loads; a book icon fills in when
				    there is no cover to show. */}
				<Box
					w="60"
					aspectRatio={2 / 3}
					bg="bg.subtle"
					shadow="md"
					overflow="hidden"
					display="flex"
					alignItems="center"
					justifyContent="center"
				>
					{coverUrl ? (
						<Image
							src={coverUrl}
							alt=""
							width="100%"
							height="100%"
							objectFit="cover"
						/>
					) : (
						<LuBook size={48} color="var(--chakra-colors-fg-muted)" />
					)}
				</Box>
				<Progress.Root
					value={progress === null ? null : progress * 100}
					size="xs"
					w="60"
				>
					<Progress.Track>
						<Progress.Range />
					</Progress.Track>
				</Progress.Root>
				<Text textStyle="sm" color="fg.muted">
					Loading…
				</Text>
			</VStack>
		</Center>
	);
}
