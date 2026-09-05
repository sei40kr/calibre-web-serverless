/**
 * A user-created collection of books ("bookshelf" in calibre-web). Membership
 * is recorded on each book (`Book.bookshelfIds`) so a bookshelf's contents can be
 * queried like any other book dimension; `bookCount` is a denormalised count
 * kept in sync by the repository whenever membership changes.
 */
export interface Bookshelf {
	id: string;
	name: string;
	bookCount: number;
	createdAt: Date | null;
	updatedAt: Date | null;
}

export const MAX_BOOKSHELF_NAME_LENGTH = 100;

/**
 * Canonical form of a bookshelf name as entered by the user: surrounding
 * whitespace is dropped and internal runs of whitespace collapsed, so two
 * names that only differ in spacing are the same bookshelf.
 */
export const normalizeBookshelfName = (name: string): string =>
	name.trim().replace(/\s+/g, " ");

export type BookshelfNameProblem = "empty" | "too-long";

/** Why a (normalised) name cannot be used for a bookshelf, or null if it can. */
export const bookshelfNameProblem = (
	name: string,
): BookshelfNameProblem | null => {
	const normalized = normalizeBookshelfName(name);
	if (normalized.length === 0) return "empty";
	if (normalized.length > MAX_BOOKSHELF_NAME_LENGTH) return "too-long";
	return null;
};

export const isBookInBookshelf = (
	book: { bookshelfIds: string[] },
	bookshelfId: string,
): boolean => book.bookshelfIds.includes(bookshelfId);
