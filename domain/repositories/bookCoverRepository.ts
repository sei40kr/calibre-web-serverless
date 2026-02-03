export interface BookCoverRepository {
	getCoverUrl(
		userId: string,
		bookId: string,
		coverFormat: string,
	): Promise<string>;
	uploadCover(params: {
		userId: string;
		bookId: string;
		file: File;
	}): Promise<void>;
}
