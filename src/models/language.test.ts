import { describe, expect, it } from "vitest";
import { Language } from "./language";

describe("Language", () => {
	describe("all", () => {
		it("returns all registered languages", () => {
			const all = Language.all();
			expect(all).toContain(Language.EN);
			expect(all).toContain(Language.JA);
			expect(all).toContain(Language.LA);
			expect(all).toHaveLength(15);
		});

		it("returns a copy of the registry", () => {
			const a = Language.all();
			const b = Language.all();
			expect(a).not.toBe(b);
		});
	});

	describe("from", () => {
		it("finds language by code", () => {
			expect(Language.from("en")).toBe(Language.EN);
			expect(Language.from("ja")).toBe(Language.JA);
			expect(Language.from("zh")).toBe(Language.ZH);
		});

		it("returns undefined for unknown code", () => {
			expect(Language.from("xx")).toBeUndefined();
		});
	});

	describe("instances", () => {
		it.each([
			["EN", "en", "English"],
			["DE", "de", "German"],
			["FR", "fr", "French"],
			["ES", "es", "Spanish"],
			["IT", "it", "Italian"],
			["PT", "pt", "Portuguese"],
			["JA", "ja", "Japanese"],
			["ZH", "zh", "Chinese"],
			["KO", "ko", "Korean"],
			["RU", "ru", "Russian"],
			["AR", "ar", "Arabic"],
			["NL", "nl", "Dutch"],
			["SV", "sv", "Swedish"],
			["PL", "pl", "Polish"],
			["LA", "la", "Latin"],
		] as const)("%s has code '%s' and name '%s'", (key, code, name) => {
			const lang = Language[key];
			expect(lang.code).toBe(code);
			expect(lang.name).toBe(name);
		});
	});
});
