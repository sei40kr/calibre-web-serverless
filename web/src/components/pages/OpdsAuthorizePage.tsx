"use client";

import {
	Box,
	Button,
	Container,
	Flex,
	Heading,
	HStack,
	Stack,
	Text,
} from "@chakra-ui/react";
import { Alert } from "@/components/ui/alert";

export type OpdsAuthorizeStatus =
	/** Waiting for the user to allow or deny. */
	| "ready"
	/** Allowed; the token is being issued. */
	| "authorizing"
	/** The token was handed to the reader. */
	| "authorized"
	/** Denied; the reader was told so. */
	| "denied"
	/** Issuing the token failed; the user may retry. */
	| "failed"
	/** The reader's request is malformed and cannot be answered. */
	| "invalid-request";

export interface OpdsAuthorizePageProps {
	status: OpdsAuthorizeStatus;
	onAllow: () => void;
	onDeny: () => void;
}

export function OpdsAuthorizePage({
	status,
	onAllow,
	onDeny,
}: OpdsAuthorizePageProps) {
	return (
		<Flex minH="100vh" align="center" justify="center" bg="bg.subtle">
			<Container maxW="md">
				<Box
					p={8}
					borderWidth={1}
					borderRadius="lg"
					boxShadow="lg"
					bg="bg.panel"
				>
					<Stack gap={6}>
						<Heading size="xl" textAlign="center">
							Connect an OPDS reader
						</Heading>
						<OpdsAuthorizeBody
							status={status}
							onAllow={onAllow}
							onDeny={onDeny}
						/>
					</Stack>
				</Box>
			</Container>
		</Flex>
	);
}

function OpdsAuthorizeBody({
	status,
	onAllow,
	onDeny,
}: OpdsAuthorizePageProps) {
	switch (status) {
		case "invalid-request":
			return (
				<Alert status="error" title="Invalid authorization request">
					The reader sent a request this site cannot answer. Start signing in
					again from your reader.
				</Alert>
			);
		case "authorized":
			return (
				<Alert status="success" title="Reader connected">
					You can close this page and return to your reader.
				</Alert>
			);
		case "denied":
			return (
				<Alert status="info" title="Access denied">
					The reader was not given access. You can close this page.
				</Alert>
			);
		default:
			return (
				<>
					<Text color="fg.muted">
						An OPDS reader is asking to browse and download the books in your
						library. It will not be able to change anything, and it never sees
						your password.
					</Text>
					{status === "failed" && (
						<Alert status="error" title="Failed to connect the reader" />
					)}
					<HStack gap={4}>
						<Button
							flex={1}
							variant="outline"
							size="lg"
							disabled={status === "authorizing"}
							onClick={onDeny}
						>
							Deny
						</Button>
						<Button
							flex={1}
							colorPalette="blue"
							size="lg"
							loading={status === "authorizing"}
							onClick={onAllow}
						>
							Allow
						</Button>
					</HStack>
				</>
			);
	}
}
