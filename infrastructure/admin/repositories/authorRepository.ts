import type { Author } from "@calibre-web-serverless/domain/models/author";
import {
	FieldValue,
	getFirestore,
	type Timestamp,
} from "firebase-admin/firestore";

interface AuthorDocument {
	name: string;
	sortName: string | null;
	bookCount: number;
	createdAt: Timestamp | null;
	updatedAt: Timestamp | null;
}

/** The authors with these ids (a single batched read; unknown ids are skipped). */
const findAuthorsByIds = async (
	userId: string,
	ids: string[],
): Promise<Author[]> => {
	if (ids.length === 0) return [];
	const db = getFirestore();
	const refs = ids.map((id) => db.doc(`users/${userId}/authors/${id}`));
	const snapshots = await db.getAll(...refs);
	return snapshots.flatMap((doc) => {
		if (!doc.exists) return [];
		const d = doc.data() as AuthorDocument;
		return [
			{
				id: doc.id,
				name: d.name,
				sortName: d.sortName ?? null,
				createdAt: d.createdAt?.toDate() ?? null,
				updatedAt: d.updatedAt?.toDate() ?? null,
			},
		];
	});
};

/** Return the id of the author with this name, creating it if absent. */
const findOrCreateAuthor = async (
	userId: string,
	name: string,
): Promise<string> => {
	const authorsRef = getFirestore().collection(`users/${userId}/authors`);
	const snapshot = await authorsRef.get();
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

	const created = await authorsRef.add({
		name,
		sortName: null,
		bookCount: 1,
		createdAt: FieldValue.serverTimestamp(),
		updatedAt: FieldValue.serverTimestamp(),
	});
	return created.id;
};

export const authorRepository = {
	findAuthorsByIds,
	findOrCreateAuthor,
};
