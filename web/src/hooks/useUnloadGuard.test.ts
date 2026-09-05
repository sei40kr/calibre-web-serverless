import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useUnloadGuard } from "./useUnloadGuard";

const fireBeforeUnload = () => {
	const event = new Event("beforeunload", { cancelable: true });
	window.dispatchEvent(event);
	return event.defaultPrevented;
};

describe("useUnloadGuard", () => {
	it("does nothing while disabled", () => {
		renderHook(() => useUnloadGuard(false));
		expect(fireBeforeUnload()).toBe(false);
	});

	it("prevents unload while enabled and stops after disabling", () => {
		const { rerender, unmount } = renderHook(
			({ enabled }) => useUnloadGuard(enabled),
			{ initialProps: { enabled: true } },
		);
		expect(fireBeforeUnload()).toBe(true);

		rerender({ enabled: false });
		expect(fireBeforeUnload()).toBe(false);

		rerender({ enabled: true });
		unmount();
		expect(fireBeforeUnload()).toBe(false);
	});
});
