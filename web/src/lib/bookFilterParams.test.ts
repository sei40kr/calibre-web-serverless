import { describe, expect, it } from "vitest";
import {
	type BookFilter,
	type BookSort,
	defaultBookSort,
	emptyBookFilter,
} from "./bookFilter";
import { filterToSearchParams, parseSearchParams } from "./bookFilterParams";

const roundTrip = (filter: BookFilter, sort: BookSort) =>
	parseSearchParams(filterToSearchParams(filter, sort));

describe("filterToSearchParams", () => {
	it("omits empty values and the default sort", () => {
		const params = filterToSearchParams(emptyBookFilter, defaultBookSort);
		expect(params.toString()).toBe("");
	});

	it("serialises the active array dimension and scalar dimensions", () => {
		const params = filterToSearchParams(
			{
				...emptyBookFilter,
				arrayFilter: { dimension: "authorIds", values: ["a1", "a2"] },
				seriesIds: ["s1"],
				minRating: 4,
			},
			{ key: "title", direction: "asc" },
		);
		expect(params.get("authors")).toBe("a1,a2");
		expect(params.get("series")).toBe("s1");
		expect(params.get("rating")).toBe("4");
		expect(params.get("sort")).toBe("title:asc");
	});
});

describe("parseSearchParams", () => {
	it("round-trips a fully populated filter", () => {
		const filter: BookFilter = {
			arrayFilter: { dimension: "tagIds", values: ["t1", "t2"] },
			seriesIds: ["s1"],
			publisherIds: ["p1"],
			minRating: 3,
		};
		const sort: BookSort = { key: "rating", direction: "desc" };
		expect(roundTrip(filter, sort)).toEqual({ filter, sort });
	});

	it("keeps only the first array dimension when several are present", () => {
		const { filter } = parseSearchParams(
			new URLSearchParams("authors=a1&tags=t1"),
		);
		expect(filter.arrayFilter).toEqual({
			dimension: "authorIds",
			values: ["a1"],
		});
	});

	it("falls back to defaults for missing or invalid params", () => {
		const { filter, sort } = parseSearchParams(new URLSearchParams(""));
		expect(filter).toEqual(emptyBookFilter);
		expect(sort).toEqual(defaultBookSort);
	});

	it("ignores an unknown sort key and out-of-range rating", () => {
		const { filter, sort } = parseSearchParams(
			new URLSearchParams("sort=bogus:asc&rating=9"),
		);
		expect(sort).toEqual(defaultBookSort);
		expect(filter.minRating).toBeNull();
	});
});
