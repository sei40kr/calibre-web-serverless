import { PasskeyError } from "@calibre-web-serverless/domain/errors/passkeyError";
import type { Passkey } from "@calibre-web-serverless/domain/models/passkey";
import { getAuth } from "firebase-admin/auth";
import { logger } from "firebase-functions/v2";
import {
	type CallableRequest,
	HttpsError,
	onCall,
} from "firebase-functions/v2/https";
import {
	deletePasskey,
	finishAuthentication,
	finishRegistration,
	InvalidPasskeyRequestError,
	listPasskeys,
	type PasskeyContext,
	startAuthentication,
	startRegistration,
} from "./usecase";

// Same emulator caveat as the metadata-search callables: there is no App
// Check backend to mint a token locally, so enforcement is deployed-only.
const enforceAppCheck = process.env.FUNCTIONS_EMULATOR !== "true";

// The origins WebAuthn ceremonies may run on. Deploy writes the Hosting
// domains into functions/.env.<projectId>; locally the app is served by
// `next dev` (3000) or the Hosting emulator (5000). Unset in a deployed
// project means no origin is accepted — passkeys fail closed.
const allowedOrigins = (
	process.env.PASSKEY_ALLOWED_ORIGINS ??
	(process.env.FUNCTIONS_EMULATOR === "true"
		? "http://localhost:3000,http://localhost:5000"
		: "")
)
	.split(",")
	.map((origin) => origin.trim())
	.filter(Boolean);

const context: PasskeyContext = {
	allowedOrigins,
	accounts: {
		async get(uid) {
			try {
				const user = await getAuth().getUser(uid);
				return { email: user.email ?? null, disabled: user.disabled };
			} catch (error) {
				if ((error as { code?: unknown }).code === "auth/user-not-found") {
					return null;
				}
				throw error;
			}
		},
		createSignInToken: (uid) => getAuth().createCustomToken(uid),
	},
};

const PASSKEY_ERROR_STATUS = {
	unsupported: "failed-precondition",
	cancelled: "cancelled",
	"already-registered": "already-exists",
	expired: "deadline-exceeded",
	"invalid-credential": "unauthenticated",
	"user-disabled": "permission-denied",
	unknown: "internal",
} as const;

/**
 * Translate usecase failures into callable errors. The client reads the
 * domain code back out of `details`, since several codes share an HTTP status.
 */
const handle =
	<T>(fn: (request: CallableRequest) => Promise<T>) =>
	async (request: CallableRequest): Promise<T> => {
		try {
			return await fn(request);
		} catch (error) {
			if (error instanceof PasskeyError) {
				throw new HttpsError(PASSKEY_ERROR_STATUS[error.code], error.message, {
					code: error.code,
				});
			}
			if (error instanceof InvalidPasskeyRequestError) {
				throw new HttpsError("invalid-argument", error.message);
			}
			if (error instanceof HttpsError) throw error;
			logger.error("passkey request failed", { error });
			throw new HttpsError("internal", "Passkey request failed");
		}
	};

const requireUid = (request: CallableRequest): string => {
	if (!request.auth) {
		throw new HttpsError("unauthenticated", "Authentication required");
	}
	return request.auth.uid;
};

const originOf = (request: CallableRequest): string | undefined =>
	request.rawRequest.headers.origin;

const data = (request: CallableRequest) =>
	(request.data ?? {}) as Record<string, unknown>;

// Callable payloads are JSON: dates travel as ISO strings.
const serializePasskey = (passkey: Passkey) => ({
	...passkey,
	createdAt: passkey.createdAt.toISOString(),
	lastUsedAt: passkey.lastUsedAt?.toISOString() ?? null,
});

const options = {
	memory: "256MiB" as const,
	timeoutSeconds: 30,
	enforceAppCheck,
};

export const startPasskeyRegistrationFn = onCall(
	options,
	handle((request) =>
		startRegistration(context, {
			userId: requireUid(request),
			origin: originOf(request),
		}),
	),
);

export const finishPasskeyRegistrationFn = onCall(
	options,
	handle(async (request) => {
		const passkey = await finishRegistration(context, {
			userId: requireUid(request),
			challengeId: data(request).challengeId,
			response: data(request).response,
			name: data(request).name,
		});
		return serializePasskey(passkey);
	}),
);

// Sign-in is necessarily open to unauthenticated callers. Each start call
// writes one short-lived document; App Check keeps that to real browsers
// running this app, and the TTL policy sweeps what is never answered.
export const startPasskeySignInFn = onCall(
	options,
	handle((request) =>
		startAuthentication(context, { origin: originOf(request) }),
	),
);

export const finishPasskeySignInFn = onCall(
	options,
	handle((request) =>
		finishAuthentication(context, {
			challengeId: data(request).challengeId,
			response: data(request).response,
		}),
	),
);

export const listPasskeysFn = onCall(
	options,
	handle(async (request) =>
		(await listPasskeys(requireUid(request))).map(serializePasskey),
	),
);

export const deletePasskeyFn = onCall(
	options,
	handle(async (request) => {
		await deletePasskey(requireUid(request), data(request).passkeyId);
		return null;
	}),
);
