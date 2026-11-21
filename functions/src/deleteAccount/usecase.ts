import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

/** Deletes the user's whole library: every Firestore document and Storage object under `users/{userId}`. */
export async function deleteUserData(userId: string): Promise<void> {
	await Promise.all([
		getFirestore().recursiveDelete(getFirestore().doc(`users/${userId}`)),
		getStorage()
			.bucket()
			.deleteFiles({ prefix: `users/${userId}/` }),
	]);
}
