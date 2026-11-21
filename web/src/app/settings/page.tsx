"use client";

import { authService } from "@calibre-web-serverless/infrastructure/services/authService";
import { AuthGuard } from "@/components/AuthGuard";
import { SettingsPage } from "@/components/pages/SettingsPage";
import { toaster } from "@/components/ui/toaster";

export default function SettingsRoute() {
	return (
		<AuthGuard>
			{({ user, signOut }) => (
				<SettingsPage
					email={user.email}
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
				/>
			)}
		</AuthGuard>
	);
}
