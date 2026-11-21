export type ChangeEmailErrorCode = "email-already-in-use" | "invalid-email";

/** The new email was refused; `code` says why. */
export class ChangeEmailError extends Error {
	constructor(
		public readonly code: ChangeEmailErrorCode,
		message: string,
	) {
		super(message);
	}
}
