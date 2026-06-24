import type { Author } from "@calibre-web-serverless/domain/models/author";
import { Language } from "@calibre-web-serverless/domain/models/language";
import type { Publisher } from "@calibre-web-serverless/domain/models/publisher";
import type { Series } from "@calibre-web-serverless/domain/models/series";
import type { Tag } from "@calibre-web-serverless/domain/models/tag";
import type { BookFilter } from "./bookFilter";

export interface FacetOption {
	value: string;
	label: string;
}

export interface BookFacets {
	authors: FacetOption[];
	tags: FacetOption[];
	series: FacetOption[];
	publishers: FacetOption[];
	languages: FacetOption[];
}

const byLabel = (a: FacetOption, b: FacetOption): number =>
	a.label.localeCompare(b.label, undefined, { sensitivity: "base" });

interface FacetEntities {
	authors: Author[];
	series: Series[];
	tags: Tag[];
	publishers: Publisher[];
}

/**
 * Builds the selectable filter options from the full entity lists (loaded
 * independently of the filtered book results) plus the static language and
 * format vocabularies. This keeps every choice available even though the book
 * query itself is filtered server-side.
 */
export const buildBookFacets = ({
	authors,
	series,
	tags,
	publishers,
}: FacetEntities): BookFacets => ({
	authors: authors
		.map((author) => ({ value: author.id, label: author.name }))
		.sort(byLabel),
	tags: tags.map((tag) => ({ value: tag.id, label: tag.name })).sort(byLabel),
	series: series
		.map((entry) => ({ value: entry.id, label: entry.name }))
		.sort(byLabel),
	publishers: publishers
		.map((publisher) => ({ value: publisher.id, label: publisher.name }))
		.sort(byLabel),
	languages: Language.all()
		.map((language) => ({ value: language.code, label: language.name }))
		.sort(byLabel),
});

/** A single removable filter pill shown in the toolbar. */
export interface ActiveFilterChip {
	dimension:
		| "authorIds"
		| "tagIds"
		| "languages"
		| "seriesIds"
		| "publisherIds"
		| "minRating";
	value: string;
	label: string;
}

const labelFor = (options: FacetOption[], value: string): string =>
	options.find((option) => option.value === value)?.label ?? value;

/**
 * Flattens the active filter into labelled chips for display. Labels are
 * resolved against `facets` so they read as human names rather than ids.
 */
export const describeActiveFilters = (
	filter: BookFilter,
	facets: BookFacets,
): ActiveFilterChip[] => {
	const chips: ActiveFilterChip[] = [];

	const pushAll = (
		dimension: ActiveFilterChip["dimension"],
		values: string[],
		options: FacetOption[],
		prefix: string,
	) => {
		for (const value of values) {
			chips.push({
				dimension,
				value,
				label: `${prefix}: ${labelFor(options, value)}`,
			});
		}
	};

	if (filter.arrayFilter) {
		const { dimension, values } = filter.arrayFilter;
		if (dimension === "authorIds") {
			pushAll("authorIds", values, facets.authors, "Author");
		} else if (dimension === "tagIds") {
			pushAll("tagIds", values, facets.tags, "Tag");
		} else {
			pushAll("languages", values, facets.languages, "Language");
		}
	}
	pushAll("seriesIds", filter.seriesIds, facets.series, "Series");
	pushAll("publisherIds", filter.publisherIds, facets.publishers, "Publisher");

	if (filter.minRating !== null) {
		chips.push({
			dimension: "minRating",
			value: String(filter.minRating),
			label: `Rating: ${filter.minRating}+ ★`,
		});
	}

	return chips;
};
