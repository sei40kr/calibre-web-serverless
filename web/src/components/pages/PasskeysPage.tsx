"use client";

import {
	MAX_PASSKEY_NAME_LENGTH,
	type Passkey,
} from "@calibre-web-serverless/domain/models/passkey";
import {
	Badge,
	Box,
	Button,
	Container,
	Heading,
	HStack,
	IconButton,
	Input,
	Skeleton,
	Span,
	Stack,
	Text,
	VStack,
} from "@chakra-ui/react";
import { type FormEvent, useState } from "react";
import { LuArrowLeft, LuKeyRound, LuTrash2 } from "react-icons/lu";
import { Alert } from "@/components/ui/alert";
import {
	DialogBody,
	DialogCloseTrigger,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogRoot,
	DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";

export interface PasskeysPageProps {
	passkeys: Passkey[];
	loading: boolean;
	/** The list could not be loaded. */
	loadError: boolean;
	/** Whether this browser can create passkeys at all. */
	supported: boolean;
	/** Create a passkey on this device. Rejects if it was not created; the caller reports why. */
	onAdd: (name: string) => Promise<void>;
	/** Revoke a passkey. Rejects on failure; the caller reports why. */
	onDelete: (passkey: Passkey) => Promise<void>;
	onBack: () => void;
}

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

/** Lists the account's passkeys and lets the user add or revoke them. */
export function PasskeysPage({
	passkeys,
	loading,
	loadError,
	supported,
	onAdd,
	onDelete,
	onBack,
}: PasskeysPageProps) {
	const [name, setName] = useState("");
	const [isAdding, setIsAdding] = useState(false);
	const [pendingDelete, setPendingDelete] = useState<Passkey | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);

	const handleAdd = async (event: FormEvent) => {
		event.preventDefault();
		setIsAdding(true);
		try {
			await onAdd(name);
			setName("");
		} catch {
			// The caller reports the failure; keep the name for a retry.
		} finally {
			setIsAdding(false);
		}
	};

	const handleDelete = async () => {
		if (!pendingDelete) return;
		setIsDeleting(true);
		try {
			await onDelete(pendingDelete);
			setPendingDelete(null);
		} catch {
			// The caller reports the failure; keep the dialog open for a retry.
		} finally {
			setIsDeleting(false);
		}
	};

	return (
		<Container maxW="2xl" py={8}>
			<VStack gap={8} align="stretch">
				<HStack>
					<Button variant="ghost" onClick={onBack}>
						<LuArrowLeft />
						Back
					</Button>
				</HStack>

				<Stack gap={2}>
					<Heading size="2xl">Passkeys</Heading>
					<Text color="fg.muted">
						Sign in with your fingerprint, face, or device PIN instead of a
						password. A passkey only works on this site, so it cannot be
						phished.
					</Text>
				</Stack>

				{supported ? (
					<form onSubmit={handleAdd}>
						<Stack align="start" gap={3}>
							<Field
								label="Name"
								helperText="Optional — helps you tell your passkeys apart"
							>
								<Input
									value={name}
									onChange={(e) => setName(e.target.value)}
									placeholder="e.g. MacBook Touch ID"
									maxLength={MAX_PASSKEY_NAME_LENGTH}
									disabled={isAdding}
								/>
							</Field>
							<Button type="submit" colorPalette="blue" loading={isAdding}>
								<LuKeyRound />
								Add passkey
							</Button>
						</Stack>
					</form>
				) : (
					<Alert
						status="warning"
						title="This browser does not support passkeys"
					/>
				)}

				{loadError ? (
					<Alert status="error" title="Failed to load your passkeys" />
				) : loading ? (
					<Stack gap={3} aria-busy="true">
						<Skeleton height="16" />
						<Skeleton height="16" />
					</Stack>
				) : passkeys.length === 0 ? (
					<EmptyState
						icon={<LuKeyRound />}
						title="No passkeys yet"
						description="Add one to sign in without your password."
					/>
				) : (
					<Stack as="ul" gap={3} listStyleType="none" aria-label="Passkeys">
						{passkeys.map((passkey) => (
							<Box
								as="li"
								key={passkey.id}
								borderWidth="1px"
								borderRadius="md"
								px={4}
								py={3}
							>
								<HStack justify="space-between" gap={4}>
									<Stack gap={1} minW={0}>
										<HStack gap={2}>
											<Text fontWeight="semibold" truncate>
												{passkey.name}
											</Text>
											{passkey.backedUp && (
												<Badge colorPalette="green" variant="subtle">
													Synced
												</Badge>
											)}
										</HStack>
										<Text textStyle="sm" color="fg.muted">
											Added {dateFormat.format(passkey.createdAt)} ·{" "}
											{passkey.lastUsedAt
												? `Last used ${dateFormat.format(passkey.lastUsedAt)}`
												: "Never used"}
										</Text>
									</Stack>
									<IconButton
										aria-label={`Delete ${passkey.name}`}
										variant="ghost"
										colorPalette="red"
										onClick={() => setPendingDelete(passkey)}
									>
										<LuTrash2 />
									</IconButton>
								</HStack>
							</Box>
						))}
					</Stack>
				)}
			</VStack>

			<DialogRoot
				role="alertdialog"
				open={pendingDelete !== null}
				onOpenChange={(e) => {
					if (!e.open && !isDeleting) setPendingDelete(null);
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete Passkey</DialogTitle>
					</DialogHeader>
					<DialogBody>
						<Text>
							Are you sure you want to delete{" "}
							<Span fontWeight="semibold">{pendingDelete?.name}</Span>? It will
							no longer sign you in. You can also remove it from your device or
							password manager.
						</Text>
					</DialogBody>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setPendingDelete(null)}
							disabled={isDeleting}
						>
							Cancel
						</Button>
						<Button
							colorPalette="red"
							onClick={handleDelete}
							loading={isDeleting}
						>
							Delete
						</Button>
					</DialogFooter>
					<DialogCloseTrigger disabled={isDeleting} />
				</DialogContent>
			</DialogRoot>
		</Container>
	);
}
