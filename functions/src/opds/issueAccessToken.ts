import { opdsAccessTokenRepository } from "@calibre-web-serverless/infrastructure/admin/repositories/opdsAccessTokenRepository";
import { HttpsError, onCall } from "firebase-functions/v2/https";

// The Implicit Grant has no refresh token, so when a token expires the reader
// sends the user back through the browser. A month keeps that rare while still
// bounding how long a token copied off a device stays useful.
const TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

// Same emulator caveat as searchBookMetadata: there is no App Check backend to
// mint a token locally, so enforcement is deployed-only.
const enforceAppCheck = process.env.FUNCTIONS_EMULATOR !== "true";

/**
 * Mint an OPDS access token for the signed-in caller. Called by the web app's
 * consent page (/authorize/opds) once the user approves a reader; see
 * functions/src/opds/auth.ts for the flow.
 */
export const issueOpdsAccessTokenFn = onCall(
	{ memory: "256MiB", timeoutSeconds: 30, enforceAppCheck },
	async (request) => {
		if (!request.auth) {
			throw new HttpsError("unauthenticated", "Authentication required");
		}
		const { token } = await opdsAccessTokenRepository.issue(
			request.auth.uid,
			TOKEN_TTL_SECONDS,
		);
		return { accessToken: token, expiresIn: TOKEN_TTL_SECONDS };
	},
);
