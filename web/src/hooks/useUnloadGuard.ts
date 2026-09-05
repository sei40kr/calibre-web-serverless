import { useEffect } from "react";

/**
 * Asks the browser to confirm before the page unloads (reload, close, or
 * navigating to another site) while `enabled` is true. In-app route changes
 * are not affected.
 */
export function useUnloadGuard(enabled: boolean) {
	useEffect(() => {
		if (!enabled) return;
		const handleBeforeUnload = (e: BeforeUnloadEvent) => {
			e.preventDefault();
		};
		window.addEventListener("beforeunload", handleBeforeUnload);
		return () => window.removeEventListener("beforeunload", handleBeforeUnload);
	}, [enabled]);
}
