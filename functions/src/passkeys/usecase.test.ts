import { PasskeyError } from "@calibre-web-serverless/domain/errors/passkeyError";
import { beforeEach, describe, expect, it } from "vitest";
import { clearFirestore } from "../../testing/clearFirestore";
import { createSoftAuthenticator } from "../../testing/softAuthenticator";
import {
	CHALLENGE_TTL_MS,
	deletePasskey,
	finishAuthentication,
	finishRegistration,
	InvalidPasskeyRequestError,
	listPasskeys,
	type PasskeyContext,
	startAuthentication,
	startRegistration,
} from "./usecase";

const ORIGIN = "https://example.web.app";
const OTHER_ORIGIN = "https://example.firebaseapp.com";
const USER_ID = "user-1";
const OTHER_USER_ID = "user-2";

const accounts = new Map<string, { email: string; disabled: boolean }>();

const ctx: PasskeyContext = {
	allowedOrigins: [ORIGIN, OTHER_ORIGIN],
	accounts: {
		get: async (uid) => accounts.get(uid) ?? null,
		createSignInToken: async (uid) => `token-for-${uid}`,
	},
};

const expectPasskeyError = async (
	promise: Promise<unknown>,
	code: PasskeyError["code"],
) => {
	const error = await promise.catch((e: unknown) => e);
	expect(error).toBeInstanceOf(PasskeyError);
	expect((error as PasskeyError).code).toBe(code);
};

const register = async (
	authenticator: ReturnType<typeof createSoftAuthenticator>,
	{ userId = USER_ID, origin = ORIGIN, name = "My laptop" } = {},
) => {
	const { challengeId, options } = await startRegistration(ctx, {
		userId,
		origin,
	});
	return finishRegistration(ctx, {
		userId,
		challengeId,
		response: authenticator.register(options, origin),
		name,
	});
};

const signIn = async (
	authenticator: ReturnType<typeof createSoftAuthenticator>,
	{
		origin = ORIGIN,
		answerAs = origin,
	}: { origin?: string; answerAs?: string } = {},
) => {
	const { challengeId, options } = await startAuthentication(ctx, { origin });
	return finishAuthentication(ctx, {
		challengeId,
		response: authenticator.authenticate(options, answerAs),
	});
};

beforeEach(async () => {
	await clearFirestore();
	accounts.clear();
	accounts.set(USER_ID, { email: "user1@example.com", disabled: false });
	accounts.set(OTHER_USER_ID, { email: "user2@example.com", disabled: false });
});

describe("registration", () => {
	it("stores a verified passkey for the account", async () => {
		const authenticator = createSoftAuthenticator();

		const passkey = await register(authenticator, { name: "  My   laptop " });

		expect(passkey).toMatchObject({
			id: authenticator.credentialId,
			name: "My laptop",
			lastUsedAt: null,
		});
		expect(await listPasskeys(USER_ID)).toEqual([
			expect.objectContaining({ id: authenticator.credentialId }),
		]);
		expect(await listPasskeys(OTHER_USER_ID)).toEqual([]);
	});

	it("names an unnamed passkey", async () => {
		const passkey = await register(createSoftAuthenticator(), { name: "" });

		expect(passkey.name).toBe("Passkey");
	});

	it("excludes the account's existing passkeys from the options", async () => {
		const authenticator = createSoftAuthenticator();
		await register(authenticator);

		const { options } = await startRegistration(ctx, {
			userId: USER_ID,
			origin: ORIGIN,
		});

		expect(options.excludeCredentials).toEqual([
			expect.objectContaining({ id: authenticator.credentialId }),
		]);
		expect(options.rp.id).toBe("example.web.app");
		expect(options.authenticatorSelection).toMatchObject({
			residentKey: "required",
			userVerification: "required",
		});
	});

	it("refuses a credential that is already registered", async () => {
		const authenticator = createSoftAuthenticator();
		await register(authenticator);

		await expectPasskeyError(
			register(authenticator, { userId: OTHER_USER_ID }),
			"already-registered",
		);
	});

	it("does not let another account finish the ceremony", async () => {
		const authenticator = createSoftAuthenticator();
		const { challengeId, options } = await startRegistration(ctx, {
			userId: USER_ID,
			origin: ORIGIN,
		});

		await expectPasskeyError(
			finishRegistration(ctx, {
				userId: OTHER_USER_ID,
				challengeId,
				response: authenticator.register(options, ORIGIN),
				name: "",
			}),
			"invalid-credential",
		);
		expect(await listPasskeys(OTHER_USER_ID)).toEqual([]);
	});

	it("rejects an origin it does not serve", async () => {
		await expect(
			startRegistration(ctx, {
				userId: USER_ID,
				origin: "https://evil.example",
			}),
		).rejects.toBeInstanceOf(InvalidPasskeyRequestError);
	});

	it("rejects a response made for another origin", async () => {
		const authenticator = createSoftAuthenticator();
		const { challengeId, options } = await startRegistration(ctx, {
			userId: USER_ID,
			origin: ORIGIN,
		});

		await expectPasskeyError(
			finishRegistration(ctx, {
				userId: USER_ID,
				challengeId,
				response: authenticator.register(options, "https://evil.example"),
				name: "",
			}),
			"invalid-credential",
		);
	});
});

describe("authentication", () => {
	it("signs in the passkey's account and records the use", async () => {
		const authenticator = createSoftAuthenticator();
		await register(authenticator);

		expect(await signIn(authenticator)).toEqual({
			token: `token-for-${USER_ID}`,
		});

		const [passkey] = await listPasskeys(USER_ID);
		expect(passkey.lastUsedAt).toBeInstanceOf(Date);
	});

	it("does not accept the same response twice", async () => {
		const authenticator = createSoftAuthenticator();
		await register(authenticator);
		const { challengeId, options } = await startAuthentication(ctx, {
			origin: ORIGIN,
		});
		const response = authenticator.authenticate(options, ORIGIN);

		await finishAuthentication(ctx, { challengeId, response });

		await expectPasskeyError(
			finishAuthentication(ctx, { challengeId, response }),
			"expired",
		);
	});

	it("rejects an expired challenge", async () => {
		const authenticator = createSoftAuthenticator();
		await register(authenticator);
		const { challengeId, options } = await startAuthentication(ctx, {
			origin: ORIGIN,
		});

		const later = new Date(Date.now() + CHALLENGE_TTL_MS + 1000);
		await expectPasskeyError(
			finishAuthentication(
				{ ...ctx, now: () => later },
				{ challengeId, response: authenticator.authenticate(options, ORIGIN) },
			),
			"expired",
		);
	});

	it("does not answer a registration challenge with an assertion", async () => {
		const authenticator = createSoftAuthenticator();
		await register(authenticator);
		const { challengeId, options } = await startRegistration(ctx, {
			userId: USER_ID,
			origin: ORIGIN,
		});

		await expectPasskeyError(
			finishAuthentication(ctx, {
				challengeId,
				response: authenticator.authenticate(
					{ challenge: options.challenge, rpId: options.rp.id },
					ORIGIN,
				),
			}),
			"invalid-credential",
		);
	});

	it("rejects an unknown passkey", async () => {
		await expectPasskeyError(
			signIn(createSoftAuthenticator()),
			"invalid-credential",
		);
	});

	it("rejects a passkey answered from another origin", async () => {
		const authenticator = createSoftAuthenticator();
		await register(authenticator);

		await expectPasskeyError(
			signIn(authenticator, { answerAs: "https://evil.example" }),
			"invalid-credential",
		);
	});

	it("does not use a passkey on an origin it was not made for", async () => {
		const authenticator = createSoftAuthenticator();
		await register(authenticator, { origin: ORIGIN });

		await expectPasskeyError(
			signIn(authenticator, { origin: OTHER_ORIGIN }),
			"invalid-credential",
		);
	});

	it("refuses a disabled account", async () => {
		const authenticator = createSoftAuthenticator();
		await register(authenticator);
		accounts.set(USER_ID, { email: "user1@example.com", disabled: true });

		await expectPasskeyError(signIn(authenticator), "user-disabled");
	});

	it("rejects a malformed challenge ID without touching storage", async () => {
		await expect(
			finishAuthentication(ctx, {
				challengeId: "../passkeyCredentials/x",
				response: { id: "abc" },
			}),
		).rejects.toBeInstanceOf(InvalidPasskeyRequestError);
	});
});

describe("deletion", () => {
	it("deletes the account's own passkey", async () => {
		const authenticator = createSoftAuthenticator();
		await register(authenticator);

		await deletePasskey(USER_ID, authenticator.credentialId);

		expect(await listPasskeys(USER_ID)).toEqual([]);
		await expectPasskeyError(signIn(authenticator), "invalid-credential");
	});

	it("leaves another account's passkey alone", async () => {
		const authenticator = createSoftAuthenticator();
		await register(authenticator);

		await deletePasskey(OTHER_USER_ID, authenticator.credentialId);

		expect(await listPasskeys(USER_ID)).toHaveLength(1);
	});
});
