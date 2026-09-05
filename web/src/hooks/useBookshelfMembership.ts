import type { Book } from "@calibre-web-serverless/domain/models/book";
import type { Bookshelf } from "@calibre-web-serverless/domain/models/bookshelf";
import { bookshelfMembershipService } from "@calibre-web-serverless/infrastructure/services/bookshelfMembershipService";
import { useCallback } from "react";
import { toaster } from "@/components/ui/toaster";

/**
 * Bookshelf membership mutations shared by every view that offers "add to bookshelf":
 * each one reports its outcome through a toast and rethrows on failure so the
 * calling component can keep its own state (e.g. a dialog) open.
 */
export const useBookshelfMembership = (userId: string) => {
	const setBookOnBookshelf = useCallback(
		async (book: Book, bookshelf: Bookshelf, member: boolean) => {
			const title = book.title || "Untitled";
			try {
				if (member) {
					await bookshelfMembershipService.addBook(
						userId,
						bookshelf.id,
						book.id,
					);
					toaster.success({
						title: "Added to bookshelf",
						description: `"${title}" was added to "${bookshelf.name}".`,
					});
				} else {
					await bookshelfMembershipService.removeBook(
						userId,
						bookshelf.id,
						book.id,
					);
					toaster.success({
						title: "Removed from bookshelf",
						description: `"${title}" was removed from "${bookshelf.name}".`,
					});
				}
			} catch (error) {
				toaster.error({
					title: member
						? "Failed to add to bookshelf"
						: "Failed to remove from bookshelf",
					description: "Please try again.",
				});
				throw error;
			}
		},
		[userId],
	);

	return { setBookOnBookshelf };
};
