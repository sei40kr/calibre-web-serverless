import type { Publisher } from "../models/publisher";

export interface PublisherRepository {
	getAll(userId: string): Promise<Publisher[]>;
	create(userId: string, name: string): Promise<Publisher>;
}
