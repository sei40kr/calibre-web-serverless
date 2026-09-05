"use client";

import type { Bookshelf } from "@calibre-web-serverless/domain/models/bookshelf";
import { bookshelfRepository } from "@calibre-web-serverless/infrastructure/repositories/bookshelfRepository";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useCallback } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { DashboardShell } from "@/components/DashboardShell";
import { bookshelfHref, Sidebar } from "@/components/Sidebar";
import { toaster } from "@/components/ui/toaster";
import { useBookshelves } from "@/hooks/useBookshelves";

// The library views (all books and each bookshelf) share the bookshelf sidebar. The
// book edit page lives outside this route group and renders without it.
export default function LibraryLayout({ children }: { children: ReactNode }) {
	return (
		<AuthGuard>
			{({ user }) => <LibraryShell userId={user.uid}>{children}</LibraryShell>}
		</AuthGuard>
	);
}

const BOOKSHELF_ROUTE = /^\/dashboard\/bookshelves\/([^/]+)/;

function LibraryShell({
	userId,
	children,
}: {
	userId: string;
	children: ReactNode;
}) {
	const router = useRouter();
	const pathname = usePathname();
	const activeBookshelfId = pathname?.match(BOOKSHELF_ROUTE)?.[1] ?? null;
	const { bookshelves } = useBookshelves(userId);

	const handleCreateBookshelf = useCallback(
		async (name: string) => {
			// Validation errors (blank/duplicate name) propagate to the dialog,
			// which explains them inline; only unexpected failures get a toast.
			let bookshelf: Bookshelf;
			try {
				bookshelf = await bookshelfRepository.create(userId, name);
			} catch (error) {
				toaster.error({
					title: "Failed to create bookshelf",
					description: "Please try again.",
				});
				throw error;
			}
			toaster.success({
				title: "Bookshelf created",
				description: `"${bookshelf.name}" is ready for books.`,
			});
			router.push(bookshelfHref(bookshelf.id));
		},
		[userId, router],
	);

	const handleRenameBookshelf = useCallback(
		async (bookshelf: Bookshelf, name: string) => {
			// Like `create`: name problems surface inline in the dialog, so only
			// unexpected failures get a toast.
			try {
				await bookshelfRepository.update(userId, { ...bookshelf, name });
			} catch (error) {
				toaster.error({
					title: "Failed to rename bookshelf",
					description: "Please try again.",
				});
				throw error;
			}
			toaster.success({
				title: "Bookshelf renamed",
				description: `"${bookshelf.name}" is now "${name}".`,
			});
		},
		[userId],
	);

	const handleDeleteBookshelf = useCallback(
		async (bookshelf: Bookshelf) => {
			try {
				await bookshelfRepository.delete(userId, bookshelf.id);
			} catch (error) {
				toaster.error({
					title: "Failed to delete bookshelf",
					description: "Please try again.",
				});
				throw error;
			}
			toaster.success({
				title: "Bookshelf deleted",
				description: `"${bookshelf.name}" has been deleted.`,
			});
			if (bookshelf.id === activeBookshelfId) {
				router.push("/dashboard");
			}
		},
		[userId, activeBookshelfId, router],
	);

	return (
		<DashboardShell
			sidebar={({ onNavigate }) => (
				<Sidebar
					bookshelves={bookshelves}
					activeBookshelfId={activeBookshelfId}
					onCreateBookshelf={handleCreateBookshelf}
					onRenameBookshelf={handleRenameBookshelf}
					onDeleteBookshelf={handleDeleteBookshelf}
					onNavigate={onNavigate}
				/>
			)}
		>
			{children}
		</DashboardShell>
	);
}
