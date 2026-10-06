import { PasskeyError } from "@calibre-web-serverless/domain/errors/passkeyError";
import {
	normalizePasskeyName,
	type Passkey,
} from "@calibre-web-serverless/domain/models/passkey";
import {
	type PasskeyCredential,
	passkeyRepository,
} from "@calibre-web-serverless/infrastructure/admin/repositories/passkeyRepository";
import {
	type AuthenticationResponseJSON,
	generateAuthenticationOptions,
	generateRegistrationOptions,
	type PublicKeyCredentialCreationOptionsJSON,
	type PublicKeyCredentialRequestOptionsJSON,
	type RegistrationResponseJSON,
	verifyAuthenticationResponse,
	verifyRegistrationResponse,
} from "@simplewebauthn/server";

const RP_NAME = "Calibre-Web";

// Long enough to find the phone, short enough that an unanswered challenge
// is not worth stealing. The browser prompt is given the same window.
export const CHALLENGE_TTL_MS = 5 * 60_000;

// Firestore auto-IDs: what createChallenge hands out.
const CHALLENGE_ID = /^[A-Za-z0-9]{20}$/;
// The spec caps credential IDs at 1023 bytes, 1364 base64url characters.
const CREDENTIAL_ID = /^[A-Za-z0-9_-]{1,1364}$/;

/** The request was malformed or came from an origin we do not serve. */
export class InvalidPasskeyRequestError extends Error {}

/** The account side of passkeys, kept behind an interface so tests need no Auth emulator. */
export interface PasskeyAccounts {
	/** null if no such account exists. */
	get(uid: string): Promise<{ email: string | null; disabled: boolean } | null>;
	/** A token the browser exchanges for a Firebase session. */
	createSignInToken(uid: string): Promise<string>;
}

export interface PasskeyContext {
	accounts: PasskeyAccounts;
	/** Exact origins (scheme://host[:port]) the web app is served from. */
	allowedOrigins: readonly string[];
	now?: () => Date;
}

export interface PasskeyOptions<T> {
	challengeId: string;
	options: T;
}

/**
 * Pin the ceremony to the origin the request came from, if it is one we
 * serve. The RP ID is that origin's host, so a passkey made on `web.app`
 * belongs to `web.app` — the browser will not offer it on `firebaseapp.com`.
 */
const resolveRelyingParty = (
	ctx: PasskeyContext,
	origin: string | undefined,
): { origin: string; rpId: string } => {
	if (!origin || !ctx.allowedOrigins.includes(origin)) {
		throw new InvalidPasskeyRequestError(`Origin not allowed: ${origin}`);
	}
	return { origin, rpId: new URL(origin).hostname };
};

const requireChallengeId = (challengeId: unknown): string => {
	if (typeof challengeId !== "string" || !CHALLENGE_ID.test(challengeId)) {
		throw new InvalidPasskeyRequestError("Malformed challenge ID");
	}
	return challengeId;
};

const requireResponse = <T extends { id: string }>(response: unknown): T => {
	const id = (response as { id?: unknown } | null)?.id;
	if (typeof id !== "string" || !CREDENTIAL_ID.test(id)) {
		throw new InvalidPasskeyRequestError("Malformed credential response");
	}
	return response as T;
};

const toPasskey = (credential: PasskeyCredential): Passkey => ({
	id: credential.id,
	name: credential.name,
	backedUp: credential.backedUp,
	createdAt: credential.createdAt,
	lastUsedAt: credential.lastUsedAt,
});

/**
 * Take a challenge out of storage for good and check it is the one this step
 * expects. Whatever the outcome, it cannot be answered again.
 */
const consumeChallenge = async (
	ctx: PasskeyContext,
	challengeId: unknown,
	expected:
		| { type: "registration"; userId: string }
		| { type: "authentication" },
) => {
	const challenge = await passkeyRepository.consumeChallenge(
		requireChallengeId(challengeId),
	);
	const now = ctx.now?.() ?? new Date();
	if (!challenge || challenge.expiresAt <= now) {
		throw new PasskeyError("expired", "The passkey request has expired");
	}
	if (
		challenge.type !== expected.type ||
		(expected.type === "registration" && challenge.userId !== expected.userId)
	) {
		throw new PasskeyError("invalid-credential", "Challenge mismatch");
	}
	return challenge;
};

/** Step 1 of adding a passkey to a signed-in account. */
export const startRegistration = async (
	ctx: PasskeyContext,
	{ userId, origin }: { userId: string; origin: string | undefined },
): Promise<PasskeyOptions<PublicKeyCredentialCreationOptionsJSON>> => {
	const rp = resolveRelyingParty(ctx, origin);
	const account = await ctx.accounts.get(userId);
	if (!account) {
		throw new PasskeyError("invalid-credential", "Unknown account");
	}
	const existing = (await passkeyRepository.listCredentials(userId)).filter(
		(c) => c.rpId === rp.rpId,
	);

	const options = await generateRegistrationOptions({
		rpName: RP_NAME,
		rpID: rp.rpId,
		// The user handle ties every passkey for this account together in the
		// authenticator. The uid is opaque and not personal data, and the
		// authenticator replaces a passkey with the same handle instead of
		// piling up duplicates.
		userID: new TextEncoder().encode(userId),
		userName: account.email ?? userId,
		timeout: CHALLENGE_TTL_MS,
		attestationType: "none",
		// One passkey per authenticator: the browser refuses to make a second.
		excludeCredentials: existing.map((c) => ({
			id: c.id,
			transports: c.transports,
		})),
		authenticatorSelection: {
			// Discoverable, so sign-in needs no email first.
			residentKey: "required",
			// The passkey replaces the password, so it must prove the person,
			// not just a tap.
			userVerification: "required",
		},
	});

	const challengeId = await passkeyRepository.createChallenge({
		type: "registration",
		challenge: options.challenge,
		userId,
		origin: rp.origin,
		rpId: rp.rpId,
		expiresAt: new Date(
			(ctx.now?.() ?? new Date()).getTime() + CHALLENGE_TTL_MS,
		),
	});
	return { challengeId, options };
};

/** Step 2 of adding a passkey: verify the authenticator's response and keep the key. */
export const finishRegistration = async (
	ctx: PasskeyContext,
	{
		userId,
		challengeId,
		response,
		name,
	}: {
		userId: string;
		challengeId: unknown;
		response: unknown;
		name: unknown;
	},
): Promise<Passkey> => {
	const registration = requireResponse<RegistrationResponseJSON>(response);
	const challenge = await consumeChallenge(ctx, challengeId, {
		type: "registration",
		userId,
	});

	let verification: Awaited<ReturnType<typeof verifyRegistrationResponse>>;
	try {
		verification = await verifyRegistrationResponse({
			response: registration,
			expectedChallenge: challenge.challenge,
			expectedOrigin: challenge.origin,
			expectedRPID: challenge.rpId,
			requireUserVerification: true,
		});
	} catch (error) {
		throw new PasskeyError(
			"invalid-credential",
			error instanceof Error ? error.message : "Verification failed",
		);
	}
	if (!verification.verified) {
		throw new PasskeyError("invalid-credential", "Verification failed");
	}

	const info = verification.registrationInfo;
	const credential = {
		id: info.credential.id,
		userId,
		publicKey: info.credential.publicKey,
		counter: info.credential.counter,
		transports: info.credential.transports ?? [],
		rpId: challenge.rpId,
		name:
			normalizePasskeyName(typeof name === "string" ? name : "") || "Passkey",
		backedUp: info.credentialBackedUp,
	};
	if (!(await passkeyRepository.createCredential(credential))) {
		throw new PasskeyError(
			"already-registered",
			"This passkey is already registered",
		);
	}
	const now = ctx.now?.() ?? new Date();
	return toPasskey({ ...credential, createdAt: now, lastUsedAt: null });
};

/** Step 1 of signing in: a challenge for whichever passkey the user picks. */
export const startAuthentication = async (
	ctx: PasskeyContext,
	{ origin }: { origin: string | undefined },
): Promise<PasskeyOptions<PublicKeyCredentialRequestOptionsJSON>> => {
	const rp = resolveRelyingParty(ctx, origin);
	const options = await generateAuthenticationOptions({
		rpID: rp.rpId,
		// Empty: the browser offers every discoverable passkey it holds for
		// this RP, and the response tells us which account it belongs to.
		allowCredentials: [],
		userVerification: "required",
		timeout: CHALLENGE_TTL_MS,
	});
	const challengeId = await passkeyRepository.createChallenge({
		type: "authentication",
		challenge: options.challenge,
		userId: null,
		origin: rp.origin,
		rpId: rp.rpId,
		expiresAt: new Date(
			(ctx.now?.() ?? new Date()).getTime() + CHALLENGE_TTL_MS,
		),
	});
	return { challengeId, options };
};

/**
 * Step 2 of signing in: check the signature against the stored key and, if
 * it holds, mint a sign-in token for the passkey's account.
 */
export const finishAuthentication = async (
	ctx: PasskeyContext,
	{ challengeId, response }: { challengeId: unknown; response: unknown },
): Promise<{ token: string }> => {
	const assertion = requireResponse<AuthenticationResponseJSON>(response);
	const challenge = await consumeChallenge(ctx, challengeId, {
		type: "authentication",
	});

	const credential = await passkeyRepository.getCredential(assertion.id);
	// One error for "no such passkey" and "bad signature", so the endpoint
	// does not tell which credential IDs exist.
	const invalid = new PasskeyError(
		"invalid-credential",
		"The passkey could not be verified",
	);
	if (!credential || credential.rpId !== challenge.rpId) throw invalid;

	let verification: Awaited<ReturnType<typeof verifyAuthenticationResponse>>;
	try {
		verification = await verifyAuthenticationResponse({
			response: assertion,
			expectedChallenge: challenge.challenge,
			expectedOrigin: challenge.origin,
			expectedRPID: challenge.rpId,
			credential: {
				id: credential.id,
				publicKey: credential.publicKey,
				counter: credential.counter,
				transports: credential.transports,
			},
			requireUserVerification: true,
		});
	} catch {
		// Includes a signature counter that went backwards: a sign the key
		// may have been cloned.
		throw invalid;
	}
	if (!verification.verified) throw invalid;

	// The authenticator reports which account it made the passkey for. It
	// must agree with what we stored, or the response was stitched together.
	const userHandle = assertion.response.userHandle;
	if (
		userHandle !== undefined &&
		Buffer.from(userHandle, "base64url").toString("utf8") !== credential.userId
	) {
		throw invalid;
	}

	const account = await ctx.accounts.get(credential.userId);
	if (!account) throw invalid;
	if (account.disabled) {
		throw new PasskeyError("user-disabled", "This account has been disabled");
	}

	await passkeyRepository.recordCredentialUse(credential.id, {
		counter: verification.authenticationInfo.newCounter,
		backedUp: verification.authenticationInfo.credentialBackedUp,
	});
	return { token: await ctx.accounts.createSignInToken(credential.userId) };
};

export const listPasskeys = async (userId: string): Promise<Passkey[]> =>
	(await passkeyRepository.listCredentials(userId)).map(toPasskey);

export const deletePasskey = async (
	userId: string,
	passkeyId: unknown,
): Promise<void> => {
	if (typeof passkeyId !== "string" || !CREDENTIAL_ID.test(passkeyId)) {
		throw new InvalidPasskeyRequestError("Malformed passkey ID");
	}
	// Deleting a passkey that is already gone is not worth an error.
	await passkeyRepository.deleteCredential(userId, passkeyId);
};
