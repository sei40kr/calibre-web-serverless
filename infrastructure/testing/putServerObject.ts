const storageHost =
	process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? "127.0.0.1:9199";
const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

/**
 * Uploads an object the way a Cloud Function does: straight to the emulator
 * with an admin credential, bypassing the Storage rules. The served covers
 * (cover.png, custom_cover.png) are written only by resizeBookCover and
 * extractBookMetadata, and the rules reject a client write to either, so a test
 * that needs one in place cannot put it there through the client SDK.
 */
export const putServerObject = async (
	path: string,
	body: Uint8Array,
	contentType: string,
): Promise<void> => {
	const res = await fetch(
		`http://${storageHost}/v0/b/${bucket}/o?name=${encodeURIComponent(path)}`,
		{
			method: "POST",
			headers: { Authorization: "Bearer owner", "Content-Type": contentType },
			// Copied into a plain ArrayBuffer: a Buffer's ArrayBufferLike is not
			// assignable to fetch's BodyInit.
			body: new Uint8Array(body),
		},
	);
	if (!res.ok) {
		throw new Error(`Failed to put ${path}: ${res.status}`);
	}
};
