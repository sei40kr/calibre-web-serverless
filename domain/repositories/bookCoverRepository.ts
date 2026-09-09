/** Identifies which stored cover image a book currently displays. */
export interface CoverRef {
	/** Whether a metadata-extracted cover (cover.png) exists. */
	hasCover: boolean;
	/** Whether a user-uploaded custom cover is active. */
	hasCustomCover: boolean;
}

/** Whether a book has any displayable cover (custom or extracted). */
export function hasAnyCover(ref: CoverRef): boolean {
	return ref.hasCustomCover || ref.hasCover;
}

export interface BookCoverRepository {
	/**
	 * Resolves a URL for the book's active cover. Callers should guard with
	 * {@link hasAnyCover}; rejects if no cover exists.
	 *
	 * The caller owns the URL: the web implementation returns an object URL,
	 * which must be released with `URL.revokeObjectURL` once the cover is no longer displayed.
	 */
	getCoverUrl(userId: string, bookId: string, ref: CoverRef): Promise<string>;
	/**
	 * Uploads a raw custom cover to the staging path. A Cloud Function resizes it,
	 * stores the final custom cover, and flips the book's `hasCustomCover` flag.
	 */
	uploadCustomCover(params: {
		userId: string;
		bookId: string;
		file: File;
	}): Promise<void>;
	/**
	 * Discards the custom cover and reverts to the metadata-extracted cover by
	 * deleting the custom image and clearing the book's `hasCustomCover` flag.
	 */
	resetCustomCover(params: { userId: string; bookId: string }): Promise<void>;
}
