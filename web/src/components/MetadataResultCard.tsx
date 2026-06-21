"use client";

import type { BookMetadataSearchResult } from "@calibre-web-serverless/domain/models/bookMetadataSearch";
import { Language } from "@calibre-web-serverless/domain/models/language";
import {
	Badge,
	Box,
	Button,
	HStack,
	Image,
	Text,
	VStack,
} from "@chakra-ui/react";
import { LuBook } from "react-icons/lu";

export interface MetadataResultCardProps {
	result: BookMetadataSearchResult;
	/** This card's result is being applied — shows a spinner on the action. */
	selecting: boolean;
	/** Disable the action (e.g. while another card is being applied). */
	disabled: boolean;
	onSelect: () => void;
}

/**
 * A single metadata search result: cover, title, authors, publisher/year, the
 * source and language, and a "Use this" action. Rendered in the result list of
 * {@link FetchMetadataDialog}.
 */
export function MetadataResultCard({
	result,
	selecting,
	disabled,
	onSelect,
}: MetadataResultCardProps) {
	const year = result.publishedDate?.slice(0, 4) ?? null;
	const meta = [result.publisher, year].filter(Boolean).join(" · ");
	// Show the human-readable language name; fall back to the raw code if unknown.
	const languageCode = result.languages[0];
	const languageLabel = languageCode
		? (Language.from(languageCode)?.name ?? languageCode)
		: null;

	return (
		<HStack align="stretch" gap={3} borderWidth="1px" borderRadius="md" p={3}>
			<Box
				width="60px"
				flexShrink={0}
				aspectRatio={2 / 3}
				bg="bg.muted"
				borderRadius="sm"
				overflow="hidden"
				display="flex"
				alignItems="center"
				justifyContent="center"
			>
				{result.coverUrl ? (
					<Image
						src={result.coverUrl}
						alt={result.title}
						width="100%"
						height="100%"
						objectFit="cover"
					/>
				) : (
					<LuBook size={24} color="var(--chakra-colors-fg-muted)" />
				)}
			</Box>

			<VStack align="stretch" flex="1" gap={1} minW={0}>
				<Text fontWeight="semibold" lineClamp={2}>
					{result.title}
				</Text>
				{result.authors.length > 0 && (
					<Text fontSize="sm" color="fg.muted" lineClamp={1}>
						{result.authors.join(", ")}
					</Text>
				)}
				{meta && (
					<Text fontSize="xs" color="fg.muted">
						{meta}
					</Text>
				)}
				<HStack gap={2} mt={1}>
					<Badge size="sm">{result.sourceName}</Badge>
					{languageLabel && (
						<Badge size="sm" variant="outline">
							{languageLabel}
						</Badge>
					)}
				</HStack>
			</VStack>

			<Button
				alignSelf="center"
				size="sm"
				variant="outline"
				onClick={onSelect}
				loading={selecting}
				disabled={disabled}
			>
				Use this
			</Button>
		</HStack>
	);
}
