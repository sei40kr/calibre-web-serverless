"use client";

import { opdsAccessTokenService } from "@calibre-web-serverless/infrastructure/services/opdsAccessTokenService";
import { Center, Spinner } from "@chakra-ui/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import {
	OpdsAuthorizePage,
	type OpdsAuthorizeStatus,
} from "@/components/pages/OpdsAuthorizePage";
import { useAuth } from "@/contexts/AuthContext";
import {
	buildOpdsDeniedCallbackUrl,
	buildOpdsTokenCallbackUrl,
	parseOpdsAuthorizeRequest,
} from "@/lib/opdsAuthorization";

// The `authenticate` link of the OPDS Authentication Document points here.
// Unlike AuthGuard, a signed-out visitor is sent to sign in and brought back,
// since the reader's request lives in this page's query string.
export default function OpdsAuthorizeRoute() {
	return (
		<Suspense fallback={<FullPageSpinner />}>
			<OpdsAuthorizeRouteContent />
		</Suspense>
	);
}

function FullPageSpinner() {
	return (
		<Center h="100vh">
			<Spinner size="xl" />
		</Center>
	);
}

function OpdsAuthorizeRouteContent() {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const { user, loading } = useAuth();
	const request = useMemo(
		() => parseOpdsAuthorizeRequest(new URLSearchParams(searchParams)),
		[searchParams],
	);
	const [status, setStatus] = useState<OpdsAuthorizeStatus>(
		request ? "ready" : "invalid-request",
	);

	useEffect(() => {
		if (!loading && !user) {
			const query = searchParams.toString();
			const next = query ? `${pathname}?${query}` : pathname;
			router.replace(`/?next=${encodeURIComponent(next)}`);
		}
	}, [loading, user, pathname, searchParams, router]);

	if (loading || !user) return <FullPageSpinner />;

	const handleAllow = async () => {
		if (!request) return;
		setStatus("authorizing");
		try {
			const token = await opdsAccessTokenService.issue();
			window.location.assign(
				buildOpdsTokenCallbackUrl(request, window.location.origin, token),
			);
			setStatus("authorized");
		} catch {
			setStatus("failed");
		}
	};

	const handleDeny = () => {
		if (!request) return;
		window.location.assign(
			buildOpdsDeniedCallbackUrl(request, window.location.origin),
		);
		setStatus("denied");
	};

	return (
		<OpdsAuthorizePage
			status={status}
			onAllow={handleAllow}
			onDeny={handleDeny}
		/>
	);
}
