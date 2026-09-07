"use client";

import {
	Box,
	Center,
	HStack,
	IconButton,
	Image,
	Progress,
	Text,
	VStack,
} from "@chakra-ui/react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { useCallback, useEffect, useRef, useState } from "react";
import { LuArrowLeft, LuChevronLeft, LuChevronRight } from "react-icons/lu";
import { EmptyState } from "@/components/ui/empty-state";
import { usePdfDocument } from "@/hooks/usePdfDocument";

export interface BookReaderPageProps {
	title: string;
	/** Cover image shown while the PDF loads, or null when the book has none. */
	coverUrl: string | null;
	/** Download URL of the book's PDF, or null when the book has none. */
	fileUrl: string | null;
	/** True while the URL is still being resolved (fileUrl is null meanwhile). */
	fileLoading: boolean;
	/** 1-based page to show; pages past the end display the last page. */
	pageNo: number;
	/** Called to move to another page; the caller updates the URL. */
	onPageNoChange: (pageNo: number) => void;
	onBack: () => void;
}

export function BookReaderPage({
	title,
	coverUrl,
	fileUrl,
	fileLoading,
	pageNo,
	onPageNoChange,
	onBack,
}: BookReaderPageProps) {
	const {
		pdfDocument,
		loading: pdfLoading,
		progress,
		error,
	} = usePdfDocument(fileUrl);
	const pageCount = pdfDocument?.numPages ?? null;

	const goToPage = useCallback(
		(nextPageNo: number) => {
			if (pageCount === null) return;
			const clamped = Math.min(Math.max(nextPageNo, 1), pageCount);
			if (clamped !== pageNo) {
				onPageNoChange(clamped);
			}
		},
		[pageCount, pageNo, onPageNoChange],
	);

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "ArrowLeft") {
				goToPage(pageNo - 1);
			} else if (event.key === "ArrowRight") {
				goToPage(pageNo + 1);
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [goToPage, pageNo]);

	const loading = fileLoading || pdfLoading;
	const displayedPageNo =
		pageCount === null ? pageNo : Math.min(pageNo, pageCount);

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
				<HStack gap={1}>
					<IconButton
						aria-label="Previous page"
						variant="ghost"
						size="sm"
						disabled={pageCount === null || displayedPageNo <= 1}
						onClick={() => goToPage(displayedPageNo - 1)}
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
						{pageCount === null ? "– / –" : `${displayedPageNo} / ${pageCount}`}
					</Text>
					<IconButton
						aria-label="Next page"
						variant="ghost"
						size="sm"
						disabled={pageCount === null || displayedPageNo >= pageCount}
						onClick={() => goToPage(displayedPageNo + 1)}
					>
						<LuChevronRight />
					</IconButton>
				</HStack>
			</HStack>

			<Box flex="1" minH={0} bg="bg.muted">
				{loading ? (
					<Center height="100%">
						<VStack gap={4}>
							{/* Fixed-size stand-in so the layout doesn't shift while
							    the cover (and then the PDF) loads. */}
							<Box w="60" h="90" bg="bg.subtle" shadow="md" overflow="hidden">
								{coverUrl && (
									<Image
										src={coverUrl}
										alt=""
										width="100%"
										height="100%"
										objectFit="cover"
									/>
								)}
							</Box>
							<Progress.Root
								value={progress === null ? null : progress * 100}
								size="xs"
								w="60"
							>
								<Progress.Track>
									<Progress.Range />
								</Progress.Track>
							</Progress.Root>
							<Text textStyle="sm" color="fg.muted">
								Loading…
							</Text>
						</VStack>
					</Center>
				) : error ? (
					<Center height="100%">
						<EmptyState
							title="Couldn't open the PDF"
							description="The file may be corrupted or the download failed. Try again later."
						/>
					</Center>
				) : !fileUrl ? (
					<Center height="100%">
						<EmptyState
							title="No PDF file"
							description="This book doesn't have a PDF file to read."
						/>
					</Center>
				) : pdfDocument ? (
					<PdfPageView pdfDocument={pdfDocument} pageNo={displayedPageNo} />
				) : null}
			</Box>
		</Box>
	);
}

interface PdfPageViewProps {
	pdfDocument: PDFDocumentProxy;
	pageNo: number;
}

function PdfPageView({ pdfDocument, pageNo }: PdfPageViewProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [containerSize, setContainerSize] = useState<{
		width: number;
		height: number;
	} | null>(null);

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;
		const observer = new ResizeObserver(([entry]) => {
			setContainerSize({
				width: entry.contentRect.width,
				height: entry.contentRect.height,
			});
		});
		observer.observe(container);
		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas || !containerSize) return;
		if (containerSize.width <= 0 || containerSize.height <= 0) return;

		let active = true;
		let renderTask: RenderTask | null = null;

		(async () => {
			const page = await pdfDocument.getPage(pageNo);
			if (!active) return;

			// Fit the whole page inside the container, rendered at device
			// resolution so it stays sharp on high-DPI screens.
			const baseViewport = page.getViewport({ scale: 1 });
			const scale = Math.min(
				containerSize.width / baseViewport.width,
				containerSize.height / baseViewport.height,
			);
			const outputScale = window.devicePixelRatio || 1;
			const viewport = page.getViewport({ scale });

			canvas.width = Math.floor(viewport.width * outputScale);
			canvas.height = Math.floor(viewport.height * outputScale);
			canvas.style.width = `${Math.floor(viewport.width)}px`;
			canvas.style.height = `${Math.floor(viewport.height)}px`;

			renderTask = page.render({
				canvas,
				viewport,
				transform:
					outputScale !== 1
						? [outputScale, 0, 0, outputScale, 0, 0]
						: undefined,
			});
			await renderTask.promise;
		})().catch(() => {
			// Cancellation on page turn / resize is routine; a genuinely broken
			// page leaves the canvas blank, which the user can escape by
			// navigating — the document-level error state already covers
			// unreadable files.
		});

		return () => {
			active = false;
			renderTask?.cancel();
		};
	}, [pdfDocument, pageNo, containerSize]);

	return (
		<Box
			ref={containerRef}
			height="100%"
			display="flex"
			alignItems="center"
			justifyContent="center"
			overflow="hidden"
			p={4}
		>
			<Box asChild shadow="md" bg="white">
				<canvas ref={canvasRef} />
			</Box>
		</Box>
	);
}
