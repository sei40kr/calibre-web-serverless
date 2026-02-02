"use client";

import type { User } from "@calibre-web-serverless/infrastructure/lib/auth";
import { Center, Spinner } from "@chakra-ui/react";
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
