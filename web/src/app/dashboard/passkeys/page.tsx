"use client";

import { PasskeyError } from "@calibre-web-serverless/domain/errors/passkeyError";
import type { Passkey } from "@calibre-web-serverless/domain/models/passkey";
import { passkeyService } from "@calibre-web-serverless/infrastructure/services/passkeyService";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { PasskeysPage } from "@/components/pages/PasskeysPage";
import { toaster } from "@/components/ui/toaster";
import { usePasskeys } from "@/hooks/usePasskeys";

export default function PasskeysRoute() {
	return (
		<AuthGuard>
			{({ user }) => <PasskeysRouteContent userId={user.uid} />}
		</AuthGuard>
	);
}

const registrationErrorDescription = (error: unknown): string | null => {
	if (!(error instanceof PasskeyError)) return "Please try again.";
	switch (error.code) {
		// Dismissing the browser prompt is a choice, not a failure.
		case "cancelled":
			return null;
		case "already-registered":
			return "This device already has a passkey for your account.";
		case "expired":
			return "The request timed out. Please try again.";
		case "unsupported":
			return "This browser does not support passkeys.";
		default:
			return "Please try again.";
	}
};

function PasskeysRouteContent({ userId }: { userId: string }) {
	const router = useRouter();
	const { passkeys, loading, error, reload } = usePasskeys(userId);

	const handleAdd = useCallback(
		async (name: string) => {
			let passkey: Passkey;
			try {
				passkey = await passkeyService.register(name);
			} catch (error) {
				const description = registrationErrorDescription(error);
				if (description) {
					toaster.error({ title: "Failed to add passkey", description });
				}
				throw error;
			}
			toaster.success({
				title: "Passkey added",
				description: `You can now sign in with "${passkey.name}".`,
			});
			reload();
		},
		[reload],
	);

	const handleDelete = useCallback(
		async (passkey: Passkey) => {
			try {
				await passkeyService.delete(passkey.id);
			} catch (error) {
				toaster.error({
					title: "Failed to delete passkey",
					description: "Please try again.",
				});
				throw error;
			}
			toaster.success({
				title: "Passkey deleted",
				description: `"${passkey.name}" can no longer sign you in.`,
			});
			reload();
		},
		[reload],
	);

	return (
		<PasskeysPage
			passkeys={passkeys}
			loading={loading}
			loadError={error !== null}
			supported={passkeyService.isSupported()}
			onAdd={handleAdd}
			onDelete={handleDelete}
			onBack={() => router.push("/dashboard")}
		/>
	);
}
