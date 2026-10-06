import { describe, expect, it } from "vitest";
import { postSignInPath } from "./postSignInPath";

describe("postSignInPath", () => {
	it("defaults to the dashboard", () => {
		expect(postSignInPath("")).toBe("/dashboard");
	});

	it("returns a same-origin path with its query", () => {
		expect(
			postSignInPath(
				`?next=${encodeURIComponent("/authorize/opds?state=a&redirect_uri=opds%3A%2F%2Fauthorize%2F")}`,
			),
		).toBe("/authorize/opds?state=a&redirect_uri=opds%3A%2F%2Fauthorize%2F");
	});

	it("ignores paths that leave the site", () => {
		for (const next of [
			"https://evil.example/",
			"//evil.example/",
			"/\\evil.example/",
			"javascript:alert(1)",
			"dashboard",
		]) {
			expect(postSignInPath(`?next=${encodeURIComponent(next)}`)).toBe(
				"/dashboard",
			);
		}
	});
});
