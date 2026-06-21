const MAX_COVER_BYTES = 10 * 1024 * 1024;

// Covers are only ever fetched from the URLs our own providers emit. The
// allowlist keeps this callable from being abused as an open server-side proxy
// for arbitrary URLs.
const ALLOWED_COVER_HOSTS: RegExp[] = [
	/(^|\.)googleusercontent\.com$/,
	/(^|\.)google\.com$/,
	/(^|\.)googleapis\.com$/,
	/(^|\.)gstatic\.com$/,
];

// The client stages the cover through the custom-cover upload path, which only
// accepts these MIME types.
const ACCEPTED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function normalizeImageContentType(raw: string | null): string {
	const base = (raw ?? "").split(";")[0].trim().toLowerCase();
	// Unknown/odd image types are coerced to JPEG; Google serves JPEG covers.
	return ACCEPTED_IMAGE_TYPES.has(base) ? base : "image/jpeg";
}

export function isAllowedCoverHost(hostname: string): boolean {
	return ALLOWED_COVER_HOSTS.some((re) => re.test(hostname));
}

export interface FetchBookCoverResult {
	dataBase64: string;
	contentType: string;
}

/**
 * Download a cover image server-side and return it base64-encoded, so the
 * browser can stage it as a custom cover without hitting cross-origin
 * restrictions on the store's image CDN.
 */
export async function fetchBookCover(
	url: string,
): Promise<FetchBookCoverResult> {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		throw new Error("Invalid cover URL");
	}
	if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
		throw new Error("Unsupported cover URL protocol");
	}
	if (!isAllowedCoverHost(parsed.hostname)) {
		throw new Error(`Cover host not allowed: ${parsed.hostname}`);
	}

	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`Cover request failed (${res.status})`);
	}
	const contentType = normalizeImageContentType(
		res.headers.get("content-type"),
	);
	const buffer = Buffer.from(await res.arrayBuffer());
	if (buffer.byteLength === 0) {
		throw new Error("Cover image is empty");
	}
	if (buffer.byteLength > MAX_COVER_BYTES) {
		throw new Error("Cover image is too large");
	}
	return { dataBase64: buffer.toString("base64"), contentType };
}
