import { describe, expect, it } from "vitest";
import { parseBasicAuth } from "./auth";

describe("parseBasicAuth", () => {
	const encode = (value: string) => Buffer.from(value).toString("base64");

	it("parses email and password", () => {
		expect(parseBasicAuth(`Basic ${encode("a@b.com:secret")}`)).toEqual({
			email: "a@b.com",
			password: "secret",
		});
	});

	it("keeps colons in the password", () => {
		expect(parseBasicAuth(`Basic ${encode("a@b.com:pa:ss")}`)).toEqual({
			email: "a@b.com",
			password: "pa:ss",
		});
	});

	it("is case-insensitive on the scheme", () => {
		expect(parseBasicAuth(`basic ${encode("a@b.com:x")}`)?.email).toBe(
			"a@b.com",
		);
	});

	it("returns null when header is missing", () => {
		expect(parseBasicAuth(undefined)).toBeNull();
	});

	it("returns null for a non-Basic scheme", () => {
		expect(parseBasicAuth("Bearer token")).toBeNull();
	});

	it("returns null when there is no colon", () => {
		expect(parseBasicAuth(`Basic ${encode("noseparator")}`)).toBeNull();
	});

	it("returns null when email is empty", () => {
		expect(parseBasicAuth(`Basic ${encode(":secret")}`)).toBeNull();
	});

	it("returns null when password is empty", () => {
		expect(parseBasicAuth(`Basic ${encode("a@b.com:")}`)).toBeNull();
	});
});
