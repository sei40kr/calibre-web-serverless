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
import { BookSortSelect } from "@/components/BookSortSelect";
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
	countActiveFilters,
	emptyBookFilter,
	isFilterActive,
	withArrayDimension,
} from "@/lib/bookFilter";

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
					<BookSortSelect sort={sort} onSortChange={onSortChange} />

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
