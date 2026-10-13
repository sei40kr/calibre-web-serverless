import { FieldValue, getFirestore } from "firebase-admin/firestore";

/**
 * Return the id of the series with this name (case-insensitive), creating it
 * if absent. Either way the series counts one more book.
 */
const findOrCreateSeries = async (
	userId: string,
	name: string,
): Promise<string> => {
	const seriesRef = getFirestore().collection(`users/${userId}/series`);
	const snapshot = await seriesRef.get();
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

	const created = await seriesRef.add({
		name,
		bookCount: 1,
		createdAt: FieldValue.serverTimestamp(),
		updatedAt: FieldValue.serverTimestamp(),
	});
	return created.id;
};

export const seriesRepository = {
	findOrCreateSeries,
};
