import { createHash, randomBytes } from "node:crypto";
import { getAuth, type UserRecord } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

// OPDS access tokens are opaque bearer tokens, not Firebase ID tokens: an ID
// token lasts an hour and refreshing it needs the Firebase refresh token, which
// is full account access. Only a SHA-256 of each token is stored (as the
// document id), so a leaked database read cannot be replayed against /opds.
//
// The collection is top-level so a token resolves with a single get, without
// knowing its owner. No Firestore rule matches it, so clients can neither read
// nor write it; only the admin SDK (which bypasses rules) touches it.

interface OpdsAccessTokenDocument {
	userId: string;
	createdAt: Timestamp;
	/** Also the collection's TTL field (terraform/modules/environment/firebase.tf). */
	expiresAt: Timestamp;
}

const COLLECTION = "opdsAccessTokens";

const tokenDoc = (token: string) =>
	getFirestore()
		.collection(COLLECTION)
		.doc(createHash("sha256").update(token).digest("hex"));

export interface IssuedOpdsAccessToken {
	token: string;
	expiresAt: Date;
}

/** Mint a new access token for `userId`, valid for `ttlSeconds`. */
const issue = async (
	userId: string,
	ttlSeconds: number,
	now: Date = new Date(),
): Promise<IssuedOpdsAccessToken> => {
	const token = randomBytes(32).toString("base64url");
	const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
	const doc: OpdsAccessTokenDocument = {
		userId,
		createdAt: Timestamp.fromDate(now),
		expiresAt: Timestamp.fromDate(expiresAt),
	};
	await tokenDoc(token).create(doc);
	return { token, expiresAt };
};

/**
 * The uid an access token was issued to, or null when the token is unknown,
 * expired, or no longer honoured by its account: the user was deleted or
 * disabled, or their sessions were revoked after it was issued (Firebase bumps
 * `tokensValidAfterTime` on `revokeRefreshTokens` and on a password change),
 * which makes those the ways to cut off every OPDS client at once.
 */
const resolveUserId = async (
	token: string,
	now: Date = new Date(),
): Promise<string | null> => {
	const snapshot = await tokenDoc(token).get();
	if (!snapshot.exists) return null;
	const doc = snapshot.data() as OpdsAccessTokenDocument;
	if (doc.expiresAt.toMillis() <= now.getTime()) return null;

	let user: UserRecord;
	try {
		user = await getAuth().getUser(doc.userId);
	} catch (err) {
		if ((err as { code?: string }).code === "auth/user-not-found") return null;
		throw err;
	}
	if (user.disabled) return null;
	const validAfter = user.tokensValidAfterTime
		? Date.parse(user.tokensValidAfterTime)
		: Number.NaN;
	if (!Number.isNaN(validAfter) && doc.createdAt.toMillis() < validAfter) {
		return null;
	}
	return doc.userId;
};

export const opdsAccessTokenRepository = {
	issue,
	resolveUserId,
};
