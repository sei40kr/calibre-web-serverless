"use client";

import { Box, Flex, HStack, IconButton } from "@chakra-ui/react";
import { type ReactNode, useState } from "react";
import { LuPanelLeft } from "react-icons/lu";
import {
	DrawerBody,
	DrawerCloseTrigger,
	DrawerContent,
	DrawerHeader,
	DrawerRoot,
	DrawerTitle,
} from "@/components/ui/drawer";

interface DashboardShellProps {
	/**
	 * Renders the navigation. Receives a callback the sidebar should invoke
	 * after following a link, so the mobile drawer can close itself.
	 */
	sidebar: (options: { onNavigate: () => void }) => ReactNode;
	children: ReactNode;
}

/**
 * Two-column library layout: a persistent sidebar from the `md` breakpoint
 * up, collapsing into a slide-in drawer behind a toggle button on narrower
 * screens.
 */
export function DashboardShell({ sidebar, children }: DashboardShellProps) {
	const [drawerOpen, setDrawerOpen] = useState(false);

	return (
		<Flex minH="100vh" align="stretch">
			<Box
				as="aside"
				display={{ base: "none", md: "block" }}
				w="64"
				flexShrink={0}
				borderRightWidth="1px"
				borderColor="border"
				position="sticky"
				top={0}
				h="100vh"
				overflowY="auto"
				py={6}
				px={3}
			>
				{sidebar({ onNavigate: () => {} })}
			</Box>

			<Box flex="1" minW={0}>
				<HStack display={{ base: "flex", md: "none" }} px={4} pt={4}>
					<IconButton
						aria-label="Open library navigation"
						variant="outline"
						onClick={() => setDrawerOpen(true)}
					>
						<LuPanelLeft />
					</IconButton>
				</HStack>
				{children}
			</Box>

			<DrawerRoot
				open={drawerOpen}
				onOpenChange={(e) => setDrawerOpen(e.open)}
				placement="start"
				lazyMount
				unmountOnExit
			>
				<DrawerContent>
					<DrawerHeader>
						<DrawerTitle>Library</DrawerTitle>
					</DrawerHeader>
					<DrawerBody>
						{sidebar({ onNavigate: () => setDrawerOpen(false) })}
					</DrawerBody>
					<DrawerCloseTrigger />
				</DrawerContent>
			</DrawerRoot>
		</Flex>
	);
}
