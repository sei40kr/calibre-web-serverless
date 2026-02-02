import {
	createUserWithEmailAndPassword,
	signInWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "../lib/firebase";

const TEST_EMAIL = "test@example.com";
const TEST_PASSWORD = "password123";

let testUserId: string | null = null;

export const signInTestUser = async (): Promise<string> => {
	if (testUserId) return testUserId;

	try {
		const credential = await createUserWithEmailAndPassword(
			auth,
			TEST_EMAIL,
			TEST_PASSWORD,
		);
		testUserId = credential.user.uid;
	} catch {
		// User already exists, sign in instead
		const credential = await signInWithEmailAndPassword(
			auth,
			TEST_EMAIL,
			TEST_PASSWORD,
		);
		testUserId = credential.user.uid;
	}

	return testUserId;
};
