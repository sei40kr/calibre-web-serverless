export type AuthErrorCode =
	| "invalid-credential"
	| "invalid-email"
	| "too-many-requests"
	| "user-disabled"
	| "unknown";

export class AuthError extends Error {
	constructor(
		public readonly code: AuthErrorCode,
		message: string,
	) {
		super(message);
	}
}
