import { expect, test } from "@playwright/test";

const TEST_USER = { email: "test@example.com", password: "password123" };

const ATOM = "application/atom+xml";

/** The href of the first `<link>` in `xml` whose rel is `rel`. */
const linkHref = (xml: string, rel: string): string | undefined =>
	xml
		.match(/<link\b[^>]*>/g)
		?.find((link) => link.includes(`rel="${rel}"`))
		?.match(/href="([^"]+)"/)?.[1];

test("an OPDS app gets authorized through OAuth and reads the library", async ({
	page,
	request,
}) => {
	// 1. Unauthenticated: the catalog answers with the Authentication Document.
	const challenge = await request.get("/opds");
	expect(challenge.status()).toBe(401);
	expect(challenge.headers()["content-type"]).toContain(
		"application/opds-authentication+json",
	);
	const authDocument = await challenge.json();
	const implicit = authDocument.authentication.find(
		(auth: { type: string }) =>
			auth.type === "http://opds-spec.org/auth/oauth/implicit",
	);
	const authenticateUrl: string = implicit.links.find(
		(link: { rel: string }) => link.rel === "authenticate",
	).href;

	// 2. The reader opens the consent page; the user signs in and comes back.
	await page.goto(authenticateUrl);
	await page.getByLabel("Email").fill(TEST_USER.email);
	await page.getByLabel("Password").fill(TEST_USER.password);
	await page.getByRole("button", { name: "Sign In" }).click();
	await expect(page).toHaveURL(/\/oauth\/authorize$/);

	// 3. Allowing access sends the reader back to the OPDS callback with a token.
	await page.getByLabel(/name this app/i).fill("E2E reader");
	const callback = page.waitForRequest((req) =>
		req.url().startsWith("opds://authorize/"),
	);
	await page.getByRole("button", { name: "Allow" }).click();
	const callbackUrl = new URL((await callback).url());
	expect(callbackUrl.searchParams.get("id")).toBe(authDocument.id);
	expect(callbackUrl.searchParams.get("token_type")).toBe("bearer");
	const token = callbackUrl.searchParams.get("access_token");
	expect(token).toBeTruthy();
	const headers = { Authorization: `Bearer ${token}` };

	// 4. The token opens the catalog and the all-books acquisition feed.
	const root = await request.get("/opds", { headers });
	expect(root.status()).toBe(200);
	expect(root.headers()["content-type"]).toContain(ATOM);

	const books = await request.get("/opds/books", { headers });
	expect(books.status()).toBe(200);
	const feed = await books.text();

	// 5. Thumbnails and book files download with the same token.
	const thumbnailHref = linkHref(feed, "http://opds-spec.org/image/thumbnail");
	const downloadHref = linkHref(feed, "http://opds-spec.org/acquisition");
	expect(thumbnailHref).toBeDefined();
	expect(downloadHref).toBeDefined();

	const thumbnail = await request.get(thumbnailHref as string, { headers });
	expect(thumbnail.status()).toBe(200);
	expect(thumbnail.headers()["content-type"]).toBe("image/png");
	expect((await thumbnail.body()).length).toBeGreaterThan(0);

	const download = await request.get(downloadHref as string, { headers });
	expect(download.status()).toBe(200);
	expect((await download.body()).length).toBeGreaterThan(0);

	// A forged token is refused.
	const forged = await request.get("/opds/books", {
		headers: { Authorization: `Bearer ${token}x` },
	});
	expect(forged.status()).toBe(401);
});
