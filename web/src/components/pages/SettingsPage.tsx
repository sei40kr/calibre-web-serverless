"use client";

import {
	Box,
	Button,
	Container,
	Flex,
	Heading,
	HStack,
	Stack,
	StackSeparator,
	Text,
	VStack,
} from "@chakra-ui/react";
import { type ReactNode, useState } from "react";
import { ChangeEmailDialog } from "@/components/ChangeEmailDialog";
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog";

export interface SettingsPageProps {
	email: string;
	onSignOut: () => void;
	/** Rejects with an `AuthError` or `ChangeEmailError` when the change is refused. */
	onChangeEmail: (newEmail: string, currentPassword: string) => Promise<void>;
	/** Rejects with an `AuthError` or `ChangePasswordError` when the change is refused. */
	onChangePassword: (
		currentPassword: string,
		newPassword: string,
	) => Promise<void>;
}

function SettingRow({
	label,
	description,
	action,
}: {
	label: string;
	description: ReactNode;
	action: ReactNode;
}) {
	return (
		<Flex
			wrap="wrap"
			align="center"
			justify="space-between"
			gap={4}
			px={6}
			py={4}
		>
			<Box flex="1 1 280px" minW={0}>
				<Text fontSize="sm" fontWeight="medium">
					{label}
				</Text>
				<Text fontSize="sm" color="fg.muted" truncate>
					{description}
				</Text>
			</Box>
			{action}
		</Flex>
	);
}

export function SettingsPage({
	email,
	onSignOut,
	onChangeEmail,
	onChangePassword,
}: SettingsPageProps) {
	const [isChangeEmailOpen, setIsChangeEmailOpen] = useState(false);
	const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

	return (
		<Container maxW="container.lg" py={8}>
			<VStack gap={6} align="stretch">
				<HStack justify="space-between" align="center" flexWrap="wrap" gap={3}>
					<Box>
						<Heading size="xl">Settings</Heading>
						<Text fontSize="sm" color="fg.muted">
							Manage your account and sign-in.
						</Text>
					</Box>
					<Button variant="outline" onClick={onSignOut}>
						Logout
					</Button>
				</HStack>

				<Stack gap={6} maxW="640px">
					<Box as="section" bg="bg.panel" borderWidth="1px" borderRadius="l3">
						<Heading as="h2" size="md" px={6} pt={5} pb={1}>
							Account
						</Heading>
						<Stack gap={0} separator={<StackSeparator />}>
							<SettingRow
								label="Email"
								description={email}
								action={
									<Button
										variant="outline"
										size="sm"
										onClick={() => setIsChangeEmailOpen(true)}
									>
										Change email
									</Button>
								}
							/>
							<SettingRow
								label="Password"
								description="Change the password you sign in with."
								action={
									<Button
										variant="outline"
										size="sm"
										onClick={() => setIsChangePasswordOpen(true)}
									>
										Change password
									</Button>
								}
							/>
						</Stack>
					</Box>
				</Stack>
			</VStack>

			<ChangeEmailDialog
				open={isChangeEmailOpen}
				onOpenChange={setIsChangeEmailOpen}
				currentEmail={email}
				onChangeEmail={onChangeEmail}
			/>

			<ChangePasswordDialog
				open={isChangePasswordOpen}
				onOpenChange={setIsChangePasswordOpen}
				onChangePassword={onChangePassword}
			/>
		</Container>
	);
}
