"use client";

import { UploadProgressPanel } from "@/components/UploadProgressPanel";
import { useBookUploads } from "@/contexts/BookUploadContext";
import { useUnloadGuard } from "@/hooks/useUnloadGuard";
import { isBookUploadActive } from "@/lib/bookUpload";

/**
 * Wires the app-wide upload queue to the progress panel and warns before the
 * page unloads while an upload is still in flight.
 */
export function UploadProgressOverlay() {
	const { uploads, dismiss, clearFinished, collapsed, setCollapsed } =
		useBookUploads();

	useUnloadGuard(uploads.some(isBookUploadActive));

	return (
		<UploadProgressPanel
			uploads={uploads}
			collapsed={collapsed}
			onCollapsedChange={setCollapsed}
			onDismiss={dismiss}
			onClose={clearFinished}
		/>
	);
}
