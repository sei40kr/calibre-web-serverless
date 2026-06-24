import {
	type ArrayDimension,
	type BookFilter,
	type BookSort,
	type BookSortKey,
	defaultBookSort,
	emptyBookFilter,
	type SortDirection,
	withArrayDimension,
} from "./bookFilter";

/** Query-string key for each array dimension (only one can be active). */
const ARRAY_PARAM: Record<ArrayDimension, string> = {
	authorIds: "authors",
	tagIds: "tags",
	languages: "langs",
};

/** Query-string key for each scalar (`in`) dimension. */
const SCALAR_PARAM = {
	series: "seriesIds",
	publishers: "publisherIds",
} as const satisfies Record<string, "seriesIds" | "publisherIds">;

const SORT_KEYS: readonly BookSortKey[] = [
	"createdAt",
	"title",
	"pubDate",
	"rating",
];

const splitValues = (raw: string | null): string[] =>
	raw
		? raw
				.split(",")
				.map((value) => value.trim())
				.filter(Boolean)
		: [];

/** Serialises filter + sort into a `URLSearchParams`, omitting empty values. */
export const filterToSearchParams = (
	filter: BookFilter,
	sort: BookSort,
): URLSearchParams => {
	const params = new URLSearchParams();

	if (filter.arrayFilter) {
		params.set(
			ARRAY_PARAM[filter.arrayFilter.dimension],
			filter.arrayFilter.values.join(","),
		);
	}

	for (const [param, key] of Object.entries(SCALAR_PARAM)) {
		const values = filter[key];
		if (values.length > 0) {
			params.set(param, values.join(","));
		}
	}

	if (filter.minRating !== null) {
		params.set("rating", String(filter.minRating));
	}

	if (
		sort.key !== defaultBookSort.key ||
		sort.direction !== defaultBookSort.direction
	) {
		params.set("sort", `${sort.key}:${sort.direction}`);
	}

	return params;
};

const parseSort = (raw: string | null): BookSort => {
	if (!raw) {
		return defaultBookSort;
	}
	const [key, direction] = raw.split(":");
	if (!SORT_KEYS.includes(key as BookSortKey)) {
		return defaultBookSort;
	}
	return {
		key: key as BookSortKey,
		direction: (direction === "asc" ? "asc" : "desc") as SortDirection,
	};
};

const parseRating = (raw: string | null): number | null => {
	if (raw === null) {
		return null;
	}
	const value = Number(raw);
	return Number.isFinite(value) && value >= 1 && value <= 5
		? Math.round(value)
		: null;
};

/** Reconstructs filter + sort from a `URLSearchParams`. Inverse of the above. */
export const parseSearchParams = (
	params: URLSearchParams,
): { filter: BookFilter; sort: BookSort } => {
	let filter: BookFilter = {
		...emptyBookFilter,
		minRating: parseRating(params.get("rating")),
	};

	// The first array dimension present wins (only one can be active).
	for (const [dimension, param] of Object.entries(ARRAY_PARAM) as [
		ArrayDimension,
		string,
	][]) {
		const values = splitValues(params.get(param));
		if (values.length > 0) {
			filter = withArrayDimension(filter, dimension, values);
			break;
		}
	}

	for (const [param, key] of Object.entries(SCALAR_PARAM)) {
		filter[key] = splitValues(params.get(param));
	}

	return { filter, sort: parseSort(params.get("sort")) };
};
