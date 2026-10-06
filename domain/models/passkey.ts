/**
 * A WebAuthn credential registered to the signed-in account. Only what the
 * user needs to recognise and revoke it — the public key and signature
 * counter never leave the server.
 */
export interface Passkey {
	/** The credential ID (base64url), unique across all accounts. */
	id: string;
	name: string;
	/** Synced by a passkey provider (iCloud Keychain, Google Password Manager…) rather than bound to one device. */
	backedUp: boolean;
	createdAt: Date;
	lastUsedAt: Date | null;
}

export const MAX_PASSKEY_NAME_LENGTH = 64;

/**
 * Canonical form of a passkey name as entered by the user: trimmed, internal
 * whitespace collapsed and cut to the maximum length. An empty result means
 * "let the server pick a default".
 */
export const normalizePasskeyName = (name: string): string =>
	name.trim().replace(/\s+/g, " ").slice(0, MAX_PASSKEY_NAME_LENGTH);
