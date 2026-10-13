/**
 * Downloads a file, reporting progress in [0, 1] while the size is known
 * (Content-Length present); otherwise no progress is reported. Rejects on a
 * non-OK HTTP status.
 */
export async function downloadWithProgress(
	url: string,
	onProgress: (progress: number) => void,
): Promise<ArrayBuffer> {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to download ${url}: HTTP ${response.status}`);
	}

	const total = Number(response.headers.get("content-length"));
	if (!response.body || !(total > 0)) {
		return response.arrayBuffer();
	}
	const reader = response.body.getReader();
	const chunks: BlobPart[] = [];
	let loaded = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		chunks.push(value);
		loaded += value.length;
		onProgress(Math.min(loaded / total, 1));
	}
	return new Blob(chunks).arrayBuffer();
}
