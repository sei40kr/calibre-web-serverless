"use client";

import { Center, Spinner } from "@chakra-ui/react";
import type { User } from "firebase/auth";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";

type AuthGuardProps = {
	children: (props: { user: User; signOut: () => Promise<void> }) => ReactNode;
};

export function AuthGuard({ children }: AuthGuardProps) {
	const { user, loading, signOut } = useAuth();

	if (loading) {
		return (
			<Center h="100vh">
				<Spinner size="xl" />
			</Center>
		);
	}

	if (!user) {
		redirect("/");
	}

	return children({ user, signOut });
}
