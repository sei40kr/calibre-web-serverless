import { useEffect, useState } from "react";
import type { EpubBook } from "@/lib/epub";

/**
 * Downloads and parses an EPUB, keeping the opened book (and its blob URLs)
 * alive until the URL changes or the caller unmounts. The parser is imported
 * lazily so the zip machinery never loads on other pages.
 */
export const useEpubBook = (fileUrl: string | null) => {
	const [epubBook, setEpubBook] = useState<EpubBook | null>(null);
	const [loading, setLoading] = useState(false);
	/** Download progress in [0, 1], or null before the size is known. */
	const [progress, setProgress] = useState<number | null>(null);
	const [error, setError] = useState<Error | null>(null);

	useEffect(() => {
		if (!fileUrl) {
			setEpubBook(null);
			setLoading(false);
			return;
		}

		let active = true;
		let book: EpubBook | null = null;
		setEpubBook(null);
		setLoading(true);
		setProgress(null);
		setError(null);

		(async () => {
			const response = await fetch(fileUrl);
			if (!response.ok) {
				throw new Error(`Failed to download EPUB: HTTP ${response.status}`);
			}

			const total = Number(response.headers.get("content-length"));
			let data: ArrayBuffer;
			if (response.body && total > 0) {
				const reader = response.body.getReader();
				const chunks: BlobPart[] = [];
				let loaded = 0;
				for (;;) {
					const { done, value } = await reader.read();
					if (done) break;
					chunks.push(value);
					loaded += value.length;
					if (active) setProgress(Math.min(loaded / total, 1));
				}
				data = await new Blob(chunks).arrayBuffer();
			} else {
				data = await response.arrayBuffer();
			}

			const { openEpub } = await import("@/lib/epub");
			book = await openEpub(data);
			if (!active) {
				book.dispose();
				return;
			}
			setEpubBook(book);
			setLoading(false);
		})().catch((err: unknown) => {
			if (!active) return;
			setError(err instanceof Error ? err : new Error(String(err)));
			setLoading(false);
		});

		return () => {
			active = false;
			book?.dispose();
		};
	}, [fileUrl]);

	return { epubBook, loading, progress, error };
};
