"use client";

import { bookRepository } from "@calibre-web-serverless/infrastructure/repositories/bookRepository";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useMemo,
	useState,
	useSyncExternalStore,
} from "react";
import type { BookUpload } from "@/lib/bookUpload";
import { createBookUploadQueue } from "@/lib/bookUploadQueue";

interface BookUploadContextType {
	uploads: readonly BookUpload[];
	/** Queue files for background upload; the panel expands to show them. */
	enqueue: (userId: string, files: readonly File[]) => void;
	dismiss: (id: string) => void;
	clearFinished: () => void;
	/** Whether the progress panel is folded down to its header. */
	collapsed: boolean;
	setCollapsed: (collapsed: boolean) => void;
}

const BookUploadContext = createContext<BookUploadContextType | undefined>(
	undefined,
);

/**
 * Owns the background upload queue for the whole app. Mount it once near the
 * root so uploads keep running across in-app navigation.
 */
export function BookUploadProvider({ children }: { children: ReactNode }) {
	const [queue] = useState(() =>
		createBookUploadQueue({
			createBook: bookRepository.createBook,
			subscribeToBook: bookRepository.subscribeToBook,
		}),
	);
	const uploads = useSyncExternalStore(
		queue.subscribe,
		queue.getSnapshot,
		queue.getSnapshot,
	);
	const [collapsed, setCollapsed] = useState(false);

	const enqueue = useCallback(
		(userId: string, files: readonly File[]) => {
			queue.enqueue(userId, files);
			setCollapsed(false);
		},
		[queue],
	);

	const clearFinished = useCallback(() => {
		queue.clearFinished();
		setCollapsed(false);
	}, [queue]);

	const value = useMemo(
		() => ({
			uploads,
			enqueue,
			dismiss: queue.dismiss,
			clearFinished,
			collapsed,
			setCollapsed,
		}),
		[uploads, enqueue, queue, clearFinished, collapsed],
	);

	return (
		<BookUploadContext.Provider value={value}>
			{children}
		</BookUploadContext.Provider>
	);
}

export function useBookUploads() {
	const context = useContext(BookUploadContext);
	if (context === undefined) {
		throw new Error("useBookUploads must be used within a BookUploadProvider");
	}
	return context;
}
