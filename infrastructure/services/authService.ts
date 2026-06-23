import type { AuthErrorCode } from "@calibre-web-serverless/domain/errors/authError";
import { AuthError } from "@calibre-web-serverless/domain/errors/authError";
import type { User } from "@calibre-web-serverless/domain/models/user";
import type { AuthService } from "@calibre-web-serverless/domain/services/authService";
import { FirebaseError } from "firebase/app";
import {
	onAuthStateChanged as firebaseOnAuthStateChanged,
	sendPasswordResetEmail as firebaseSendPasswordResetEmail,
	signOut as firebaseSignOut,
	signInWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "../lib/firebase";

const toUser = (firebaseUser: { uid: string }): User => ({
	uid: firebaseUser.uid,
});

const mapAuthErrorCode = (code: string): AuthErrorCode => {
	switch (code) {
		case "auth/invalid-credential":
		case "auth/user-not-found":
		case "auth/wrong-password":
			return "invalid-credential";
		case "auth/invalid-email":
		case "auth/missing-email":
			return "invalid-email";
		case "auth/too-many-requests":
			return "too-many-requests";
		case "auth/user-disabled":
			return "user-disabled";
		default:
			return "unknown";
	}
};

export const authService: AuthService = {
	async signIn(email: string, password: string): Promise<User> {
		try {
			const credential = await signInWithEmailAndPassword(
				auth,
				email,
				password,
			);
			return toUser(credential.user);
		} catch (error) {
			if (error instanceof FirebaseError) {
				throw new AuthError(mapAuthErrorCode(error.code), error.message);
			}
			throw error;
		}
	},

	async sendPasswordResetEmail(email: string): Promise<void> {
		try {
			await firebaseSendPasswordResetEmail(auth, email);
		} catch (error) {
			if (error instanceof FirebaseError) {
				throw new AuthError(mapAuthErrorCode(error.code), error.message);
			}
			throw error;
		}
	},

	async signOut(): Promise<void> {
		await firebaseSignOut(auth);
	},

	onAuthStateChanged(callback: (user: User | null) => void): () => void {
		return firebaseOnAuthStateChanged(auth, (firebaseUser) => {
			callback(firebaseUser ? toUser(firebaseUser) : null);
		});
	},
};
