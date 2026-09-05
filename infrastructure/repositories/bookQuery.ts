import {
	type BookFilter,
	type BookSort,
	type BookSortKey,
	defaultBookSort,
} from "@calibre-web-serverless/domain/models/bookQuery";
import { orderBy, type QueryConstraint, where } from "firebase/firestore";

const SORT_FIELD: Record<BookSortKey, string> = {
	createdAt: "createdAt",
	title: "title",
	pubDate: "pubDate",
	rating: "rating",
};

/**
 * Translates a {@link BookFilter} and {@link BookSort} into Firestore query
 * constraints, staying within Firestore's query model:
 *
 * - At most one array-membership clause, so only the single active array
 *   dimension (author/tag/language) becomes an `array-contains-any`. A bookshelf
 *   scope is an `array-contains` on `bookshelfIds` and therefore excludes any
 *   active array dimension: the two cannot be requested together.
 * - Scalar dimensions become `in` filters and `minRating` a `>=` range filter.
 * - A range filter requires its field to be the first `orderBy`, so when a
 *   rating bound is present and the chosen sort is not rating, an explicit
 *   `orderBy("rating")` is prepended ahead of the requested sort.
 *
 * Each filter+sort combination needs a matching Firestore composite index in
 * production (the emulator does not enforce them); see firestore.indexes.json.
 */
export const buildBookQueryConstraints = (
	filter?: BookFilter,
	sort: BookSort = defaultBookSort,
	bookshelfId?: string,
): QueryConstraint[] => {
	const constraints: QueryConstraint[] = [];

	if (bookshelfId !== undefined) {
		if (filter?.arrayFilter) {
			throw new Error(
				"A bookshelf scope cannot be combined with an author/tag/language filter",
			);
		}
		constraints.push(where("bookshelfIds", "array-contains", bookshelfId));
	}

	if (filter) {
		if (filter.arrayFilter) {
			constraints.push(
				where(
					filter.arrayFilter.dimension,
					"array-contains-any",
					filter.arrayFilter.values,
				),
			);
		}

		if (filter.seriesIds.length > 0) {
			constraints.push(where("seriesId", "in", filter.seriesIds));
		}
		if (filter.publisherIds.length > 0) {
			constraints.push(where("publisherId", "in", filter.publisherIds));
		}
		if (filter.minRating !== null) {
			constraints.push(where("rating", ">=", filter.minRating));
		}
	}

	// Firestore requires the inequality (range) field to be ordered first.
	if (filter?.minRating != null && sort.key !== "rating") {
		constraints.push(orderBy("rating", "desc"));
	}
	constraints.push(orderBy(SORT_FIELD[sort.key], sort.direction));

	return constraints;
};
