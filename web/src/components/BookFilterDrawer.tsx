"use client";

import {
	Box,
	Button,
	HStack,
	RatingGroup,
	Stack,
	Text,
} from "@chakra-ui/react";
import { useRef } from "react";
import { ComboboxFilterSection } from "@/components/ComboboxFilterSection";
import {
	DrawerBody,
	DrawerCloseTrigger,
	DrawerContent,
	DrawerFooter,
	DrawerHeader,
	DrawerRoot,
	DrawerTitle,
} from "@/components/ui/drawer";
import type { BookFacets } from "@/lib/bookFacets";
import {
	type ArrayDimension,
	activeArrayDimension,
	arrayValues,
	type BookFilter,
	countActiveFilters,
	withArrayDimension,
} from "@/lib/bookFilter";

interface BookFilterDrawerProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	filter: BookFilter;
	facets: BookFacets;
	onChange: (filter: BookFilter) => void;
	onClear: () => void;
}

const ARRAY_DIMENSION_LABELS: Record<ArrayDimension, string> = {
	authorIds: "authors",
	tagIds: "tags",
	languages: "languages",
};

/**
 * Slide-in panel holding every filter dimension as a text box + autocomplete.
 * Changes apply live to the URL-synced filter. Because Firestore allows only
 * one array-membership filter per query, the author/tag/language fields are
 * mutually exclusive: selecting one disables the other two until it is cleared.
 */
export function BookFilterDrawer({
	open,
	onOpenChange,
	filter,
	facets,
	onChange,
	onClear,
}: BookFilterDrawerProps) {
	const contentRef = useRef<HTMLDivElement>(null);

	const patch = (changes: Partial<BookFilter>) => {
		onChange({ ...filter, ...changes });
	};

	const setArray = (dimension: ArrayDimension, values: string[]) => {
		onChange(withArrayDimension(filter, dimension, values));
	};

	const activeCount = countActiveFilters(filter);
	const activeDimension = activeArrayDimension(filter);

	const disabledFor = (dimension: ArrayDimension): boolean =>
		activeDimension !== null && activeDimension !== dimension;

	const helperFor = (dimension: ArrayDimension): string | undefined =>
		disabledFor(dimension) && activeDimension
			? `Clear ${ARRAY_DIMENSION_LABELS[activeDimension]} to filter by ${ARRAY_DIMENSION_LABELS[dimension]}`
			: undefined;

	return (
		<DrawerRoot
			open={open}
			onOpenChange={(event) => onOpenChange(event.open)}
			size={{ base: "full", sm: "sm" }}
		>
			<DrawerContent ref={contentRef}>
				<DrawerHeader>
					<DrawerTitle>Filters</DrawerTitle>
				</DrawerHeader>
				<DrawerBody>
					<Stack gap={5}>
						<Text fontSize="sm" color="fg.muted">
							Authors, tags and languages can&apos;t be combined — only one
							applies at a time.
						</Text>

						<ComboboxFilterSection
							label="Authors"
							options={facets.authors}
							selected={arrayValues(filter, "authorIds")}
							onChange={(values) => setArray("authorIds", values)}
							placeholder="Search authors..."
							disabled={disabledFor("authorIds")}
							helperText={helperFor("authorIds")}
							portalRef={contentRef}
						/>
						<ComboboxFilterSection
							label="Tags"
							options={facets.tags}
							selected={arrayValues(filter, "tagIds")}
							onChange={(values) => setArray("tagIds", values)}
							placeholder="Search tags..."
							disabled={disabledFor("tagIds")}
							helperText={helperFor("tagIds")}
							portalRef={contentRef}
						/>
						<ComboboxFilterSection
							label="Languages"
							options={facets.languages}
							selected={arrayValues(filter, "languages")}
							onChange={(values) => setArray("languages", values)}
							placeholder="Search languages..."
							disabled={disabledFor("languages")}
							helperText={helperFor("languages")}
							portalRef={contentRef}
						/>
						<ComboboxFilterSection
							label="Series"
							options={facets.series}
							selected={filter.seriesIds}
							onChange={(seriesIds) => patch({ seriesIds })}
							placeholder="Search series..."
							portalRef={contentRef}
						/>
						<ComboboxFilterSection
							label="Publishers"
							options={facets.publishers}
							selected={filter.publisherIds}
							onChange={(publisherIds) => patch({ publisherIds })}
							placeholder="Search publishers..."
							portalRef={contentRef}
						/>

						<Box>
							<HStack justify="space-between" mb={2}>
								<Text fontWeight="medium">Minimum rating</Text>
								{filter.minRating !== null && (
									<Button
										variant="plain"
										size="sm"
										onClick={() => patch({ minRating: null })}
									>
										Clear
									</Button>
								)}
							</HStack>
							<RatingGroup.Root
								count={5}
								value={filter.minRating ?? 0}
								onValueChange={(details) =>
									patch({
										minRating: details.value === 0 ? null : details.value,
									})
								}
								colorPalette="yellow"
							>
								<RatingGroup.HiddenInput />
								<RatingGroup.Control />
							</RatingGroup.Root>
						</Box>
					</Stack>
				</DrawerBody>
				<DrawerFooter>
					<Button
						variant="outline"
						onClick={onClear}
						disabled={activeCount === 0}
					>
						Clear all
					</Button>
					<Button colorPalette="blue" onClick={() => onOpenChange(false)}>
						Done
					</Button>
				</DrawerFooter>
				<DrawerCloseTrigger />
			</DrawerContent>
		</DrawerRoot>
	);
}
