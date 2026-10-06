const MAX_COVER_BYTES = 10 * 1024 * 1024;

// Store CDNs redirect a cover once or twice at most; anything longer is not a
// cover.
const MAX_REDIRECTS = 3;

// Covers are only ever fetched from the URLs our own providers emit. The
// allowlist keeps this callable from being abused as an open server-side proxy
// for arbitrary URLs, so it names the cover hosts themselves rather than whole
// Google domains: google.com carries open redirects (/url?q=) and
// storage.googleapis.com serves anyone's bucket.
const ALLOWED_COVER_HOSTS: RegExp[] = [
	/^books\.google\.com$/,
	/(^|\.)googleusercontent\.com$/,
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

function assertAllowedUrl(url: URL): void {
	if (url.protocol !== "https:" && url.protocol !== "http:") {
		throw new Error("Unsupported cover URL protocol");
	}
	if (!isAllowedCoverHost(url.hostname)) {
		throw new Error(`Cover host not allowed: ${url.hostname}`);
	}
}

/**
 * Fetch `url`, following redirects by hand so every hop is checked against the
 * allowlist; fetch's own redirect handling would only ever see the first URL.
 */
async function fetchAllowed(url: URL): Promise<Response> {
	let current = url;
	for (let hop = 0; ; hop++) {
		assertAllowedUrl(current);
		const res = await fetch(current, { redirect: "manual" });
		if (res.status < 300 || res.status >= 400) return res;

		const location = res.headers.get("location");
		if (!location || hop >= MAX_REDIRECTS) {
			throw new Error("Cover request redirected too often");
		}
		current = new URL(location, current);
	}
}

/**
 * Read the body, aborting as soon as it exceeds the cap rather than buffering
 * whatever the server chooses to send.
 */
async function readCapped(res: Response): Promise<Buffer> {
	const declared = Number(res.headers.get("content-length"));
	if (declared > MAX_COVER_BYTES) {
		throw new Error("Cover image is too large");
	}
	if (!res.body) return Buffer.alloc(0);

	const chunks: Uint8Array[] = [];
	let total = 0;
	const reader = res.body.getReader();
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		total += value.byteLength;
		if (total > MAX_COVER_BYTES) {
			await reader.cancel();
			throw new Error("Cover image is too large");
		}
		chunks.push(value);
	}
	return Buffer.concat(chunks);
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

	const res = await fetchAllowed(parsed);
	if (!res.ok) {
		throw new Error(`Cover request failed (${res.status})`);
	}
	const contentType = normalizeImageContentType(
		res.headers.get("content-type"),
	);
	const buffer = await readCapped(res);
	if (buffer.byteLength === 0) {
		throw new Error("Cover image is empty");
	}
	return { dataBase64: buffer.toString("base64"), contentType };
}
