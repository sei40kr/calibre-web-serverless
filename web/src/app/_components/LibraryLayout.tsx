"use client";

import type { Bookshelf } from "@calibre-web-serverless/domain/models/bookshelf";
import type { User } from "@calibre-web-serverless/domain/models/user";
import { bookshelfRepository } from "@calibre-web-serverless/infrastructure/repositories/bookshelfRepository";
import { opdsAppRepository } from "@calibre-web-serverless/infrastructure/repositories/opdsAppRepository";
import { authService } from "@calibre-web-serverless/infrastructure/services/authService";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { DashboardShell } from "@/components/DashboardShell";
import { SettingsDialog } from "@/components/SettingsDialog";
import { bookshelfHref, Sidebar } from "@/components/Sidebar";
import { toaster } from "@/components/ui/toaster";
import { useBooks } from "@/hooks/useBooks";
import { useBookshelves } from "@/hooks/useBookshelves";
import { useOpdsApps } from "@/hooks/useOpdsApps";
import { OPDS_CATALOG_PATH } from "@/lib/opdsOAuth";

/**
 * The bookshelf sidebar shell shared by the library views and the book details
 * page. The book edit page and the reader render without it.
 */
export function LibraryLayout({ children }: { children: ReactNode }) {
	return (
		<AuthGuard>
			{({ user }) => <LibraryShell user={user}>{children}</LibraryShell>}
		</AuthGuard>
	);
}

const BOOKSHELF_ROUTE = /^\/dashboard\/bookshelves\/([^/]+)/;

function LibraryShell({ user, children }: { user: User; children: ReactNode }) {
	const userId = user.uid;
	const router = useRouter();
	const pathname = usePathname();
	const activeBookshelfId = pathname?.match(BOOKSHELF_ROUTE)?.[1] ?? null;
	const { bookshelves } = useBookshelves(userId);
	const { books } = useBooks(userId);
	const { opdsApps } = useOpdsApps(userId);
	const [isSettingsOpen, setIsSettingsOpen] = useState(false);
	// The origin is only known in the browser, not in the static export.
	const [opdsCatalogUrl, setOpdsCatalogUrl] = useState("");
	useEffect(() => {
		setOpdsCatalogUrl(`${window.location.origin}${OPDS_CATALOG_PATH}`);
	}, []);

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
					onOpenSettings={() => setIsSettingsOpen(true)}
					onCreateBookshelf={handleCreateBookshelf}
					onRenameBookshelf={handleRenameBookshelf}
					onDeleteBookshelf={handleDeleteBookshelf}
					onNavigate={onNavigate}
				/>
			)}
		>
			{children}

			<SettingsDialog
				open={isSettingsOpen}
				onOpenChange={setIsSettingsOpen}
				email={user.email}
				bookCount={books.length}
				bookshelfCount={bookshelves.length}
				onChangeEmail={async (newEmail, currentPassword) => {
					await authService.changeEmail(currentPassword, newEmail);
					toaster.success({
						title: "Verification email sent",
						description: `Open the link sent to ${newEmail} to finish changing your email.`,
					});
				}}
				onChangePassword={async (currentPassword, newPassword) => {
					await authService.changePassword(currentPassword, newPassword);
					toaster.success({
						title: "Password updated",
						description: "Use your new password the next time you sign in.",
					});
				}}
				onDeleteAccount={async (password) => {
					// Signing out sends AuthGuard back to the sign-in page.
					await authService.deleteAccount(password);
					toaster.success({ title: "Account deleted" });
				}}
				opdsCatalogUrl={opdsCatalogUrl}
				opdsApps={opdsApps}
				onRevokeOpdsApp={async (app) => {
					try {
						await opdsAppRepository.revoke(userId, app.id);
					} catch (error) {
						toaster.error({
							title: "Failed to revoke access",
							description: "Please try again.",
						});
						throw error;
					}
					toaster.success({
						title: "Access revoked",
						description: `"${app.name}" can no longer read your library.`,
					});
				}}
			/>
		</DashboardShell>
	);
}
