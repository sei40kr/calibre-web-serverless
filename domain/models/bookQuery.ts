/**
 * The array-valued book fields. Firestore permits at most one
 * `array-contains-any` clause per query, so a book filter may constrain only
 * one of these at a time — encoded directly in {@link BookFilter} via a single
 * {@link ArrayFilter} slot rather than three independent arrays.
 */
export type ArrayDimension = "authorIds" | "tagIds" | "languages";

/**
 * A selection within one array dimension. Values are combined with OR (any
 * match) and, by construction (see {@link withArrayDimension}), the list is
 * always non-empty — an empty selection is represented as `null` on the filter.
 */
export interface ArrayFilter {
	dimension: ArrayDimension;
	values: string[];
}

/**
 * Declarative filter for narrowing a user's book library, designed to translate
 * directly into a Firestore query:
 *
 * - `arrayFilter` holds the single active array dimension (author/tag/language)
 *   — the type makes it impossible to constrain two at once.
 * - `seriesIds` and `publisherIds` map to scalar fields and become `in` filters.
 * - `minRating` becomes a `>=` range filter.
 *
 * Values within a dimension are combined with OR; dimensions with AND.
 */
export interface BookFilter {
	arrayFilter: ArrayFilter | null;
	seriesIds: string[];
	publisherIds: string[];
	/** Inclusive lower bound on the 0-5 star rating. */
	minRating: number | null;
}

export const emptyBookFilter: BookFilter = {
	arrayFilter: null,
	seriesIds: [],
	publisherIds: [],
	minRating: null,
};

export type BookSortKey = "createdAt" | "title" | "pubDate" | "rating";

export type SortDirection = "asc" | "desc";

export interface BookSort {
	key: BookSortKey;
	direction: SortDirection;
}

/** Newest first, matching the previous default ordering of the dashboard. */
export const defaultBookSort: BookSort = {
	key: "createdAt",
	direction: "desc",
};

/** The array dimension currently in use, or null when none is. */
export const activeArrayDimension = (
	filter: BookFilter,
): ArrayDimension | null => filter.arrayFilter?.dimension ?? null;

/** The selected values for `dimension`, or an empty list if it is not active. */
export const arrayValues = (
	filter: BookFilter,
	dimension: ArrayDimension,
): string[] =>
	filter.arrayFilter?.dimension === dimension ? filter.arrayFilter.values : [];

/**
 * Sets the selection for one array dimension, replacing any other active one
 * (only one may be active). An empty selection clears the array filter.
 */
export const withArrayDimension = (
	filter: BookFilter,
	dimension: ArrayDimension,
	values: string[],
): BookFilter => ({
	...filter,
	arrayFilter: values.length > 0 ? { dimension, values } : null,
});

/** Total number of individual filter values applied across all dimensions. */
export const countActiveFilters = (filter: BookFilter): number =>
	(filter.arrayFilter?.values.length ?? 0) +
	filter.seriesIds.length +
	filter.publisherIds.length +
	(filter.minRating !== null ? 1 : 0);

export const isFilterActive = (filter: BookFilter): boolean =>
	countActiveFilters(filter) > 0;
