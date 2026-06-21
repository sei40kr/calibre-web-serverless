import type { MetadataProvider } from "../types";
import { googlePlayBooksProvider } from "./googlePlayBooks";

/**
 * All registered metadata providers. Add new e-book stores here; the search
 * usecase queries each in parallel and the client needs no changes.
 *
 * `satisfies` (rather than a `MetadataProvider[]` annotation) keeps each
 * provider's literal `source`, so `MetadataSource`/`METADATA_SOURCES` below
 * stay in sync with this list automatically.
 */
export const providers = [
	googlePlayBooksProvider,
] satisfies readonly MetadataProvider[];

/** Union of every registered provider's source key, derived from `providers`. */
export type MetadataSource = (typeof providers)[number]["source"];

/** Runtime list of the known source keys, derived from `providers`. */
export const METADATA_SOURCES: readonly MetadataSource[] = providers.map(
	(p) => p.source,
);
