import { useEffect, useState } from "react";
import { downloadWithProgress } from "@/lib/download";
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
			const data = await downloadWithProgress(fileUrl, (fraction) => {
				if (active) setProgress(fraction);
			});

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
