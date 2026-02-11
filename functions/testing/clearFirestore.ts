const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;
const projectId = process.env.GCLOUD_PROJECT;

export const clearFirestore = async (): Promise<void> => {
	const res = await fetch(
		`http://${firestoreHost}/emulator/v1/projects/${projectId}/databases/(default)/documents`,
		{ method: "DELETE" },
	);
	if (!res.ok) {
		throw new Error(`Failed to clear Firestore: ${res.status}`);
	}
};
