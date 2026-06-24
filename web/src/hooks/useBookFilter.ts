import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import type { BookFilter, BookSort } from "@/lib/bookFilter";
import {
	filterToSearchParams,
	parseSearchParams,
} from "@/lib/bookFilterParams";

interface UseBookFilterResult {
	filter: BookFilter;
	sort: BookSort;
	setFilter: (filter: BookFilter) => void;
	setSort: (sort: BookSort) => void;
}

/**
 * Single source of truth for the dashboard's filter + sort state, persisted in
 * the URL query string so the view can be bookmarked, shared and restored on
 * reload. State is derived from `useSearchParams`; updates are pushed to the
 * history stack so navigating away (e.g. to a book's edit page) and back
 * restores the active filters.
 */
export const useBookFilter = (): UseBookFilterResult => {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	const { filter, sort } = useMemo(
		() => parseSearchParams(new URLSearchParams(searchParams.toString())),
		[searchParams],
	);

	const apply = useCallback(
		(nextFilter: BookFilter, nextSort: BookSort) => {
			const queryString = filterToSearchParams(nextFilter, nextSort).toString();
			router.push(queryString ? `${pathname}?${queryString}` : pathname, {
				scroll: false,
			});
		},
		[router, pathname],
	);

	const setFilter = useCallback(
		(next: BookFilter) => apply(next, sort),
		[apply, sort],
	);

	const setSort = useCallback(
		(next: BookSort) => apply(filter, next),
		[apply, filter],
	);

	return { filter, sort, setFilter, setSort };
};
