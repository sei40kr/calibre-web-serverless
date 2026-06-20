import type { Tag } from "@calibre-web-serverless/domain/models/tag";
import { getFirestore, type Timestamp } from "firebase-admin/firestore";

interface TagDocument {
	name: string;
	createdAt: Timestamp | null;
	updatedAt: Timestamp | null;
}

/** The tags with these ids (a single batched read; unknown ids skipped). */
const findTagsByIds = async (userId: string, ids: string[]): Promise<Tag[]> => {
	if (ids.length === 0) return [];
	const db = getFirestore();
	const refs = ids.map((id) => db.doc(`users/${userId}/tags/${id}`));
	const snapshots = await db.getAll(...refs);
	return snapshots.flatMap((doc) => {
		if (!doc.exists) return [];
		const d = doc.data() as TagDocument;
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

export const tagRepository = {
	findTagsByIds,
};
