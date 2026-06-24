import {
	type BookFilter,
	defaultBookSort,
	emptyBookFilter,
} from "@calibre-web-serverless/domain/models/bookQuery";
import { describe, expect, it } from "vitest";
import { buildBookQueryConstraints } from "./bookQuery";

const filterWith = (overrides: Partial<BookFilter>): BookFilter => ({
	...emptyBookFilter,
	...overrides,
});

const types = (constraints: { type: string }[]): string[] =>
	constraints.map((constraint) => constraint.type);

describe("buildBookQueryConstraints", () => {
	it("only orders by createdAt for an empty filter", () => {
		const constraints = buildBookQueryConstraints(
			emptyBookFilter,
			defaultBookSort,
		);
		expect(types(constraints)).toEqual(["orderBy"]);
	});

	it("uses array-contains-any for the active array dimension", () => {
		const constraints = buildBookQueryConstraints(
			filterWith({
				arrayFilter: { dimension: "authorIds", values: ["a1", "a2"] },
			}),
			defaultBookSort,
		);
		expect(types(constraints)).toEqual(["where", "orderBy"]);
	});

	it("adds an `in` clause per scalar dimension", () => {
		const constraints = buildBookQueryConstraints(
			filterWith({
				seriesIds: ["s1"],
				publisherIds: ["p1"],
			}),
			defaultBookSort,
		);
		// two `in` filters + the default orderBy
		expect(types(constraints)).toEqual(["where", "where", "orderBy"]);
	});

	it("orders by rating first when a rating bound is combined with another sort", () => {
		const constraints = buildBookQueryConstraints(
			filterWith({ minRating: 4 }),
			{ key: "title", direction: "asc" },
		);
		// where(rating>=) + orderBy(rating) + orderBy(title)
		expect(types(constraints)).toEqual(["where", "orderBy", "orderBy"]);
	});

	it("does not duplicate the rating order when sorting by rating", () => {
		const constraints = buildBookQueryConstraints(
			filterWith({ minRating: 3 }),
			{
				key: "rating",
				direction: "desc",
			},
		);
		expect(types(constraints)).toEqual(["where", "orderBy"]);
	});
});
