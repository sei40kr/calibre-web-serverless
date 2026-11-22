import type { Book } from "@calibre-web-serverless/domain/models/book";
import {
	markedRead,
	type ReadingProgress,
	unreadProgress,
} from "@calibre-web-serverless/domain/models/readingProgress";
import { bookRepository } from "@calibre-web-serverless/infrastructure/repositories/bookRepository";
import { useCallback } from "react";
import { toaster } from "@/components/ui/toaster";

/**
 * Reading status changes that report failures through a toast. Marking as
 * unread clears all progress, so its toast offers to restore it.
 */
export const useReadingStatus = (userId: string) => {
	const save = useCallback(
		(book: Book, reading: ReadingProgress) =>
			bookRepository.updateReadingProgress(userId, book.id, reading),
		[userId],
	);

	const markRead = useCallback(
		(book: Book) => {
			save(book, markedRead(book.reading, new Date())).catch(() => {
				toaster.error({
					title: "Failed to mark as read",
					description: "Please try again.",
				});
			});
		},
		[save],
	);

	const markUnread = useCallback(
		(book: Book) => {
			const previous = book.reading;
			save(book, unreadProgress)
				.then(() => {
					toaster.success({
						title: "Marked as unread",
						description: `Reading progress for ${book.title || "Untitled"} was cleared.`,
						action: {
							label: "Undo",
							onClick: () => {
								save(book, previous).catch(() => {
									toaster.error({
										title: "Failed to restore reading progress",
										description: "Please try again.",
									});
								});
							},
						},
					});
				})
				.catch(() => {
					toaster.error({
						title: "Failed to mark as unread",
						description: "Please try again.",
					});
				});
		},
		[save],
	);

	return { markRead, markUnread };
};
