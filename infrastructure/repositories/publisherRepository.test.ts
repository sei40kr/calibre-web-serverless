import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { clearFirestore } from "../testing/clearFirestore";
import { signInTestUser } from "../testing/testUser";
import { publisherRepository } from "./publisherRepository";

let userId: string;

beforeAll(async () => {
	userId = await signInTestUser();
});

describe("publisherRepository", () => {
	beforeEach(async () => {
		await clearFirestore();
	});

	describe("getAll", () => {
		it("returns an empty array when no publishers exist", async () => {
			const publishers = await publisherRepository.getAll(userId);
			expect(publishers).toEqual([]);
		});

		it("returns publishers sorted by name ascending", async () => {
			await publisherRepository.create(userId, "Penguin");
			await publisherRepository.create(userId, "HarperCollins");
			await publisherRepository.create(userId, "Random House");

			const publishers = await publisherRepository.getAll(userId);
			expect(publishers.map((p) => p.name)).toEqual([
				"HarperCollins",
				"Penguin",
				"Random House",
			]);
		});

		it("converts the document correctly", async () => {
			const created = await publisherRepository.create(userId, "Penguin");
			const publishers = await publisherRepository.getAll(userId);
			expect(publishers).toHaveLength(1);

			const publisher = publishers[0];
			expect(publisher.id).toBe(created.id);
			expect(publisher.name).toBe("Penguin");
			expect(publisher.createdAt).toBeInstanceOf(Date);
			expect(publisher.updatedAt).toBeInstanceOf(Date);
		});
	});

	describe("create", () => {
		it("returns a publisher with the generated id and given name", async () => {
			const publisher = await publisherRepository.create(userId, "Penguin");
			expect(publisher.id).toEqual(expect.any(String));
			expect(publisher.id.length).toBeGreaterThan(0);
			expect(publisher.name).toBe("Penguin");
		});
	});
});
