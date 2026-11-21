"use client";

import { opdsAppRepository } from "@calibre-web-serverless/infrastructure/repositories/opdsAppRepository";
import { Center, Spinner } from "@chakra-ui/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { OAuthConsentPage } from "@/components/pages/OAuthConsentPage";
import { useAuth } from "@/contexts/AuthContext";
import { OAUTH_AUTHORIZE_PATH, opdsCallbackUrl } from "@/lib/opdsOAuth";

// The `authenticate` link of the OPDS Authentication Document: the OAuth
// implicit grant's authorization endpoint.
export default function OAuthAuthorizeRoute() {
	const router = useRouter();
	const { user, loading, signOut } = useAuth();

	useEffect(() => {
		if (!loading && !user) {
			router.replace(`/?next=${encodeURIComponent(OAUTH_AUTHORIZE_PATH)}`);
		}
	}, [user, loading, router]);

	if (!user) {
		return (
			<Center h="100vh">
				<Spinner size="xl" />
			</Center>
		);
	}

	return (
		<OAuthConsentPage
			email={user.email}
			onAllow={async (name) => {
				const token = await opdsAppRepository.authorize(user.uid, name);
				window.location.assign(
					opdsCallbackUrl(window.location.origin, {
						access_token: token,
						token_type: "bearer",
					}),
				);
			}}
			onCancel={() =>
				window.location.assign(
					opdsCallbackUrl(window.location.origin, { error: "access_denied" }),
				)
			}
			onSwitchAccount={signOut}
		/>
	);
}
