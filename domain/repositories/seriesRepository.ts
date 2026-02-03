import type { Series } from "../models/series";

export interface SeriesRepository {
	getAll(userId: string): Promise<Series[]>;
	create(userId: string, name: string): Promise<Series>;
	findByNameOrCreate(userId: string, name: string): Promise<Series>;
}
