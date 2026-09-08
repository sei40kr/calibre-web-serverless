"use client";

import { Box, Center } from "@chakra-ui/react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { useCallback, useEffect, useRef, useState } from "react";
import { BookReaderLoading } from "@/components/BookReaderLoading";
import { BookReaderShell } from "@/components/BookReaderShell";
import { EmptyState } from "@/components/ui/empty-state";
import { usePdfDocument } from "@/hooks/usePdfDocument";

export interface PdfReaderPageProps {
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

export function PdfReaderPage({
	title,
	coverUrl,
	fileUrl,
	fileLoading,
	pageNo,
	onPageNoChange,
	onBack,
}: PdfReaderPageProps) {
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
		<BookReaderShell
			title={title}
			onBack={onBack}
			pageTurn={
				pageCount === null
					? undefined
					: {
							indicator: `${displayedPageNo} / ${pageCount}`,
							leftButton: {
								label: "Previous page",
								disabled: displayedPageNo <= 1,
								onClick: () => goToPage(displayedPageNo - 1),
							},
							rightButton: {
								label: "Next page",
								disabled: displayedPageNo >= pageCount,
								onClick: () => goToPage(displayedPageNo + 1),
							},
						}
			}
		>
			{loading ? (
				<BookReaderLoading coverUrl={coverUrl} progress={progress} />
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
						title="No readable file"
						description="This book has no EPUB or PDF file to read."
					/>
				</Center>
			) : pdfDocument ? (
				<PdfPageView pdfDocument={pdfDocument} pageNo={displayedPageNo} />
			) : null}
		</BookReaderShell>
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
