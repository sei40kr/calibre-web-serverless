import { describe, expect, it } from "vitest";
import { MAX_PASSKEY_NAME_LENGTH, normalizePasskeyName } from "./passkey";

describe("normalizePasskeyName", () => {
	it("trims and collapses whitespace", () => {
		expect(normalizePasskeyName("  My   MacBook \n")).toBe("My MacBook");
	});

	it("cuts names to the maximum length", () => {
		expect(normalizePasskeyName("a".repeat(100))).toHaveLength(
			MAX_PASSKEY_NAME_LENGTH,
		);
	});

	it("returns an empty string for a blank name", () => {
		expect(normalizePasskeyName("   ")).toBe("");
	});
});
