import type { PDFDocumentLoadingTask, PDFDocumentProxy } from "pdfjs-dist";
import { useEffect, useState } from "react";

/**
 * Loads a PDF with pdf.js and keeps the parsed document alive until the URL
 * changes or the caller unmounts. pdf.js is imported lazily so the reader
 * bundle (and its worker) never loads during prerendering or on other pages.
 */
export const usePdfDocument = (fileUrl: string | null) => {
	const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
	const [loading, setLoading] = useState(false);
	/** Download progress in [0, 1], or null before the size is known. */
	const [progress, setProgress] = useState<number | null>(null);
	const [error, setError] = useState<Error | null>(null);

	useEffect(() => {
		if (!fileUrl) {
			setPdfDocument(null);
			setLoading(false);
			return;
		}

		let active = true;
		let loadingTask: PDFDocumentLoadingTask | null = null;
		setPdfDocument(null);
		setLoading(true);
		setProgress(null);
		setError(null);

		(async () => {
			const pdfjs = await import("pdfjs-dist");
			pdfjs.GlobalWorkerOptions.workerSrc = new URL(
				"pdfjs-dist/build/pdf.worker.min.mjs",
				import.meta.url,
			).toString();
			if (!active) return;
			loadingTask = pdfjs.getDocument({ url: fileUrl });
			loadingTask.onProgress = ({
				loaded,
				total,
			}: {
				loaded: number;
				total: number;
			}) => {
				if (!active) return;
				setProgress(total > 0 ? Math.min(loaded / total, 1) : null);
			};
			const document = await loadingTask.promise;
			if (!active) return;
			setPdfDocument(document);
			setLoading(false);
		})().catch((err: unknown) => {
			// Destroying the task on cleanup rejects its promise; `active` is
			// already false then, so only real failures surface.
			if (!active) return;
			setError(err instanceof Error ? err : new Error(String(err)));
			setLoading(false);
		});

		return () => {
			active = false;
			loadingTask?.destroy();
		};
	}, [fileUrl]);

	return { pdfDocument, loading, progress, error };
};
