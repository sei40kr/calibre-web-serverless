import { describe, expect, it } from "vitest";
import { buildAuthDocument, parseBearerToken } from "./auth";

describe("parseBearerToken", () => {
	it("returns the token", () => {
		expect(parseBearerToken("Bearer a.b.c")).toBe("a.b.c");
	});

	it("is case-insensitive on the scheme", () => {
		expect(parseBearerToken("bearer a.b.c")).toBe("a.b.c");
	});

	it("returns null when header is missing", () => {
		expect(parseBearerToken(undefined)).toBeNull();
	});

	it("returns null for Basic credentials", () => {
		expect(parseBearerToken("Basic dXNlcjpwYXNz")).toBeNull();
	});
});

describe("buildAuthDocument", () => {
	it("points the implicit grant at the consent page of the same origin", () => {
		expect(JSON.parse(buildAuthDocument("https://example.web.app"))).toEqual({
			id: "https://example.web.app/opds/auth",
			title: "Calibre-Web Serverless",
			description: expect.any(String),
			authentication: [
				{
					type: "http://opds-spec.org/auth/oauth/implicit",
					links: [
						{
							rel: "authenticate",
							href: "https://example.web.app/oauth/authorize",
							type: "text/html",
						},
					],
				},
			],
		});
	});
});
