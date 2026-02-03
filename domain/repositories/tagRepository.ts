import type { Tag } from "../models/tag";

export interface TagRepository {
	getAll(userId: string): Promise<Tag[]>;
	create(userId: string, name: string): Promise<Tag>;
	findByNameOrCreate(userId: string, name: string): Promise<Tag>;
}
