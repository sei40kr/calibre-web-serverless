import { FieldValue, getFirestore } from "firebase-admin/firestore";

export async function findOrCreateAuthor(
	userId: string,
	name: string,
): Promise<string> {
	const db = getFirestore();
	const authorsRef = db.collection(`users/${userId}/authors`);
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

	const newDoc = await authorsRef.add({
		name,
		sortName: null,
		bookCount: 1,
		createdAt: FieldValue.serverTimestamp(),
		updatedAt: FieldValue.serverTimestamp(),
	});
	return newDoc.id;
}
