import { describe, expect, it } from "vitest";
import {
	buildOpdsDeniedCallbackUrl,
	buildOpdsTokenCallbackUrl,
	parseOpdsAuthorizeRequest,
} from "./opdsAuthorization";

const ORIGIN = "https://example.web.app";

describe("parseOpdsAuthorizeRequest", () => {
	it("defaults to the shared OPDS callback", () => {
		expect(parseOpdsAuthorizeRequest(new URLSearchParams())).toEqual({
			redirectUri: "opds://authorize/",
			state: null,
		});
	});

	it("keeps the reader's spelling of the callback and its state", () => {
		expect(
			parseOpdsAuthorizeRequest(
				new URLSearchParams({
					redirect_uri: "opds://authorize",
					response_type: "token",
					client_id: "http://opds-spec.org/auth/client",
					state: "xyz",
				}),
			),
		).toEqual({ redirectUri: "opds://authorize", state: "xyz" });
	});

	it("rejects any other redirect_uri", () => {
		for (const redirectUri of [
			"https://evil.example/",
			"opds://authorize.evil.example/",
			"opds://authorize/extra",
		]) {
			expect(
				parseOpdsAuthorizeRequest(
					new URLSearchParams({ redirect_uri: redirectUri }),
				),
			).toBeNull();
		}
	});

	it("rejects a response_type other than token", () => {
		expect(
			parseOpdsAuthorizeRequest(new URLSearchParams({ response_type: "code" })),
		).toBeNull();
	});
});

describe("buildOpdsTokenCallbackUrl", () => {
	it("returns the token as a bearer token keyed by the document id", () => {
		const url = new URL(
			buildOpdsTokenCallbackUrl(
				{ redirectUri: "opds://authorize/", state: "xyz" },
				ORIGIN,
				{ accessToken: "tok", expiresIn: 60 },
			),
		);
		expect(`${url.protocol}//${url.host}${url.pathname}`).toBe(
			"opds://authorize/",
		);
		expect(Object.fromEntries(url.searchParams)).toEqual({
			id: "https://example.web.app/opds/auth",
			access_token: "tok",
			token_type: "bearer",
			expires_in: "60",
			state: "xyz",
		});
	});

	it("omits state when the reader sent none", () => {
		const url = new URL(
			buildOpdsTokenCallbackUrl(
				{ redirectUri: "opds://authorize/", state: null },
				ORIGIN,
				{ accessToken: "tok", expiresIn: 60 },
			),
		);
		expect(url.searchParams.has("state")).toBe(false);
	});
});

describe("buildOpdsDeniedCallbackUrl", () => {
	it("reports access_denied", () => {
		const url = new URL(
			buildOpdsDeniedCallbackUrl(
				{ redirectUri: "opds://authorize/", state: "xyz" },
				ORIGIN,
			),
		);
		expect(Object.fromEntries(url.searchParams)).toEqual({
			id: "https://example.web.app/opds/auth",
			error: "access_denied",
			state: "xyz",
		});
	});
});
