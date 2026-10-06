import { createHash, generateKeyPairSync, randomBytes, sign } from "node:crypto";
import { isoCBOR } from "@simplewebauthn/server/helpers";

const b64url = (bytes: Uint8Array | string): string =>
	Buffer.from(bytes).toString("base64url");

const sha256 = (data: Uint8Array | string): Buffer =>
	createHash("sha256").update(data).digest();

const FLAG_UP = 0x01;
const FLAG_UV = 0x04;
const FLAG_AT = 0x40;

/**
 * A minimal ES256 platform authenticator: just enough of WebAuthn to produce
 * registration and assertion responses a relying party can verify, so the
 * passkey callables can be tested without a browser.
 */
export const createSoftAuthenticator = () => {
	const { privateKey, publicKey } = generateKeyPairSync("ec", {
		namedCurve: "P-256",
	});
	const jwk = publicKey.export({ format: "jwk" });
	const credentialId = randomBytes(16);
	let signCount = 0;
	let userHandle: string | null = null;

	const coseKey = isoCBOR.encode(
		new Map<number, number | Uint8Array>([
			[1, 2], // kty: EC2
			[3, -7], // alg: ES256
			[-1, 1], // crv: P-256
			[-2, Buffer.from(jwk.x as string, "base64url")],
			[-3, Buffer.from(jwk.y as string, "base64url")],
		]),
	);

	const clientData = (
		type: "webauthn.create" | "webauthn.get",
		challenge: string,
		origin: string,
	) => JSON.stringify({ type, challenge, origin, crossOrigin: false });

	const counterBytes = () => {
		const bytes = Buffer.alloc(4);
		bytes.writeUInt32BE(signCount);
		return bytes;
	};

	return {
		credentialId: b64url(credentialId),

		/** Answer `navigator.credentials.create()` options. */
		register(
			options: { challenge: string; rp: { id?: string }; user: { id: string } },
			origin: string,
		) {
			userHandle = options.user.id;
			const credIdLength = Buffer.alloc(2);
			credIdLength.writeUInt16BE(credentialId.length);
			const authData = Buffer.concat([
				sha256(options.rp.id ?? ""),
				Buffer.from([FLAG_UP | FLAG_UV | FLAG_AT]),
				counterBytes(),
				Buffer.alloc(16), // AAGUID
				credIdLength,
				credentialId,
				coseKey,
			]);
			const attestationObject = isoCBOR.encode(
				new Map<string, unknown>([
					["fmt", "none"],
					["attStmt", new Map()],
					["authData", authData],
				]) as Parameters<typeof isoCBOR.encode>[0],
			);
			return {
				id: b64url(credentialId),
				rawId: b64url(credentialId),
				type: "public-key" as const,
				response: {
					clientDataJSON: b64url(
						clientData("webauthn.create", options.challenge, origin),
					),
					attestationObject: b64url(attestationObject),
					transports: ["internal" as const],
				},
				clientExtensionResults: {},
			};
		},

		/** Answer `navigator.credentials.get()` options. */
		authenticate(
			options: { challenge: string; rpId?: string },
			origin: string,
		) {
			signCount += 1;
			const authData = Buffer.concat([
				sha256(options.rpId ?? ""),
				Buffer.from([FLAG_UP | FLAG_UV]),
				counterBytes(),
			]);
			const clientDataJSON = clientData(
				"webauthn.get",
				options.challenge,
				origin,
			);
			const signature = sign(
				"sha256",
				Buffer.concat([authData, sha256(clientDataJSON)]),
				privateKey,
			);
			return {
				id: b64url(credentialId),
				rawId: b64url(credentialId),
				type: "public-key" as const,
				response: {
					clientDataJSON: b64url(clientDataJSON),
					authenticatorData: b64url(authData),
					signature: b64url(signature),
					userHandle: userHandle ?? undefined,
				},
				clientExtensionResults: {},
			};
		},
	};
};
