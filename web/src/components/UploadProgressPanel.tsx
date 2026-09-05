"use client";

import {
	Box,
	Collapsible,
	HStack,
	Icon,
	IconButton,
	Progress,
	Stack,
	Text,
} from "@chakra-ui/react";
import { LuChevronDown, LuChevronUp, LuFile, LuX } from "react-icons/lu";
import {
	type BookUpload,
	bookUploadFailureMessage,
	bookUploadPercent,
	isBookUploadActive,
	isBookUploadFinished,
} from "@/lib/bookUpload";

interface UploadProgressPanelProps {
	uploads: readonly BookUpload[];
	collapsed: boolean;
	onCollapsedChange: (collapsed: boolean) => void;
	/** Remove one finished upload from the list. */
	onDismiss: (id: string) => void;
	/** Clear the panel once nothing is in flight. */
	onClose: () => void;
}

const plural = (count: number, noun: string) =>
	`${count} ${noun}${count === 1 ? "" : "s"}`;

/** One-line summary for the panel header. */
export function uploadProgressTitle(uploads: readonly BookUpload[]): string {
	const total = uploads.length;
	const finished = uploads.filter(isBookUploadFinished).length;
	const failed = uploads.filter((u) => u.status === "error").length;
	if (finished < total) {
		return `Uploading ${plural(total, "book")} (${finished} of ${total} done)`;
	}
	if (failed > 0) {
		return `${plural(failed, "upload")} failed`;
	}
	return `${plural(total, "book")} uploaded`;
}

function statusLine(upload: BookUpload): {
	text: string;
	color: string;
} {
	switch (upload.status) {
		case "queued":
			return { text: "Waiting…", color: "fg.muted" };
		case "uploading":
			return {
				text: `Uploading ${bookUploadPercent(upload)}%`,
				color: "fg.muted",
			};
		case "processing":
			return { text: "Processing metadata…", color: "fg.muted" };
		case "ready":
			return {
				text: upload.title
					? `Added "${upload.title}"`
					: "Added to your library",
				color: "fg.success",
			};
		case "error":
			return {
				text: upload.failure
					? bookUploadFailureMessage(upload.failure)
					: "Upload failed",
				color: "fg.error",
			};
	}
}

function UploadProgressItem({
	upload,
	onDismiss,
}: {
	upload: BookUpload;
	onDismiss: (id: string) => void;
}) {
	const status = statusLine(upload);
	const finished = isBookUploadFinished(upload);
	const percent =
		upload.status === "queued"
			? 0
			: upload.status === "uploading"
				? bookUploadPercent(upload)
				: 100;

	return (
		<Box as="li" listStyleType="none" px={4} py={3}>
			<HStack align="start" gap={3}>
				<Icon fontSize="lg" color="fg.muted" mt="1">
					<LuFile />
				</Icon>
				<Stack gap={1} flex="1" minW={0}>
					<Text
						fontSize="sm"
						fontWeight="medium"
						truncate
						title={upload.fileName}
					>
						{upload.fileName}
					</Text>
					<Text fontSize="xs" color={status.color}>
						{status.text}
					</Text>
					{!finished && (
						<Progress.Root
							size="xs"
							value={upload.status === "processing" ? null : percent}
							colorPalette="blue"
							aria-label={`${upload.fileName} progress`}
						>
							<Progress.Track>
								<Progress.Range />
							</Progress.Track>
						</Progress.Root>
					)}
				</Stack>
				{finished && (
					<IconButton
						variant="ghost"
						size="xs"
						color="fg.muted"
						aria-label={`Dismiss ${upload.fileName}`}
						onClick={() => onDismiss(upload.id)}
					>
						<LuX />
					</IconButton>
				)}
			</HStack>
		</Box>
	);
}

/**
 * Bottom-right overlay listing background uploads. Renders nothing when the
 * list is empty.
 */
export function UploadProgressPanel({
	uploads,
	collapsed,
	onCollapsedChange,
	onDismiss,
	onClose,
}: UploadProgressPanelProps) {
	if (uploads.length === 0) return null;

	const active = uploads.some(isBookUploadActive);

	return (
		<Box
			as="section"
			aria-label="Upload progress"
			position="fixed"
			bottom={4}
			insetEnd={4}
			zIndex="banner"
			w={{ base: "calc(100vw - 2rem)", sm: "sm" }}
			bg="bg.panel"
			borderWidth="1px"
			borderRadius="l3"
			boxShadow="lg"
			overflow="hidden"
		>
			<Collapsible.Root
				open={!collapsed}
				onOpenChange={(e) => onCollapsedChange(!e.open)}
			>
				<HStack
					px={4}
					py={2}
					gap={2}
					borderBottomWidth={collapsed ? 0 : "1px"}
					bg="bg.subtle"
				>
					<Text fontSize="sm" fontWeight="semibold" flex="1" aria-live="polite">
						{uploadProgressTitle(uploads)}
					</Text>
					<Collapsible.Trigger asChild>
						<IconButton
							variant="ghost"
							size="xs"
							aria-label={collapsed ? "Expand" : "Collapse"}
						>
							{collapsed ? <LuChevronUp /> : <LuChevronDown />}
						</IconButton>
					</Collapsible.Trigger>
					{!active && (
						<IconButton
							variant="ghost"
							size="xs"
							aria-label="Close"
							onClick={onClose}
						>
							<LuX />
						</IconButton>
					)}
				</HStack>
				<Collapsible.Content>
					<Stack
						as="ul"
						gap={0}
						m={0}
						p={0}
						maxH="50vh"
						overflowY="auto"
						separator={<Box borderBottomWidth="1px" />}
					>
						{uploads.map((upload) => (
							<UploadProgressItem
								key={upload.id}
								upload={upload}
								onDismiss={onDismiss}
							/>
						))}
					</Stack>
				</Collapsible.Content>
			</Collapsible.Root>
		</Box>
	);
}
