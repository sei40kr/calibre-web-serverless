import type { User } from "../models/user";

export interface AuthService {
	signIn(email: string, password: string): Promise<User>;
	sendPasswordResetEmail(email: string): Promise<void>;
	signOut(): Promise<void>;
	onAuthStateChanged(callback: (user: User | null) => void): () => void;
}
