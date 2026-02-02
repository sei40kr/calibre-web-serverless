import type { User } from "../models/user";

export interface AuthService {
	signIn(email: string, password: string): Promise<User>;
	signOut(): Promise<void>;
	onAuthStateChanged(callback: (user: User | null) => void): () => void;
}
