export type ChangePasswordErrorCode = "weak-password";

/** The new password was refused; `code` says why. */
export class ChangePasswordError extends Error {
	constructor(
		public readonly code: ChangePasswordErrorCode,
		message: string,
	) {
		super(message);
	}
}
