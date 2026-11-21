import {
	formatOpdsAccessToken,
	type OpdsApp,
} from "@calibre-web-serverless/domain/models/opdsApp";
import type { OpdsAppRepository } from "@calibre-web-serverless/domain/repositories/opdsAppRepository";
import {
	collection,
	deleteDoc,
	doc,
	type FieldValue,
	onSnapshot,
	orderBy,
	query,
	serverTimestamp,
	setDoc,
	type Timestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";

interface OpdsAppDocument {
	name: string;
	/** Hex SHA-256 of the token's secret part; the token itself is never stored. */
	secretHash: string;
	createdAt: Timestamp | null;
	lastUsedAt: Timestamp | null;
}

const opdsAppsRef = (userId: string) =>
	collection(db, "users", userId, "opdsApps");

const toOpdsApp = (id: string, d: OpdsAppDocument): OpdsApp => ({
	id,
	name: d.name,
	createdAt: d.createdAt?.toDate() ?? null,
	lastUsedAt: d.lastUsedAt?.toDate() ?? null,
});

const toHex = (bytes: ArrayBuffer): string =>
	Array.from(new Uint8Array(bytes), (b) =>
		b.toString(16).padStart(2, "0"),
	).join("");

const toBase64Url = (bytes: Uint8Array): string =>
	btoa(String.fromCharCode(...bytes))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");

export const opdsAppRepository: OpdsAppRepository = {
	subscribeToOpdsApps(userId, { onData, onError }) {
		return onSnapshot(
			query(opdsAppsRef(userId), orderBy("createdAt", "desc")),
			(snapshot) => {
				onData(
					snapshot.docs.map((d) =>
						toOpdsApp(d.id, d.data() as OpdsAppDocument),
					),
				);
			},
			onError,
		);
	},

	async authorize(userId, name) {
		const secret = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
		const secretHash = toHex(
			await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret)),
		);
		const ref = doc(opdsAppsRef(userId));
		const data: Omit<OpdsAppDocument, "createdAt"> & { createdAt: FieldValue } =
			{
				name: name.trim(),
				secretHash,
				createdAt: serverTimestamp(),
				lastUsedAt: null,
			};
		await setDoc(ref, data);
		return formatOpdsAccessToken(userId, ref.id, secret);
	},

	async revoke(userId, appId) {
		await deleteDoc(doc(opdsAppsRef(userId), appId));
	},
};
