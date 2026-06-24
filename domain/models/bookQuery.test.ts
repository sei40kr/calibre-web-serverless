import { describe, expect, it } from "vitest";
import {
	activeArrayDimension,
	arrayValues,
	type BookFilter,
	countActiveFilters,
	emptyBookFilter,
	isFilterActive,
	withArrayDimension,
} from "./bookQuery";

const filterWith = (overrides: Partial<BookFilter>): BookFilter => ({
	...emptyBookFilter,
	...overrides,
});

describe("withArrayDimension / arrayValues / activeArrayDimension", () => {
	it("sets the values for an array dimension", () => {
		const filter = withArrayDimension(emptyBookFilter, "tagIds", ["t1", "t2"]);
		expect(filter.arrayFilter).toEqual({
			dimension: "tagIds",
			values: ["t1", "t2"],
		});
		expect(arrayValues(filter, "tagIds")).toEqual(["t1", "t2"]);
		expect(arrayValues(filter, "authorIds")).toEqual([]);
		expect(activeArrayDimension(filter)).toBe("tagIds");
	});

	it("replaces any other active array dimension (only one allowed)", () => {
		const withTags = withArrayDimension(emptyBookFilter, "tagIds", ["t1"]);
		const withAuthors = withArrayDimension(withTags, "authorIds", ["a1"]);
		expect(withAuthors.arrayFilter).toEqual({
			dimension: "authorIds",
			values: ["a1"],
		});
		expect(arrayValues(withAuthors, "tagIds")).toEqual([]);
	});

	it("clears the array filter when the selection becomes empty", () => {
		const filter = withArrayDimension(
			withArrayDimension(emptyBookFilter, "authorIds", ["a1"]),
			"authorIds",
			[],
		);
		expect(filter.arrayFilter).toBeNull();
		expect(activeArrayDimension(filter)).toBeNull();
	});
});

describe("countActiveFilters / isFilterActive", () => {
	it("counts array values plus scalar values plus rating", () => {
		const filter = filterWith({
			arrayFilter: { dimension: "authorIds", values: ["a1", "a2"] },
			seriesIds: ["s1"],
			minRating: 4,
		});
		expect(countActiveFilters(filter)).toBe(4);
	});

	it("treats an empty filter as inactive", () => {
		expect(countActiveFilters(emptyBookFilter)).toBe(0);
		expect(isFilterActive(emptyBookFilter)).toBe(false);
		expect(isFilterActive(filterWith({ publisherIds: ["p1"] }))).toBe(true);
	});
});
