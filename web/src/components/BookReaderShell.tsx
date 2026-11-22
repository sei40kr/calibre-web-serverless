"use client";

import { Box, HStack, IconButton, Progress, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { LuArrowLeft, LuChevronLeft, LuChevronRight } from "react-icons/lu";

interface PageTurnButton {
	label: string;
	disabled: boolean;
	onClick: () => void;
}

interface PageTurnControls {
	/** Page counter shown between the page-turn chevrons. */
	indicator: ReactNode;
	/**
	 * The physical left/right chevrons. Which one means "next" is the
	 * caller's choice — an rtl (vertical-writing) book puts it on the left.
	 */
	leftButton: PageTurnButton;
	rightButton: PageTurnButton;
}

interface BookReaderShellProps {
	title: string;
	/** Where in the book the reader is, such as the chapter title. */
	subtitle?: string | null;
	/** Fraction of the book read, in [0, 1]; omit while unknown. */
	progress?: number;
	onBack: () => void;
	/** Omit while there is nothing to page through (loading, error, no file). */
	pageTurn?: PageTurnControls;
	/** Reader-specific controls shown before the page-turn controls. */
	actions?: ReactNode;
	children: ReactNode;
}

/** Full-height reader frame: header with back/title/page controls, content below. */
export function BookReaderShell({
	title,
	subtitle,
	progress,
	onBack,
	pageTurn,
	actions,
	children,
}: BookReaderShellProps) {
	return (
		<Box display="flex" flexDirection="column" height="100dvh">
			<HStack px={4} py={2} gap={3} borderBottomWidth="1px">
				<IconButton
					aria-label="Back to library"
					variant="ghost"
					size="sm"
					onClick={onBack}
				>
					<LuArrowLeft />
				</IconButton>
				<Box flex="1" minW={0}>
					<Text textStyle="sm" fontWeight="medium" truncate title={title}>
						{title}
					</Text>
					{subtitle && (
						<Text textStyle="xs" color="fg.muted" truncate title={subtitle}>
							{subtitle}
						</Text>
					)}
				</Box>
				{actions}
				{pageTurn && (
					<HStack gap={1}>
						<IconButton
							aria-label={pageTurn.leftButton.label}
							variant="ghost"
							size="sm"
							disabled={pageTurn.leftButton.disabled}
							onClick={pageTurn.leftButton.onClick}
						>
							<LuChevronLeft />
						</IconButton>
						<Text
							textStyle="sm"
							color="fg.muted"
							fontVariantNumeric="tabular-nums"
							minW="16"
							textAlign="center"
						>
							{pageTurn.indicator}
						</Text>
						<IconButton
							aria-label={pageTurn.rightButton.label}
							variant="ghost"
							size="sm"
							disabled={pageTurn.rightButton.disabled}
							onClick={pageTurn.rightButton.onClick}
						>
							<LuChevronRight />
						</IconButton>
					</HStack>
				)}
				{progress !== undefined && (
					<Text
						textStyle="sm"
						color="fg.muted"
						fontVariantNumeric="tabular-nums"
					>
						{Math.round(progress * 100)}%
					</Text>
				)}
			</HStack>
			{progress !== undefined && (
				<Progress.Root size="xs" value={progress * 100} colorPalette="blue">
					<Progress.Track borderRadius={0} aria-label="Reading progress">
						<Progress.Range />
					</Progress.Track>
				</Progress.Root>
			)}

			<Box flex="1" minH={0} bg="bg.muted">
				{children}
			</Box>
		</Box>
	);
}
