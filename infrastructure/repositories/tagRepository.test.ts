import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { clearFirestore } from "../testing/clearFirestore";
import { signInTestUser } from "../testing/testUser";
import { tagRepository } from "./tagRepository";

let userId: string;

beforeAll(async () => {
	userId = await signInTestUser();
});

describe("tagRepository", () => {
	beforeEach(async () => {
		await clearFirestore();
	});

	describe("getAll", () => {
		it("returns an empty array when no tags exist", async () => {
			const tags = await tagRepository.getAll(userId);
			expect(tags).toEqual([]);
		});

		it("returns tags sorted by name ascending", async () => {
			await tagRepository.create(userId, "Science");
			await tagRepository.create(userId, "Fiction");
			await tagRepository.create(userId, "History");

			const tags = await tagRepository.getAll(userId);
			expect(tags.map((t) => t.name)).toEqual([
				"Fiction",
				"History",
				"Science",
			]);
		});

		it("converts the document correctly", async () => {
			const created = await tagRepository.create(userId, "Fiction");
			const tags = await tagRepository.getAll(userId);
			expect(tags).toHaveLength(1);

			const tag = tags[0];
			expect(tag.id).toBe(created.id);
			expect(tag.name).toBe("Fiction");
			expect(tag.createdAt).toBeInstanceOf(Date);
			expect(tag.updatedAt).toBeInstanceOf(Date);
		});
	});

	describe("create", () => {
		it("returns a tag with the generated id and given name", async () => {
			const tag = await tagRepository.create(userId, "Fiction");
			expect(tag.id).toEqual(expect.any(String));
			expect(tag.id.length).toBeGreaterThan(0);
			expect(tag.name).toBe("Fiction");
		});
	});
});
