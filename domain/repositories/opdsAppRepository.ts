import type { OpdsApp } from "../models/opdsApp";

export interface OpdsAppRepository {
	/** Live list of the user's OPDS apps, newest first. */
	subscribeToOpdsApps(
		userId: string,
		callbacks: {
			onData: (apps: OpdsApp[]) => void;
			onError: (error: Error) => void;
		},
	): () => void;
	/** Register a new app and return its access token, the only copy of it. */
	authorize(userId: string, name: string): Promise<string>;
	/** The app's token stops working immediately. */
	revoke(userId: string, appId: string): Promise<void>;
}
