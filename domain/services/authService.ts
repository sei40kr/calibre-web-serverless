import type { User } from "../models/user";

export interface AuthService {
	signIn(email: string, password: string): Promise<User>;
	sendPasswordResetEmail(email: string): Promise<void>;
	signOut(): Promise<void>;
	/**
	 * Sends a verification link to `newEmail`; the signed-in user's email
	 * changes once it is opened. `currentPassword` re-authenticates the user.
	 * Rejects with an `AuthError` when `currentPassword` is rejected, or a
	 * `ChangeEmailError` when `newEmail` is.
	 */
	changeEmail(currentPassword: string, newEmail: string): Promise<void>;
	/**
	 * `currentPassword` re-authenticates the signed-in user. Rejects with an
	 * `AuthError` when it is rejected, or a `ChangePasswordError` when
	 * `newPassword` is.
	 */
	changePassword(currentPassword: string, newPassword: string): Promise<void>;
	onAuthStateChanged(callback: (user: User | null) => void): () => void;
}
