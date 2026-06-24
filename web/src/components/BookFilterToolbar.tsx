"use client";

import {
	Badge,
	Button,
	Flex,
	HStack,
	Icon,
	Span,
	Wrap,
} from "@chakra-ui/react";
import { useState } from "react";
import { LuFilterX, LuSlidersHorizontal } from "react-icons/lu";
import { BookFilterDrawer } from "@/components/BookFilterDrawer";
import {
	NativeSelectField,
	NativeSelectRoot,
} from "@/components/ui/native-select";
import { Tag } from "@/components/ui/tag";
import {
	type ActiveFilterChip,
	type BookFacets,
	describeActiveFilters,
} from "@/lib/bookFacets";
import {
	arrayValues,
	type BookFilter,
	type BookSort,
	type BookSortKey,
	countActiveFilters,
	emptyBookFilter,
	isFilterActive,
	type SortDirection,
	withArrayDimension,
} from "@/lib/bookFilter";

interface SortOption {
	value: string;
	label: string;
	key: BookSortKey;
	direction: SortDirection;
}

const SORT_OPTIONS: SortOption[] = [
	{
		value: "createdAt:desc",
		label: "Recently added",
		key: "createdAt",
		direction: "desc",
	},
	{
		value: "createdAt:asc",
		label: "Oldest added",
		key: "createdAt",
		direction: "asc",
	},
	{ value: "title:asc", label: "Title (A–Z)", key: "title", direction: "asc" },
	{
		value: "title:desc",
		label: "Title (Z–A)",
		key: "title",
		direction: "desc",
	},
	{
		value: "pubDate:desc",
		label: "Newest published",
		key: "pubDate",
		direction: "desc",
	},
	{
		value: "pubDate:asc",
		label: "Oldest published",
		key: "pubDate",
		direction: "asc",
	},
	{
		value: "rating:desc",
		label: "Highest rated",
		key: "rating",
		direction: "desc",
	},
];

interface BookFilterToolbarProps {
	filter: BookFilter;
	sort: BookSort;
	facets: BookFacets;
	onFilterChange: (filter: BookFilter) => void;
	onSortChange: (sort: BookSort) => void;
}

export function BookFilterToolbar({
	filter,
	sort,
	facets,
	onFilterChange,
	onSortChange,
}: BookFilterToolbarProps) {
	const [drawerOpen, setDrawerOpen] = useState(false);

	const activeCount = countActiveFilters(filter);
	const chips = describeActiveFilters(filter, facets);

	const handleSortChange = (value: string) => {
		const option = SORT_OPTIONS.find((item) => item.value === value);
		if (option) {
			onSortChange({ key: option.key, direction: option.direction });
		}
	};

	const removeChip = (chip: ActiveFilterChip) => {
		switch (chip.dimension) {
			case "minRating":
				onFilterChange({ ...filter, minRating: null });
				return;
			case "authorIds":
			case "tagIds":
			case "languages":
				onFilterChange(
					withArrayDimension(
						filter,
						chip.dimension,
						arrayValues(filter, chip.dimension).filter(
							(value) => value !== chip.value,
						),
					),
				);
				return;
			case "seriesIds":
			case "publisherIds":
				onFilterChange({
					...filter,
					[chip.dimension]: filter[chip.dimension].filter(
						(value) => value !== chip.value,
					),
				});
				return;
		}
	};

	const clearAll = () => {
		onFilterChange(emptyBookFilter);
	};

	const currentSortValue = `${sort.key}:${sort.direction}`;

	return (
		<>
			<Flex
				direction={{ base: "column", sm: "row" }}
				align={{ base: "stretch", sm: "center" }}
				gap={3}
			>
				<Wrap
					gap={2}
					rowGap={2}
					hideBelow="sm"
					flex={{ sm: "1" }}
					minW="0"
					order={{ base: 1, sm: 0 }}
				>
					{chips.map((chip) => (
						<Tag
							key={`${chip.dimension}:${chip.value}`}
							size="lg"
							maxW="full"
							colorPalette="blue"
							variant="subtle"
							closable
							onClose={() => removeChip(chip)}
						>
							{chip.label}
						</Tag>
					))}
					{isFilterActive(filter) && (
						<Button
							size="sm"
							variant="plain"
							aria-label="Clear all"
							onClick={clearAll}
						>
							<Icon>
								<LuFilterX />
							</Icon>
							<Span hideBelow="sm">Clear all</Span>
						</Button>
					)}
				</Wrap>

				<HStack gap={3} order={{ base: 0, sm: 1 }} flexShrink={0}>
					<NativeSelectRoot
						flex={{ base: "1", sm: "initial" }}
						minW="0"
						width={{ sm: "auto" }}
					>
						<NativeSelectField
							value={currentSortValue}
							onChange={(event) => handleSortChange(event.target.value)}
							aria-label="Sort books"
							items={SORT_OPTIONS}
						/>
					</NativeSelectRoot>

					<Button
						variant="outline"
						flexShrink={0}
						aria-label="Filters"
						onClick={() => setDrawerOpen(true)}
					>
						<Icon>
							<LuSlidersHorizontal />
						</Icon>
						<Span hideBelow="sm">Filters</Span>
						{activeCount > 0 && (
							<Badge colorPalette="blue" rounded="full">
								{activeCount}
							</Badge>
						)}
					</Button>
				</HStack>
			</Flex>

			<BookFilterDrawer
				open={drawerOpen}
				onOpenChange={setDrawerOpen}
				filter={filter}
				facets={facets}
				onChange={onFilterChange}
				onClear={clearAll}
			/>
		</>
	);
}
