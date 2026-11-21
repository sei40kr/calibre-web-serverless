"use client";

import type { OpdsApp } from "@calibre-web-serverless/domain/models/opdsApp";
import {
	Badge,
	Box,
	Button,
	Clipboard,
	Flex,
	Heading,
	HStack,
	Input,
	Span,
	Stack,
	StackSeparator,
	Text,
} from "@chakra-ui/react";
import { useState } from "react";
import { LuTabletSmartphone } from "react-icons/lu";
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

interface OpdsSettingsProps {
	catalogUrl: string;
	opdsApps: OpdsApp[];
	onRevokeOpdsApp: (app: OpdsApp) => Promise<void>;
}

const formatDate = (date: Date) =>
	date.toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
	["day", 86_400_000],
	["hour", 3_600_000],
	["minute", 60_000],
];

const formatAgo = (date: Date) => {
	const elapsed = Date.now() - date.getTime();
	const [unit, ms] = UNITS.find(([, ms]) => elapsed >= ms) ?? UNITS[2];
	return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(
		-Math.floor(elapsed / ms),
		unit,
	);
};

const describeApp = (app: OpdsApp) =>
	[
		app.createdAt && `Authorized ${formatDate(app.createdAt)}`,
		app.lastUsedAt ? `Last used ${formatAgo(app.lastUsedAt)}` : "Never used",
	]
		.filter(Boolean)
		.join(" · ");

export function OpdsSettings({
	catalogUrl,
	opdsApps,
	onRevokeOpdsApp,
}: OpdsSettingsProps) {
	const [pendingRevoke, setPendingRevoke] = useState<OpdsApp | null>(null);
	const [isRevoking, setIsRevoking] = useState(false);

	const handleRevoke = async () => {
		if (!pendingRevoke) return;
		setIsRevoking(true);
		try {
			await onRevokeOpdsApp(pendingRevoke);
			setPendingRevoke(null);
		} catch {
			// The caller reports the failure; keep the dialog open to retry.
		} finally {
			setIsRevoking(false);
		}
	};

	return (
		<Stack gap={6}>
			<Text fontSize="sm" color="fg.muted">
				Read your library in OPDS apps. Apps sign in through this site with
				OAuth, so they never see your password.
			</Text>

			<Alert
				status="info"
				title="Only OPDS apps that support OAuth can connect"
			>
				Many e-book readers only offer OPDS with Basic authentication, which
				sends your email and password with every request. For security,
				calibre-web-serverless only allows OPDS access through OAuth, so those
				readers can't connect.
			</Alert>

			<Clipboard.Root value={catalogUrl}>
				<Stack gap="6px">
					<Clipboard.Label fontSize="sm" fontWeight="semibold">
						Catalog URL
					</Clipboard.Label>
					<HStack gap={2}>
						<Clipboard.Input asChild>
							<Input readOnly bg="bg.muted" fontFamily="mono" fontSize="13px" />
						</Clipboard.Input>
						<Clipboard.Trigger asChild>
							<Button variant="outline">
								<Clipboard.Indicator />
								<Clipboard.CopyText />
							</Button>
						</Clipboard.Trigger>
					</HStack>
					<Text fontSize="xs" color="fg.muted">
						Add this URL in your OPDS app. The app opens this site, where you
						name it and allow access. It then appears below.
					</Text>
				</Stack>
			</Clipboard.Root>

			<Stack as="section" gap={2}>
				<Heading as="h4" size="sm">
					Connected apps
				</Heading>
				{opdsApps.length === 0 ? (
					<Text
						py={6}
						px={4}
						borderWidth="1px"
						borderStyle="dashed"
						borderRadius="l3"
						fontSize="sm"
						color="fg.muted"
						textAlign="center"
					>
						No apps connected yet. Add the catalog URL in an OPDS app to connect
						it.
					</Text>
				) : (
					<Stack
						as="ul"
						listStyleType="none"
						gap={0}
						borderWidth="1px"
						borderRadius="l3"
						separator={<StackSeparator />}
					>
						{opdsApps.map((app) => (
							<Flex
								as="li"
								key={app.id}
								wrap="wrap"
								align="center"
								gap={3}
								px={4}
								py={3}
							>
								<Flex
									aria-hidden
									align="center"
									justify="center"
									boxSize={9}
									flexShrink={0}
									borderRadius="l2"
									bg="bg.muted"
									color="fg.muted"
								>
									<LuTabletSmartphone />
								</Flex>
								<Box flex="1 1 220px" minW={0}>
									<HStack gap={2}>
										<Text fontSize="sm" fontWeight="medium" truncate>
											{app.name}
										</Text>
										<Badge>Read-only</Badge>
									</HStack>
									<Text fontSize="xs" color="fg.muted">
										{describeApp(app)}
									</Text>
								</Box>
								<Button
									variant="outline"
									size="sm"
									colorPalette="red"
									onClick={() => setPendingRevoke(app)}
								>
									Revoke
								</Button>
							</Flex>
						))}
					</Stack>
				)}
			</Stack>

			<DialogRoot
				role="alertdialog"
				open={pendingRevoke !== null}
				onOpenChange={(e) => {
					if (!e.open && !isRevoking) setPendingRevoke(null);
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Revoke access?</DialogTitle>
					</DialogHeader>
					<DialogBody>
						<Text>
							<Span fontWeight="semibold">{pendingRevoke?.name}</Span> will lose
							access to your catalog right away. To use it again, add the
							catalog in the app and allow access.
						</Text>
					</DialogBody>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setPendingRevoke(null)}
							disabled={isRevoking}
						>
							Cancel
						</Button>
						<Button
							colorPalette="red"
							onClick={handleRevoke}
							loading={isRevoking}
						>
							Revoke access
						</Button>
					</DialogFooter>
					<DialogCloseTrigger disabled={isRevoking} />
				</DialogContent>
			</DialogRoot>
		</Stack>
	);
}
