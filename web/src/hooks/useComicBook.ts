import { useEffect, useState } from "react";
import type { ComicBook } from "@/lib/comic";
import { downloadWithProgress } from "@/lib/download";

/**
 * Downloads and opens a comic archive (CBZ), keeping its page blob URLs
 * alive until the URL changes or the caller unmounts. jszip is imported
 * lazily so the zip machinery never loads on other pages.
 */
export const useComicBook = (fileUrl: string | null) => {
	const [comicBook, setComicBook] = useState<ComicBook | null>(null);
	const [loading, setLoading] = useState(false);
	/** Download progress in [0, 1], or null before the size is known. */
	const [progress, setProgress] = useState<number | null>(null);
	const [error, setError] = useState<Error | null>(null);

	useEffect(() => {
		if (!fileUrl) {
			setComicBook(null);
			setLoading(false);
			return;
		}

		let active = true;
		let book: ComicBook | null = null;
		setComicBook(null);
		setLoading(true);
		setProgress(null);
		setError(null);

		(async () => {
			const data = await downloadWithProgress(fileUrl, (fraction) => {
				if (active) setProgress(fraction);
			});

			const { openComic } = await import("@/lib/comic");
			book = await openComic(data);
			if (!active) {
				book.dispose();
				return;
			}
			setComicBook(book);
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

	return { comicBook, loading, progress, error };
};
