"use client";

import {
	NativeSelectField,
	NativeSelectRoot,
} from "@/components/ui/native-select";
import type { BookSort, BookSortKey, SortDirection } from "@/lib/bookFilter";

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

interface BookSortSelectProps {
	sort: BookSort;
	onSortChange: (sort: BookSort) => void;
}

/** The sort-order dropdown shared by the library and bookshelf views. */
export function BookSortSelect({ sort, onSortChange }: BookSortSelectProps) {
	const handleChange = (value: string) => {
		const option = SORT_OPTIONS.find((item) => item.value === value);
		if (option) {
			onSortChange({ key: option.key, direction: option.direction });
		}
	};

	return (
		<NativeSelectRoot
			flex={{ base: "1", sm: "initial" }}
			minW="0"
			width={{ sm: "auto" }}
		>
			<NativeSelectField
				value={`${sort.key}:${sort.direction}`}
				onChange={(event) => handleChange(event.target.value)}
				aria-label="Sort books"
				items={SORT_OPTIONS}
			/>
		</NativeSelectRoot>
	);
}
