import {
	PasskeyError,
	type PasskeyErrorCode,
} from "@calibre-web-serverless/domain/errors/passkeyError";
import type { Passkey } from "@calibre-web-serverless/domain/models/passkey";
import type { User } from "@calibre-web-serverless/domain/models/user";
import {
	type AuthenticationResponseJSON,
	browserSupportsWebAuthn,
	type PublicKeyCredentialCreationOptionsJSON,
	type PublicKeyCredentialRequestOptionsJSON,
	type RegistrationResponseJSON,
	startAuthentication,
	startRegistration,
	WebAuthnError,
} from "@simplewebauthn/browser";
import { FirebaseError } from "firebase/app";
import { signInWithCustomToken } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { auth, functions } from "../lib/firebase";

interface PasskeyOptions<T> {
	challengeId: string;
	options: T;
}

interface PasskeyJSON {
	id: string;
	name: string;
	backedUp: boolean;
	createdAt: string;
	lastUsedAt: string | null;
}

const startRegistrationCallable = httpsCallable<
	void,
	PasskeyOptions<PublicKeyCredentialCreationOptionsJSON>
>(functions, "startPasskeyRegistration");

const finishRegistrationCallable = httpsCallable<
	{ challengeId: string; response: RegistrationResponseJSON; name: string },
	PasskeyJSON
>(functions, "finishPasskeyRegistration");

const startSignInCallable = httpsCallable<
	void,
	PasskeyOptions<PublicKeyCredentialRequestOptionsJSON>
>(functions, "startPasskeySignIn");

const finishSignInCallable = httpsCallable<
	{ challengeId: string; response: AuthenticationResponseJSON },
	{ token: string }
>(functions, "finishPasskeySignIn");

const listCallable = httpsCallable<void, PasskeyJSON[]>(
	functions,
	"listPasskeys",
);

const deleteCallable = httpsCallable<{ passkeyId: string }, null>(
	functions,
	"deletePasskey",
);

const toPasskey = (json: PasskeyJSON): Passkey => ({
	id: json.id,
	name: json.name,
	backedUp: json.backedUp,
	createdAt: new Date(json.createdAt),
	lastUsedAt: json.lastUsedAt ? new Date(json.lastUsedAt) : null,
});

const PASSKEY_ERROR_CODES: readonly string[] = [
	"unsupported",
	"cancelled",
	"already-registered",
	"expired",
	"invalid-credential",
	"user-disabled",
] satisfies PasskeyErrorCode[];

/** Fold browser, callable and Auth failures into one domain error. */
const toPasskeyError = (error: unknown): unknown => {
	if (error instanceof PasskeyError) return error;
	if (error instanceof WebAuthnError) {
		// Dismissed, timed out, or aborted: browsers deliberately report these
		// the same way, so they all read as "cancelled".
		if (
			error.name === "NotAllowedError" ||
			error.code === "ERROR_CEREMONY_ABORTED"
		) {
			return new PasskeyError("cancelled", error.message);
		}
		if (error.code === "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED") {
			return new PasskeyError("already-registered", error.message);
		}
		return new PasskeyError("unknown", error.message);
	}
	if (error instanceof FirebaseError) {
		// Callable errors carry the server's domain code in `details`.
		const code = (error as FirebaseError & { details?: { code?: unknown } })
			.details?.code;
		if (typeof code === "string" && PASSKEY_ERROR_CODES.includes(code)) {
			return new PasskeyError(code as PasskeyErrorCode, error.message);
		}
		if (error.code === "auth/user-disabled") {
			return new PasskeyError("user-disabled", error.message);
		}
		return new PasskeyError("unknown", error.message);
	}
	return error;
};

const withPasskeyErrors = async <T>(fn: () => Promise<T>): Promise<T> => {
	try {
		return await fn();
	} catch (error) {
		throw toPasskeyError(error);
	}
};

const requireSupport = () => {
	if (!browserSupportsWebAuthn()) {
		throw new PasskeyError(
			"unsupported",
			"This browser does not support passkeys",
		);
	}
};

/**
 * Passkey sign-in and management. Firebase Auth has no WebAuthn provider, so
 * the ceremonies run against our own callables, which verify the browser's
 * response and — for sign-in — hand back a custom token that becomes an
 * ordinary Firebase session.
 */
export const passkeyService = {
	isSupported(): boolean {
		return typeof window !== "undefined" && browserSupportsWebAuthn();
	},

	/** Create a passkey on this device for the signed-in account. */
	register(name: string): Promise<Passkey> {
		return withPasskeyErrors(async () => {
			requireSupport();
			const { data } = await startRegistrationCallable();
			const response = await startRegistration({ optionsJSON: data.options });
			const { data: passkey } = await finishRegistrationCallable({
				challengeId: data.challengeId,
				response,
				name,
			});
			return toPasskey(passkey);
		});
	},

	/** Sign in with whichever passkey the user picks in the browser prompt. */
	signIn(): Promise<User> {
		return withPasskeyErrors(async () => {
			requireSupport();
			const { data } = await startSignInCallable();
			const response = await startAuthentication({
				optionsJSON: data.options,
			});
			const {
				data: { token },
			} = await finishSignInCallable({
				challengeId: data.challengeId,
				response,
			});
			const credential = await signInWithCustomToken(auth, token);
			return { uid: credential.user.uid };
		});
	},

	/** The signed-in account's passkeys, oldest first. */
	list(): Promise<Passkey[]> {
		return withPasskeyErrors(async () => {
			const { data } = await listCallable();
			return data.map(toPasskey);
		});
	},

	/** Revoke a passkey. It stays in the authenticator but no longer signs in. */
	delete(passkeyId: string): Promise<void> {
		return withPasskeyErrors(async () => {
			await deleteCallable({ passkeyId });
		});
	},
};
