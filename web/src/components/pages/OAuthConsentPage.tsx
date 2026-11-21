"use client";

import { MAX_OPDS_APP_NAME_LENGTH } from "@calibre-web-serverless/domain/models/opdsApp";
import {
	Box,
	Button,
	Flex,
	Heading,
	Input,
	Link,
	List,
	Span,
	Stack,
	Text,
} from "@chakra-ui/react";
import type { ReactNode } from "react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { LuCheck, LuTabletSmartphone, LuX } from "react-icons/lu";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";

export interface OAuthConsentPageProps {
	email: string;
	/** Registers the app and sends the user back to it. */
	onAllow: (name: string) => Promise<void>;
	onCancel: () => void;
	onSwitchAccount: () => void;
}

interface ConsentFormData {
	name: string;
}

function Permission({
	allowed,
	children,
}: {
	allowed: boolean;
	children: ReactNode;
}) {
	return (
		<List.Item display="flex" gap={2}>
			<List.Indicator
				asChild
				mt="2px"
				color={allowed ? "fg.success" : undefined}
			>
				{allowed ? <LuCheck /> : <LuX />}
			</List.Indicator>
			{children}
		</List.Item>
	);
}

export function OAuthConsentPage({
	email,
	onAllow,
	onCancel,
	onSwitchAccount,
}: OAuthConsentPageProps) {
	const [failed, setFailed] = useState(false);
	const [allowed, setAllowed] = useState(false);
	const {
		register,
		handleSubmit,
		formState: { errors, isSubmitting },
	} = useForm<ConsentFormData>({ defaultValues: { name: "" } });

	const onSubmit = async ({ name }: ConsentFormData) => {
		setFailed(false);
		try {
			await onAllow(name);
			setAllowed(true);
		} catch {
			setFailed(true);
		}
	};

	return (
		<Flex
			minH="100vh"
			align="center"
			justify="center"
			bg="bg.subtle"
			px={4}
			py={8}
		>
			<Stack
				as="main"
				w="full"
				maxW="448px"
				p={8}
				gap={6}
				bg="bg.panel"
				borderWidth="1px"
				borderRadius="lg"
				boxShadow="lg"
			>
				<Stack align="center" gap={4} textAlign="center">
					<Flex
						aria-hidden
						align="center"
						justify="center"
						boxSize={12}
						borderRadius="l3"
						bg="bg.muted"
						color="fg.muted"
						fontSize="2xl"
					>
						<LuTabletSmartphone />
					</Flex>
					<Heading as="h1" size="xl">
						Allow an OPDS app to access your library?
					</Heading>
					<Text fontSize="sm" color="fg.muted">
						Signed in as{" "}
						<Span color="fg" fontWeight="medium">
							{email}
						</Span>{" "}
						·{" "}
						<Link as="button" colorPalette="blue" onClick={onSwitchAccount}>
							Not you?
						</Link>
					</Text>
				</Stack>

				{allowed ? (
					<Alert status="success" title="Access allowed">
						Return to your OPDS app to start reading.
					</Alert>
				) : (
					<form noValidate onSubmit={handleSubmit(onSubmit)}>
						<Stack gap={6}>
							{failed && (
								<Alert
									status="error"
									title="Couldn't allow access. Please try again."
								/>
							)}

							<Field
								label="Name this app"
								required
								invalid={!!errors.name}
								errorText={errors.name?.message}
								helperText="So you can tell your apps apart in Settings › OPDS and revoke the right one later."
							>
								<Input
									autoComplete="off"
									placeholder="e.g. Study iPad"
									size="lg"
									{...register("name", {
										validate: (value) =>
											value.trim().length > 0 || "Enter a name for this app",
										maxLength: {
											value: MAX_OPDS_APP_NAME_LENGTH,
											message: `Use at most ${MAX_OPDS_APP_NAME_LENGTH} characters`,
										},
									})}
								/>
							</Field>

							<Stack gap={4} p={4} borderWidth="1px" borderRadius="l3">
								<Stack gap={2}>
									<Text fontSize="sm" fontWeight="semibold">
										This app will be able to
									</Text>
									<List.Root gap={2} fontSize="sm" variant="plain">
										<Permission allowed>
											Browse your books, authors, tags and bookshelves
										</Permission>
										<Permission allowed>
											Download book files and covers
										</Permission>
									</List.Root>
								</Stack>
								<Box borderTopWidth="1px" pt={4}>
									<Text fontSize="sm" fontWeight="semibold" mb={2}>
										It won't be able to
									</Text>
									<List.Root
										gap={2}
										fontSize="sm"
										variant="plain"
										color="fg.muted"
									>
										<Permission allowed={false}>
											Change or delete anything in your library
										</Permission>
										<Permission allowed={false}>
											See your password or account settings
										</Permission>
									</List.Root>
								</Box>
							</Stack>

							<Text fontSize="xs" color="fg.muted" textAlign="center">
								You'll return to the app after you choose. You can revoke access
								anytime in Settings.
							</Text>

							<Flex gap={3}>
								<Button
									variant="outline"
									size="lg"
									flex="1"
									onClick={onCancel}
									disabled={isSubmitting}
								>
									Cancel
								</Button>
								<Button
									type="submit"
									colorPalette="blue"
									size="lg"
									flex="1"
									loading={isSubmitting}
								>
									Allow
								</Button>
							</Flex>
						</Stack>
					</form>
				)}
			</Stack>
		</Flex>
	);
}
