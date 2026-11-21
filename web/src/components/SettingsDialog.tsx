"use client";

import type { OpdsApp } from "@calibre-web-serverless/domain/models/opdsApp";
import {
	Box,
	Button,
	Flex,
	Heading,
	Stack,
	StackSeparator,
	Tabs,
	Text,
} from "@chakra-ui/react";
import { type ReactNode, useState } from "react";
import { LuRss, LuTrash2, LuUser } from "react-icons/lu";
import { ChangeEmailDialog } from "@/components/ChangeEmailDialog";
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog";
import { DeleteAccountDialog } from "@/components/DeleteAccountDialog";
import { OpdsSettings } from "@/components/OpdsSettings";
import {
	DialogCloseTrigger,
	DialogContent,
	DialogRoot,
	DialogTitle,
} from "@/components/ui/dialog";

interface SettingsDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	email: string;
	bookCount: number;
	bookshelfCount: number;
	/** Rejects with an `AuthError` or `ChangeEmailError` when the change is refused. */
	onChangeEmail: (newEmail: string, currentPassword: string) => Promise<void>;
	/** Rejects with an `AuthError` or `ChangePasswordError` when the change is refused. */
	onChangePassword: (
		currentPassword: string,
		newPassword: string,
	) => Promise<void>;
	/** Rejects with an `AuthError` when the deletion is refused. */
	onDeleteAccount: (password: string) => Promise<void>;
	/** The URL OPDS apps add to reach the catalog. */
	opdsCatalogUrl: string;
	opdsApps: OpdsApp[];
	onRevokeOpdsApp: (app: OpdsApp) => Promise<void>;
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
		<Flex wrap="wrap" align="center" justify="space-between" gap={4} p={4}>
			<Box flex="1 1 240px" minW={0}>
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

export function SettingsDialog({
	open,
	onOpenChange,
	email,
	bookCount,
	bookshelfCount,
	onChangeEmail,
	onChangePassword,
	onDeleteAccount,
	opdsCatalogUrl,
	opdsApps,
	onRevokeOpdsApp,
}: SettingsDialogProps) {
	const [isChangeEmailOpen, setIsChangeEmailOpen] = useState(false);
	const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
	const [isDeleteAccountOpen, setIsDeleteAccountOpen] = useState(false);

	return (
		<>
			<DialogRoot
				open={open}
				onOpenChange={(e) => onOpenChange(e.open)}
				placement="center"
				size={{ base: "full", md: "xl" }}
			>
				<DialogContent
					maxW={{ md: "880px" }}
					h={{ md: "calc(100dvh - 6rem)" }}
					overflow="hidden"
				>
					<Tabs.Root
						defaultValue="account"
						orientation="vertical"
						variant="subtle"
						size="sm"
						colorPalette="gray"
						flex="1"
						minH={0}
						flexDirection={{ base: "column", md: "row" }}
					>
						<Flex
							direction="column"
							flexShrink={0}
							w={{ md: "220px" }}
							bg="bg.subtle"
							borderColor="border"
							borderRightWidth={{ md: "1px" }}
							borderBottomWidth={{ base: "1px", md: 0 }}
						>
							<DialogTitle px={5} pt={5} pb={3}>
								Settings
							</DialogTitle>
							<Tabs.List
								aria-label="Settings sections"
								flexDirection={{ base: "row", md: "column" }}
								gap="2px"
								px={2}
								pb={2}
							>
								<Tabs.Trigger value="account" justifyContent="flex-start">
									<LuUser />
									Account
								</Tabs.Trigger>
								<Tabs.Trigger value="opds" justifyContent="flex-start">
									<LuRss />
									OPDS
								</Tabs.Trigger>
							</Tabs.List>
							<Text
								display={{ base: "none", md: "block" }}
								mt="auto"
								px={5}
								py={4}
								fontSize="xs"
								color="fg.muted"
								truncate
							>
								{email}
							</Text>
						</Flex>

						<Tabs.Content
							value="account"
							flex="1"
							minW={0}
							overflowY="auto"
							px={6}
							pt={5}
							pb={6}
						>
							<Heading as="h3" size="lg" mb={4}>
								Account
							</Heading>
							<Stack gap={6}>
								<Stack as="section" gap={2}>
									<Heading as="h4" size="sm">
										Sign-in
									</Heading>
									<Stack
										gap={0}
										borderWidth="1px"
										borderRadius="l3"
										separator={<StackSeparator />}
									>
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
								</Stack>

								<Stack as="section" gap={2}>
									<Heading as="h4" size="sm">
										Danger zone
									</Heading>
									<Flex
										wrap="wrap"
										align="center"
										justify="space-between"
										gap={4}
										p={4}
										borderWidth="1px"
										borderColor="border.error"
										borderRadius="l3"
									>
										<Box flex="1 1 280px" minW={0}>
											<Text fontSize="sm" fontWeight="medium">
												Delete account
											</Text>
											<Text fontSize="sm" color="fg.muted">
												Permanently delete your account and your entire library:
												books, files, covers and bookshelves. This can't be
												undone.
											</Text>
										</Box>
										<Button
											variant="outline"
											size="sm"
											colorPalette="red"
											onClick={() => setIsDeleteAccountOpen(true)}
										>
											<LuTrash2 />
											Delete account
										</Button>
									</Flex>
								</Stack>
							</Stack>
						</Tabs.Content>

						<Tabs.Content
							value="opds"
							flex="1"
							minW={0}
							overflowY="auto"
							px={6}
							pt={5}
							pb={6}
						>
							<Heading as="h3" size="lg" mb={4}>
								OPDS
							</Heading>
							<OpdsSettings
								catalogUrl={opdsCatalogUrl}
								opdsApps={opdsApps}
								onRevokeOpdsApp={onRevokeOpdsApp}
							/>
						</Tabs.Content>
					</Tabs.Root>
					<DialogCloseTrigger />
				</DialogContent>
			</DialogRoot>

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

			<DeleteAccountDialog
				open={isDeleteAccountOpen}
				onOpenChange={setIsDeleteAccountOpen}
				email={email}
				bookCount={bookCount}
				bookshelfCount={bookshelfCount}
				onDeleteAccount={onDeleteAccount}
			/>
		</>
	);
}
