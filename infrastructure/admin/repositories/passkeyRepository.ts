import { createHash } from "node:crypto";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";

// Both collections live outside `users/{uid}` on purpose: the security rules
// grant nothing there, so only the admin SDK (the passkey callables) can read
// or write them. A credential under the user's own subtree could be swapped
// for one whose private key the writer holds, and a challenge the client can
// write is no challenge at all.
const CREDENTIALS = "passkeyCredentials";
const CHALLENGES = "passkeyChallenges";

export type PasskeyChallengeType = "registration" | "authentication";

/** A challenge handed to the browser, waiting for the signed response. */
export interface PasskeyChallenge {
	type: PasskeyChallengeType;
	/** base64url, exactly as sent in the options. */
	challenge: string;
	/** The account registering; null while signing in, before it is known. */
	userId: string | null;
	origin: string;
	rpId: string;
	expiresAt: Date;
}

/** A registered credential, with everything verification needs. */
export interface PasskeyCredential {
	/** base64url credential ID. */
	id: string;
	userId: string;
	publicKey: Uint8Array<ArrayBuffer>;
	counter: number;
	transports: string[];
	rpId: string;
	name: string;
	backedUp: boolean;
	createdAt: Date;
	lastUsedAt: Date | null;
}

interface PasskeyChallengeDocument {
	type: PasskeyChallengeType;
	challenge: string;
	userId: string | null;
	origin: string;
	rpId: string;
	// A TTL policy on this field (terraform) sweeps challenges never answered.
	expiresAt: Timestamp;
}

interface PasskeyCredentialDocument {
	credentialId: string;
	userId: string;
	publicKey: Uint8Array;
	counter: number;
	transports: string[];
	rpId: string;
	name: string;
	backedUp: boolean;
	createdAt: Timestamp;
	lastUsedAt: Timestamp | null;
}

type PasskeyCredentialPayload = Omit<
	PasskeyCredentialDocument,
	"createdAt" | "lastUsedAt"
> & { createdAt: FieldValue; lastUsedAt: null };

/**
 * Credential IDs are attacker-controlled bytes up to 1023 long, so they are
 * not used as document IDs directly — a value like `__x__` is reserved, and
 * the longest ones overflow the limit once encoded. A digest is always a
 * valid, fixed-length ID.
 */
const credentialDocId = (credentialId: string): string =>
	createHash("sha256").update(credentialId).digest("hex");

const toCredential = (d: PasskeyCredentialDocument): PasskeyCredential => ({
	id: d.credentialId,
	userId: d.userId,
	publicKey: new Uint8Array(d.publicKey),
	counter: d.counter,
	transports: d.transports ?? [],
	rpId: d.rpId,
	name: d.name,
	backedUp: d.backedUp,
	createdAt: d.createdAt.toDate(),
	lastUsedAt: d.lastUsedAt?.toDate() ?? null,
});

const createChallenge = async (
	challenge: PasskeyChallenge,
): Promise<string> => {
	const document: PasskeyChallengeDocument = {
		...challenge,
		expiresAt: Timestamp.fromDate(challenge.expiresAt),
	};
	const ref = await getFirestore().collection(CHALLENGES).add(document);
	return ref.id;
};

/**
 * Read and delete a challenge in one transaction, so each one can be answered
 * at most once — a replayed response finds nothing. Null if it never existed
 * or was already used; expiry is left to the caller.
 */
const consumeChallenge = async (
	challengeId: string,
): Promise<PasskeyChallenge | null> => {
	const db = getFirestore();
	const ref = db.collection(CHALLENGES).doc(challengeId);
	return db.runTransaction(async (tx) => {
		const snapshot = await tx.get(ref);
		if (!snapshot.exists) return null;
		tx.delete(ref);
		const d = snapshot.data() as PasskeyChallengeDocument;
		return { ...d, expiresAt: d.expiresAt.toDate() };
	});
};

const getCredential = async (
	credentialId: string,
): Promise<PasskeyCredential | null> => {
	const snapshot = await getFirestore()
		.collection(CREDENTIALS)
		.doc(credentialDocId(credentialId))
		.get();
	return snapshot.exists
		? toCredential(snapshot.data() as PasskeyCredentialDocument)
		: null;
};

/** A user's credentials, oldest first. */
const listCredentials = async (
	userId: string,
): Promise<PasskeyCredential[]> => {
	const snapshot = await getFirestore()
		.collection(CREDENTIALS)
		.where("userId", "==", userId)
		.get();
	return snapshot.docs
		.map((doc) => toCredential(doc.data() as PasskeyCredentialDocument))
		.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
};

/**
 * Store a newly verified credential. Returns false, writing nothing, if the
 * credential ID is already registered — to this account or any other.
 */
const createCredential = async (
	credential: Omit<PasskeyCredential, "createdAt" | "lastUsedAt">,
): Promise<boolean> => {
	const payload: PasskeyCredentialPayload = {
		credentialId: credential.id,
		userId: credential.userId,
		publicKey: credential.publicKey,
		counter: credential.counter,
		transports: credential.transports,
		rpId: credential.rpId,
		name: credential.name,
		backedUp: credential.backedUp,
		createdAt: FieldValue.serverTimestamp(),
		lastUsedAt: null,
	};
	try {
		await getFirestore()
			.collection(CREDENTIALS)
			.doc(credentialDocId(credential.id))
			.create(payload);
		return true;
	} catch (error) {
		// gRPC ALREADY_EXISTS
		if ((error as { code?: unknown }).code === 6) return false;
		throw error;
	}
};

/** Record a successful sign-in: the new signature counter and sync state. */
const recordCredentialUse = async (
	credentialId: string,
	{ counter, backedUp }: { counter: number; backedUp: boolean },
): Promise<void> => {
	await getFirestore()
		.collection(CREDENTIALS)
		.doc(credentialDocId(credentialId))
		.update({
			counter,
			backedUp,
			lastUsedAt: FieldValue.serverTimestamp(),
		});
};

/**
 * Delete one of a user's credentials. Returns false if it does not exist or
 * belongs to someone else — the two are indistinguishable to the caller.
 */
const deleteCredential = async (
	userId: string,
	credentialId: string,
): Promise<boolean> => {
	const db = getFirestore();
	const ref = db.collection(CREDENTIALS).doc(credentialDocId(credentialId));
	return db.runTransaction(async (tx) => {
		const snapshot = await tx.get(ref);
		if (!snapshot.exists) return false;
		if ((snapshot.data() as PasskeyCredentialDocument).userId !== userId) {
			return false;
		}
		tx.delete(ref);
		return true;
	});
};

export const passkeyRepository = {
	createChallenge,
	consumeChallenge,
	getCredential,
	listCredentials,
	createCredential,
	recordCredentialUse,
	deleteCredential,
};
