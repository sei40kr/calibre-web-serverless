import type { Author } from "../models/author";

export interface AuthorRepository {
	getAll(userId: string): Promise<Author[]>;
	create(userId: string, name: string): Promise<Author>;
	findByNameOrCreate(userId: string, name: string): Promise<Author>;
}
