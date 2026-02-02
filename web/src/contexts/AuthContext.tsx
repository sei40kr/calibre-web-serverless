"use client";

import type { User } from "@calibre-web-serverless/domain/models/user";
import { authService } from "@calibre-web-serverless/infrastructure/services/authService";
import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useState,
} from "react";

type AuthContextType = {
	user: User | null;
	loading: boolean;
	signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
	const [user, setUser] = useState<User | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const unsubscribe = authService.onAuthStateChanged((user) => {
			setUser(user);
			setLoading(false);
		});
		return unsubscribe;
	}, []);

	const signOut = async () => {
		await authService.signOut();
	};

	return (
		<AuthContext.Provider value={{ user, loading, signOut }}>
			{children}
		</AuthContext.Provider>
	);
}

export function useAuth() {
	const context = useContext(AuthContext);
	if (context === undefined) {
		throw new Error("useAuth must be used within an AuthProvider");
	}
	return context;
}
