"use client";

import { comicSpreads } from "@calibre-web-serverless/domain/models/comicArchive";
import { Box, Center, IconButton, Image } from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LuBookOpen } from "react-icons/lu";
import { BookReaderLoading } from "@/components/BookReaderLoading";
import { BookReaderShell } from "@/components/BookReaderShell";
import { EmptyState } from "@/components/ui/empty-state";
import { useComicBook } from "@/hooks/useComicBook";

export interface ComicReaderPageProps {
	title: string;
	/** Cover image shown while the archive loads, or null when the book has none. */
	coverUrl: string | null;
	/** Download URL of the book's CBZ, or null when the book has none. */
	fileUrl: string | null;
	/** True while the URL is still being resolved (fileUrl is null meanwhile). */
	fileLoading: boolean;
	/** 1-based page to show; pages past the end display the last page. */
	pageNo: number;
	/** Called to move to another page; the caller updates the URL. */
	onPageNoChange: (pageNo: number) => void;
	onBack: () => void;
}

// One device-wide choice: whether two pages fit depends on the screen, not
// the book.
const SPREAD_STORAGE_KEY = "comicReader.spread";

function readSpreadPreference(): boolean {
	try {
		return localStorage.getItem(SPREAD_STORAGE_KEY) === "true";
	} catch {
		return false;
	}
}

export function ComicReaderPage({
	title,
	coverUrl,
	fileUrl,
	fileLoading,
	pageNo,
	onPageNoChange,
	onBack,
}: ComicReaderPageProps) {
	const {
		comicBook,
		loading: comicLoading,
		progress,
		error,
	} = useComicBook(fileUrl);
	const [spread, setSpread] = useState(readSpreadPreference);

	const toggleSpread = () => {
		setSpread(!spread);
		try {
			localStorage.setItem(SPREAD_STORAGE_KEY, String(!spread));
		} catch {
			// Storage can be unavailable (private mode); the toggle still works.
		}
	};

	const pages = comicBook?.pages ?? null;
	const spreads = useMemo(
		() =>
			pages &&
			(spread
				? comicSpreads(pages.map((page) => page.wide))
				: pages.map((_, i) => [i])),
		[pages, spread],
	);
	const pageCount = pages?.length ?? null;
	const displayedPageNo =
		pageCount === null ? pageNo : Math.min(pageNo, pageCount);
	const spreadIndex =
		spreads?.findIndex((s) => s.includes(displayedPageNo - 1)) ?? -1;
	const shownPages = spreads?.[spreadIndex] ?? [];

	const goToSpread = useCallback(
		(index: number) => {
			const target = spreads?.[index];
			if (target) onPageNoChange(target[0] + 1);
		},
		[spreads, onPageNoChange],
	);
	const goForward = useCallback(
		() => goToSpread(spreadIndex + 1),
		[goToSpread, spreadIndex],
	);
	const goBackward = useCallback(
		() => goToSpread(spreadIndex - 1),
		[goToSpread, spreadIndex],
	);

	// Right to left, the next page is to the left, so the arrows swap meaning.
	const rtl = comicBook?.rightToLeft ?? true;
	const goLeft = rtl ? goForward : goBackward;
	const goRight = rtl ? goBackward : goForward;

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "ArrowLeft") {
				goLeft();
			} else if (event.key === "ArrowRight") {
				goRight();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [goLeft, goRight]);

	const loading = fileLoading || comicLoading;
	const canGoForward = spreads !== null && spreadIndex < spreads.length - 1;
	const canGoBackward = spreadIndex > 0;
	const firstShown = (shownPages[0] ?? 0) + 1;
	const lastShown = (shownPages.at(-1) ?? 0) + 1;

	return (
		<BookReaderShell
			title={title}
			onBack={onBack}
			actions={
				pages && (
					<IconButton
						aria-label="Two-page spread"
						aria-pressed={spread}
						variant={spread ? "subtle" : "ghost"}
						size="sm"
						onClick={toggleSpread}
					>
						<LuBookOpen />
					</IconButton>
				)
			}
			pageTurn={
				pageCount === null
					? undefined
					: {
							indicator:
								firstShown === lastShown
									? `${firstShown} / ${pageCount}`
									: `${firstShown}–${lastShown} / ${pageCount}`,
							leftButton: {
								label: rtl ? "Next page" : "Previous page",
								disabled: rtl ? !canGoForward : !canGoBackward,
								onClick: goLeft,
							},
							rightButton: {
								label: rtl ? "Previous page" : "Next page",
								disabled: rtl ? !canGoBackward : !canGoForward,
								onClick: goRight,
							},
						}
			}
		>
			{loading ? (
				<BookReaderLoading coverUrl={coverUrl} progress={progress} />
			) : error ? (
				<Center height="100%">
					<EmptyState
						title="Couldn't open the comic"
						description="The file may be corrupted or the download failed. Try again later."
					/>
				</Center>
			) : !fileUrl ? (
				<Center height="100%">
					<EmptyState
						title="No CBZ file"
						description="This book doesn't have a CBZ file to read."
					/>
				</Center>
			) : pages ? (
				<Box
					height="100%"
					display="flex"
					flexDirection={rtl ? "row-reverse" : "row"}
					alignItems="center"
					justifyContent="center"
					overflow="hidden"
					p={4}
				>
					{shownPages.map((index) => (
						<Image
							key={index}
							src={pages[index].url}
							alt={`Page ${index + 1}`}
							maxHeight="100%"
							maxWidth={shownPages.length > 1 ? "50%" : "100%"}
							objectFit="contain"
							shadow="md"
						/>
					))}
				</Box>
			) : null}
		</BookReaderShell>
	);
}
