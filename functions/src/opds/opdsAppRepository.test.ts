import { createHash } from "node:crypto";
import { formatOpdsAccessToken } from "@calibre-web-serverless/domain/models/opdsApp";
import { opdsAppRepository } from "@calibre-web-serverless/infrastructure/admin/repositories/opdsAppRepository";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { beforeEach, describe, expect, it } from "vitest";
import { clearFirestore } from "../../testing/clearFirestore";

const SECRET = "s3cret-value_1";
const sha256 = (value: string) =>
	createHash("sha256").update(value).digest("hex");
const appPath = "users/alice/opdsApps/app1";

describe("opdsAppRepository.findUserIdByAccessToken", () => {
	beforeEach(async () => {
		await clearFirestore();
		await getFirestore()
			.doc(appPath)
			.set({
				name: "Study iPad",
				secretHash: sha256(SECRET),
				createdAt: Timestamp.now(),
				lastUsedAt: null,
			});
	});

	it("returns the owner and records the use", async () => {
		await expect(
			opdsAppRepository.findUserIdByAccessToken(
				formatOpdsAccessToken("alice", "app1", SECRET),
			),
		).resolves.toBe("alice");
		expect(
			(await getFirestore().doc(appPath).get()).get("lastUsedAt"),
		).toBeInstanceOf(Timestamp);
	});

	it.each([
		["a wrong secret", formatOpdsAccessToken("alice", "app1", "wrong")],
		["another user's id", formatOpdsAccessToken("bob", "app1", SECRET)],
		["an unknown app", formatOpdsAccessToken("alice", "app2", SECRET)],
		["a path in an id", `alice/opdsApps.app1.${SECRET}`],
		["a malformed token", SECRET],
	])("rejects %s", async (_, token) => {
		await expect(
			opdsAppRepository.findUserIdByAccessToken(token),
		).resolves.toBeNull();
	});

	it("rejects a revoked app", async () => {
		await getFirestore().doc(appPath).delete();
		await expect(
			opdsAppRepository.findUserIdByAccessToken(
				formatOpdsAccessToken("alice", "app1", SECRET),
			),
		).resolves.toBeNull();
	});
});
