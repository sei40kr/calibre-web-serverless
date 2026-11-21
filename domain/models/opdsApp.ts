/**
 * An OPDS reader the user allowed, through the OAuth consent page, to read
 * their library. Access is read-only and lasts until the user revokes it.
 */
export interface OpdsApp {
	id: string;
	/** The name the user gave the app on the consent page. */
	name: string;
	createdAt: Date | null;
	lastUsedAt: Date | null;
}

export const MAX_OPDS_APP_NAME_LENGTH = 100;

/**
 * The bearer token carries the owner and app ids so the function can find
 * the app without an index; only the secret's hash is stored.
 */
export const formatOpdsAccessToken = (
	userId: string,
	appId: string,
	secret: string,
): string => `${userId}.${appId}.${secret}`;

// Ids are restricted to characters that can't escape a Firestore path segment.
const ACCESS_TOKEN = /^([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/;

export const parseOpdsAccessToken = (
	token: string,
): { userId: string; appId: string; secret: string } | null => {
	const match = token.match(ACCESS_TOKEN);
	return match ? { userId: match[1], appId: match[2], secret: match[3] } : null;
};
