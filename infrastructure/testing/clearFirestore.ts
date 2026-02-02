const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

export const clearFirestore = async (): Promise<void> => {
	const res = await fetch(
		`http://${firestoreHost}/emulator/v1/projects/${projectId}/databases/(default)/documents`,
		{ method: "DELETE" },
	);
	if (!res.ok) {
		throw new Error(`Failed to clear Firestore: ${res.status}`);
	}
};
