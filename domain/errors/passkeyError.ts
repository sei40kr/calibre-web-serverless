export type PasskeyErrorCode =
	/** The browser has no WebAuthn support. */
	| "unsupported"
	/** The user dismissed the browser prompt, or it timed out. */
	| "cancelled"
	/** This authenticator already holds a passkey for the account. */
	| "already-registered"
	/** The ceremony took too long; the server-side challenge is gone. */
	| "expired"
	/** The assertion did not check out, or names an unknown passkey. */
	| "invalid-credential"
	| "user-disabled"
	| "unknown";

export class PasskeyError extends Error {
	constructor(
		public readonly code: PasskeyErrorCode,
		message: string,
	) {
		super(message);
	}
}
