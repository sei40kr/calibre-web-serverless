"use client";

import type { User } from "@calibre-web-serverless/domain/models/user";
import { authService } from "@calibre-web-serverless/infrastructure/services/authService";
import { AuthGuard } from "@/components/AuthGuard";
import { SettingsPage } from "@/components/pages/SettingsPage";
import { toaster } from "@/components/ui/toaster";
import { useBooks } from "@/hooks/useBooks";
import { useBookshelves } from "@/hooks/useBookshelves";

function SettingsContent({
	user,
	signOut,
}: {
	user: User;
	signOut: () => Promise<void>;
}) {
	const { books } = useBooks(user.uid);
	const { bookshelves } = useBookshelves(user.uid);

	return (
		<SettingsPage
			email={user.email}
			bookCount={books.length}
			bookshelfCount={bookshelves.length}
			onSignOut={signOut}
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
		/>
	);
}

export default function SettingsRoute() {
	return (
		<AuthGuard>
			{({ user, signOut }) => <SettingsContent user={user} signOut={signOut} />}
		</AuthGuard>
	);
}
