import { getAuth } from "firebase-admin/auth";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { deleteUserData } from "./usecase";

// The client re-authenticates with the password right before calling, so an
// older sign-in means the password was never confirmed for this request, as
// with a stolen session.
const MAX_SIGN_IN_AGE_SECONDS = 5 * 60;

// See searchBookMetadata: the emulator has no App Check backend.
const enforceAppCheck = process.env.FUNCTIONS_EMULATOR !== "true";

/**
 * Deletes the caller's library and then their account. The library goes
 * first, so a failure part-way leaves an account the user can sign in to and
 * retry from, never data without an owner.
 */
export const deleteAccountFn = onCall(
	{ memory: "256MiB", timeoutSeconds: 300, enforceAppCheck },
	async (request) => {
		if (!request.auth) {
			throw new HttpsError("unauthenticated", "Authentication required");
		}
		const signInAge = Date.now() / 1000 - request.auth.token.auth_time;
		if (signInAge > MAX_SIGN_IN_AGE_SECONDS) {
			throw new HttpsError("failed-precondition", "Recent sign-in required");
		}

		await deleteUserData(request.auth.uid);
		await getAuth().deleteUser(request.auth.uid);
	},
);
