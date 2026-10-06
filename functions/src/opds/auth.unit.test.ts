import { describe, expect, it } from "vitest";
import { buildAuthenticationDocument, parseBearerToken } from "./auth";

describe("parseBearerToken", () => {
	it("extracts the token", () => {
		expect(parseBearerToken("Bearer abc-DEF_123")).toBe("abc-DEF_123");
	});

	it("is case-insensitive on the scheme", () => {
		expect(parseBearerToken("bearer abc")).toBe("abc");
	});

	it("returns null when header is missing", () => {
		expect(parseBearerToken(undefined)).toBeNull();
	});

	it("returns null for Basic credentials", () => {
		const basic = Buffer.from("a@b.com:secret").toString("base64");
		expect(parseBearerToken(`Basic ${basic}`)).toBeNull();
	});

	it("returns null for an empty token", () => {
		expect(parseBearerToken("Bearer ")).toBeNull();
	});

	it("returns null for a token with characters outside b64token", () => {
		expect(parseBearerToken("Bearer a b")).toBeNull();
	});
});

describe("buildAuthenticationDocument", () => {
	it("offers only the implicit grant, linked to the web app", () => {
		expect(buildAuthenticationDocument("https://example.web.app")).toEqual({
			id: "https://example.web.app/opds/auth",
			title: "Calibre-Web",
			description: expect.any(String),
			authentication: [
				{
					type: "http://opds-spec.org/auth/oauth/implicit",
					links: [
						{
							rel: "authenticate",
							href: "https://example.web.app/authorize/opds",
							type: "text/html",
						},
					],
				},
			],
		});
	});
});
