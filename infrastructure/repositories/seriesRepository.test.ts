import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { clearFirestore } from "../testing/clearFirestore";
import { signInTestUser } from "../testing/testUser";
import { seriesRepository } from "./seriesRepository";

let userId: string;

beforeAll(async () => {
	userId = await signInTestUser();
});

describe("seriesRepository", () => {
	beforeEach(async () => {
		await clearFirestore();
	});

	describe("getAll", () => {
		it("returns an empty array when no series exist", async () => {
			const series = await seriesRepository.getAll(userId);
			expect(series).toEqual([]);
		});

		it("returns series sorted by name ascending", async () => {
			await seriesRepository.create(userId, "Zephyr Chronicles");
			await seriesRepository.create(userId, "Alpha Series");
			await seriesRepository.create(userId, "Middle Earth");

			const series = await seriesRepository.getAll(userId);
			expect(series.map((s) => s.name)).toEqual([
				"Alpha Series",
				"Middle Earth",
				"Zephyr Chronicles",
			]);
		});

		it("converts the document correctly", async () => {
			const created = await seriesRepository.create(userId, "My Series");
			const allSeries = await seriesRepository.getAll(userId);
			expect(allSeries).toHaveLength(1);

			const series = allSeries[0];
			expect(series.id).toBe(created.id);
			expect(series.name).toBe("My Series");
			expect(series.createdAt).toBeInstanceOf(Date);
			expect(series.updatedAt).toBeInstanceOf(Date);
		});
	});

	describe("create", () => {
		it("returns a series with the generated id and given name", async () => {
			const series = await seriesRepository.create(userId, "My Series");
			expect(series.id).toEqual(expect.any(String));
			expect(series.id.length).toBeGreaterThan(0);
			expect(series.name).toBe("My Series");
		});
	});
});
