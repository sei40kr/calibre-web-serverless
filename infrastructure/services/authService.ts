import type { AuthErrorCode } from "@calibre-web-serverless/domain/errors/authError";
import { AuthError } from "@calibre-web-serverless/domain/errors/authError";
import {
	ChangeEmailError,
	type ChangeEmailErrorCode,
} from "@calibre-web-serverless/domain/errors/changeEmailError";
import { ChangePasswordError } from "@calibre-web-serverless/domain/errors/changePasswordError";
import type { User } from "@calibre-web-serverless/domain/models/user";
import type { AuthService } from "@calibre-web-serverless/domain/services/authService";
import { FirebaseError } from "firebase/app";
import {
	EmailAuthProvider,
	type User as FirebaseUser,
	onAuthStateChanged as firebaseOnAuthStateChanged,
	sendPasswordResetEmail as firebaseSendPasswordResetEmail,
	signOut as firebaseSignOut,
	reauthenticateWithCredential,
	signInWithEmailAndPassword,
	updatePassword,
	verifyBeforeUpdateEmail,
} from "firebase/auth";
import { auth } from "../lib/firebase";

const toUser = (firebaseUser: FirebaseUser): User => {
	// Email/password is the only sign-in method, so every account has an email.
	if (!firebaseUser.email) {
		throw new Error(`User ${firebaseUser.uid} has no email`);
	}
	return { uid: firebaseUser.uid, email: firebaseUser.email };
};

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

const mapChangeEmailErrorCode = (code: string): ChangeEmailErrorCode | null => {
	switch (code) {
		case "auth/email-already-in-use":
			return "email-already-in-use";
		case "auth/invalid-new-email":
			return "invalid-email";
		default:
			return null;
	}
};

// Account changes are sensitive operations Firebase rejects without a recent
// sign-in, so each one confirms the current password first.
const reauthenticate = async (password: string): Promise<FirebaseUser> => {
	const user = auth.currentUser;
	if (!user) {
		throw new Error("No user is signed in");
	}
	try {
		await reauthenticateWithCredential(
			user,
			EmailAuthProvider.credential(toUser(user).email, password),
		);
	} catch (error) {
		if (error instanceof FirebaseError) {
			throw new AuthError(mapAuthErrorCode(error.code), error.message);
		}
		throw error;
	}
	return user;
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

	async changeEmail(currentPassword: string, newEmail: string): Promise<void> {
		const user = await reauthenticate(currentPassword);
		try {
			await verifyBeforeUpdateEmail(user, newEmail);
		} catch (error) {
			if (error instanceof FirebaseError) {
				const code = mapChangeEmailErrorCode(error.code);
				if (code) throw new ChangeEmailError(code, error.message);
			}
			throw error;
		}
	},

	async changePassword(
		currentPassword: string,
		newPassword: string,
	): Promise<void> {
		const user = await reauthenticate(currentPassword);
		try {
			await updatePassword(user, newPassword);
		} catch (error) {
			if (
				error instanceof FirebaseError &&
				error.code === "auth/weak-password"
			) {
				throw new ChangePasswordError("weak-password", error.message);
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
