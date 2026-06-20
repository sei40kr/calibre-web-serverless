import type { Publisher } from "@calibre-web-serverless/domain/models/publisher";
import {
	FieldValue,
	getFirestore,
	type Timestamp,
} from "firebase-admin/firestore";

interface PublisherDocument {
	name: string;
	bookCount: number;
	createdAt: Timestamp | null;
	updatedAt: Timestamp | null;
}

/** The publishers with these ids (a single batched read; unknown ids skipped). */
const findPublishersByIds = async (
	userId: string,
	ids: string[],
): Promise<Publisher[]> => {
	if (ids.length === 0) return [];
	const db = getFirestore();
	const refs = ids.map((id) => db.doc(`users/${userId}/publishers/${id}`));
	const snapshots = await db.getAll(...refs);
	return snapshots.flatMap((doc) => {
		if (!doc.exists) return [];
		const d = doc.data() as PublisherDocument;
		return [
			{
				id: doc.id,
				name: d.name,
				createdAt: d.createdAt?.toDate() ?? null,
				updatedAt: d.updatedAt?.toDate() ?? null,
			},
		];
	});
};

/** Return the id of the publisher with this name, creating it if absent. */
const findOrCreatePublisher = async (
	userId: string,
	name: string,
): Promise<string> => {
	const publishersRef = getFirestore().collection(`users/${userId}/publishers`);
	const snapshot = await publishersRef.get();
	const existing = snapshot.docs.find(
		(d) => (d.data().name as string).toLowerCase() === name.toLowerCase(),
	);
	if (existing) {
		await existing.ref.update({
			bookCount: FieldValue.increment(1),
			updatedAt: FieldValue.serverTimestamp(),
		});
		return existing.id;
	}

	const created = await publishersRef.add({
		name,
		bookCount: 1,
		createdAt: FieldValue.serverTimestamp(),
		updatedAt: FieldValue.serverTimestamp(),
	});
	return created.id;
};

export const publisherRepository = {
	findPublishersByIds,
	findOrCreatePublisher,
};
