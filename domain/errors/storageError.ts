export type StorageErrorCode =
	| "unauthorized"
	| "canceled"
	| "quota-exceeded"
	| "unknown";

export class StorageError extends Error {
	constructor(
		public readonly code: StorageErrorCode,
		message: string,
	) {
		super(message);
	}
}
