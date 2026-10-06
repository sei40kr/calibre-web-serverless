import { createHash } from "node:crypto";
import { opdsAccessTokenRepository } from "@calibre-web-serverless/infrastructure/admin/repositories/opdsAccessTokenRepository";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearFirestore } from "../../testing/clearFirestore";

const DAY_SECONDS = 24 * 60 * 60;

describe("opdsAccessTokenRepository", () => {
	let uid: string;

	beforeEach(async () => {
		await clearFirestore();
		const user = await getAuth().createUser({
			email: `opds-${Date.now()}@example.com`,
			password: "password123",
		});
		uid = user.uid;
	});

	afterEach(async () => {
		await getAuth()
			.deleteUser(uid)
			.catch(() => undefined);
	});

	it("resolves an issued token to its user", async () => {
		const { token } = await opdsAccessTokenRepository.issue(uid, DAY_SECONDS);
		await expect(opdsAccessTokenRepository.resolveUserId(token)).resolves.toBe(
			uid,
		);
	});

	it("stores only a hash of the token", async () => {
		const { token } = await opdsAccessTokenRepository.issue(uid, DAY_SECONDS);
		const snapshot = await getFirestore().collection("opdsAccessTokens").get();
		expect(snapshot.docs.map((doc) => doc.id)).toEqual([
			createHash("sha256").update(token).digest("hex"),
		]);
		expect(JSON.stringify(snapshot.docs[0].data())).not.toContain(token);
	});

	it("rejects an unknown token", async () => {
		await expect(
			opdsAccessTokenRepository.resolveUserId("not-a-token"),
		).resolves.toBeNull();
	});

	it("rejects an expired token", async () => {
		const issuedAt = new Date();
		const { token } = await opdsAccessTokenRepository.issue(
			uid,
			DAY_SECONDS,
			issuedAt,
		);
		const later = new Date(issuedAt.getTime() + (DAY_SECONDS + 1) * 1000);
		await expect(
			opdsAccessTokenRepository.resolveUserId(token, later),
		).resolves.toBeNull();
	});

	it("rejects a token of a disabled user", async () => {
		const { token } = await opdsAccessTokenRepository.issue(uid, DAY_SECONDS);
		await getAuth().updateUser(uid, { disabled: true });
		await expect(
			opdsAccessTokenRepository.resolveUserId(token),
		).resolves.toBeNull();
	});

	it("rejects a token of a deleted user", async () => {
		const { token } = await opdsAccessTokenRepository.issue(uid, DAY_SECONDS);
		await getAuth().deleteUser(uid);
		await expect(
			opdsAccessTokenRepository.resolveUserId(token),
		).resolves.toBeNull();
	});

	it("rejects a token issued before the user's sessions were revoked", async () => {
		// tokensValidAfterTime has second precision; issue well before it.
		const { token } = await opdsAccessTokenRepository.issue(
			uid,
			DAY_SECONDS,
			new Date(Date.now() - 5_000),
		);
		await getAuth().revokeRefreshTokens(uid);
		await expect(
			opdsAccessTokenRepository.resolveUserId(token),
		).resolves.toBeNull();
	});
});
