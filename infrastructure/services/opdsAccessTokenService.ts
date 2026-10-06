import { httpsCallable } from "firebase/functions";
import { functions } from "../lib/firebase";

export interface OpdsAccessToken {
	accessToken: string;
	/** Seconds until the token expires. */
	expiresIn: number;
}

const issueCallable = httpsCallable<void, OpdsAccessToken>(
	functions,
	"issueOpdsAccessToken",
);

/**
 * Client-side gateway to the issueOpdsAccessToken callable, which mints a
 * bearer token an OPDS reader uses in place of the account password.
 */
export const opdsAccessTokenService = {
	/** Issue an OPDS access token for the signed-in user. */
	async issue(): Promise<OpdsAccessToken> {
		const { data } = await issueCallable();
		return data;
	},
};
