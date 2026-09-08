"use client";

import { Box, HStack, IconButton, Text } from "@chakra-ui/react";
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
	onBack: () => void;
	/** Omit while there is nothing to page through (loading, error, no file). */
	pageTurn?: PageTurnControls;
	children: ReactNode;
}

/** Full-height reader frame: header with back/title/page controls, content below. */
export function BookReaderShell({
	title,
	onBack,
	pageTurn,
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
				<Text fontWeight="medium" truncate flex="1" title={title}>
					{title}
				</Text>
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
			</HStack>

			<Box flex="1" minH={0} bg="bg.muted">
				{children}
			</Box>
		</Box>
	);
}
