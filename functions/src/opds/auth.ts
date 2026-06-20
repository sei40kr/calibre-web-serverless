// Firebase Auth has no admin-side password check, so OPDS Basic-auth
// credentials are verified against the Identity Toolkit REST endpoint — the
// same backend the client SDK's signInWithEmailAndPassword calls. We only need
// the resulting uid; the returned session is intentionally discarded so each
// request stays stateless (admin SDK, scoped to that uid, does the reads).

export interface BasicCredentials {
	email: string;
	password: string;
}

/**
 * Parse an `Authorization: Basic <base64(email:password)>` header. Returns null
 * for any header that is missing, not Basic, malformed, or lacks both parts.
 */
export function parseBasicAuth(
	header: string | undefined,
): BasicCredentials | null {
	if (!header) return null;
	const match = header.match(/^Basic\s+(.+)$/i);
	if (!match) return null;

	let decoded: string;
	try {
		decoded = Buffer.from(match[1], "base64").toString("utf8");
	} catch {
		return null;
	}

	// The password may itself contain ":", so split on the first one only.
	const sep = decoded.indexOf(":");
	if (sep < 0) return null;
	const email = decoded.slice(0, sep);
	const password = decoded.slice(sep + 1);
	if (!email || !password) return null;
	return { email, password };
}

export type VerifyResult =
	| { ok: true; uid: string }
	| { ok: false; status: 401 | 429 };

// The web API key is a public value (it ships in the client config). The Auth
// emulator ignores it, so any non-empty placeholder works there.
function identityToolkitUrl(): string {
	const key = process.env.OPDS_WEB_API_KEY || "fake-api-key";
	const path = `identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${key}`;
	const emulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
	return emulatorHost ? `http://${emulatorHost}/${path}` : `https://${path}`;
}

/**
 * Verify email/password via Identity Toolkit and return the uid. Maps Firebase
 * throttling to 429 and every other failure (bad password, unknown user,
 * disabled account) to 401. Credentials are never logged.
 */
export async function verifyCredentials(
	creds: BasicCredentials,
): Promise<VerifyResult> {
	const res = await fetch(identityToolkitUrl(), {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			email: creds.email,
			password: creds.password,
			returnSecureToken: true,
		}),
	});

	if (res.ok) {
		const data = (await res.json()) as { localId?: string };
		return data.localId
			? { ok: true, uid: data.localId }
			: { ok: false, status: 401 };
	}

	let code = "";
	try {
		const body = (await res.json()) as { error?: { message?: string } };
		code = body.error?.message ?? "";
	} catch {
		// Non-JSON error body; treat as a generic auth failure below.
	}
	return code.startsWith("TOO_MANY_ATTEMPTS")
		? { ok: false, status: 429 }
		: { ok: false, status: 401 };
}
