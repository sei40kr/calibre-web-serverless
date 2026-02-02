import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { clearFirestore } from "../testing/clearFirestore";
import { signInTestUser } from "../testing/testUser";
import { authorRepository } from "./authorRepository";

let userId: string;

beforeAll(async () => {
	userId = await signInTestUser();
});

describe("authorRepository", () => {
	beforeEach(async () => {
		await clearFirestore();
	});

	describe("getAll", () => {
		it("returns an empty array when no authors exist", async () => {
			const authors = await authorRepository.getAll(userId);
			expect(authors).toEqual([]);
		});

		it("returns authors sorted by name ascending", async () => {
			await authorRepository.create(userId, "Zephyr");
			await authorRepository.create(userId, "Alice");
			await authorRepository.create(userId, "Mango");

			const authors = await authorRepository.getAll(userId);
			expect(authors.map((a) => a.name)).toEqual(["Alice", "Mango", "Zephyr"]);
		});

		it("converts the document correctly", async () => {
			const created = await authorRepository.create(userId, "Alice");
			const authors = await authorRepository.getAll(userId);
			expect(authors).toHaveLength(1);

			const author = authors[0];
			expect(author.id).toBe(created.id);
			expect(author.name).toBe("Alice");
			expect(author.sortName).toBeNull();
			expect(author.createdAt).toBeInstanceOf(Date);
			expect(author.updatedAt).toBeInstanceOf(Date);
		});
	});

	describe("create", () => {
		it("returns an author with the generated id and given name", async () => {
			const author = await authorRepository.create(userId, "Alice");
			expect(author.id).toEqual(expect.any(String));
			expect(author.id.length).toBeGreaterThan(0);
			expect(author.name).toBe("Alice");
		});
	});
});
