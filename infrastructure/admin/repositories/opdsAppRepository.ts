import { createHash, timingSafeEqual } from "node:crypto";
import { parseOpdsAccessToken } from "@calibre-web-serverless/domain/models/opdsApp";
import {
	FieldValue,
	getFirestore,
	type Timestamp,
} from "firebase-admin/firestore";

interface OpdsAppDocument {
	secretHash: string;
	lastUsedAt: Timestamp | null;
}

// A feed page fetches dozens of covers; recording each request would cost a
// write apiece for a timestamp shown as "2 hours ago".
const LAST_USED_RESOLUTION_MS = 5 * 60 * 1000;

/**
 * The uid an OPDS access token grants read access to, or null when the token
 * is malformed, revoked or wrong. Records when the app was last used.
 */
const findUserIdByAccessToken = async (
	token: string,
): Promise<string | null> => {
	const parsed = parseOpdsAccessToken(token);
	if (!parsed) return null;

	const ref = getFirestore().doc(
		`users/${parsed.userId}/opdsApps/${parsed.appId}`,
	);
	const snapshot = await ref.get();
	if (!snapshot.exists) return null;
	const app = snapshot.data() as OpdsAppDocument;

	const actual = createHash("sha256").update(parsed.secret).digest();
	const expected = Buffer.from(app.secretHash ?? "", "hex");
	if (expected.length !== actual.length || !timingSafeEqual(actual, expected)) {
		return null;
	}

	const lastUsed = app.lastUsedAt?.toMillis() ?? 0;
	if (Date.now() - lastUsed > LAST_USED_RESOLUTION_MS) {
		await ref.update({ lastUsedAt: FieldValue.serverTimestamp() });
	}
	return parsed.userId;
};

export const opdsAppRepository = { findUserIdByAccessToken };
