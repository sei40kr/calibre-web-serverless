import { expect, type Page, test } from "@playwright/test";

const TEST_USER = { email: "test@example.com", password: "password123" };

/**
 * Give the page a virtual platform authenticator (via the Chrome DevTools
 * Protocol) that answers WebAuthn prompts without interaction, as a
 * fingerprint reader would after a successful scan.
 */
const addVirtualAuthenticator = async (page: Page) => {
	const cdp = await page.context().newCDPSession(page);
	await cdp.send("WebAuthn.enable");
	await cdp.send("WebAuthn.addVirtualAuthenticator", {
		options: {
			protocol: "ctap2",
			transport: "internal",
			hasResidentKey: true,
			hasUserVerification: true,
			isUserVerified: true,
			automaticPresenceSimulation: true,
		},
	});
};

const signInWithPassword = async (page: Page) => {
	await page.goto("/");
	await page.getByLabel("Email").fill(TEST_USER.email);
	await page.getByLabel("Password").fill(TEST_USER.password);
	await page.getByRole("button", { name: "Sign In", exact: true }).click();
	// The first visit compiles the dashboard under `next dev`.
	await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
};

test("registers a passkey and signs in with it", async ({ page }) => {
	await addVirtualAuthenticator(page);
	await signInWithPassword(page);

	await page.getByRole("link", { name: "Passkeys" }).click();
	await expect(page).toHaveURL(/\/dashboard\/passkeys$/);
	const name = `E2E ${Date.now()}`;
	await page.getByRole("textbox", { name: /name/i }).fill(name);
	await page.getByRole("button", { name: "Add passkey" }).click();

	const passkeys = page.getByRole("list", { name: "Passkeys" });
	await expect(passkeys.getByText(name)).toBeVisible();

	await page.getByRole("button", { name: "Back" }).click();
	await page.getByRole("button", { name: "Logout" }).click();
	await expect(page).toHaveURL(/\/$/);

	await page.getByRole("button", { name: "Sign in with a passkey" }).click();
	await expect(page).toHaveURL(/\/dashboard$/);

	// Leave the account as we found it.
	await page.getByRole("link", { name: "Passkeys" }).click();
	await page.getByRole("button", { name: `Delete ${name}` }).click();
	await page
		.getByRole("alertdialog")
		.getByRole("button", { name: "Delete", exact: true })
		.click();
	await expect(passkeys.getByText(name)).toHaveCount(0);
});

test("explains a passkey the server does not know", async ({ page }) => {
	await addVirtualAuthenticator(page);
	await signInWithPassword(page);

	// Register, then revoke: the authenticator still holds the passkey, but
	// the server no longer accepts it.
	await page.getByRole("link", { name: "Passkeys" }).click();
	const name = `Revoked ${Date.now()}`;
	await page.getByRole("textbox", { name: /name/i }).fill(name);
	await page.getByRole("button", { name: "Add passkey" }).click();
	await page.getByRole("button", { name: `Delete ${name}` }).click();
	await page
		.getByRole("alertdialog")
		.getByRole("button", { name: "Delete", exact: true })
		.click();
	await expect(page.getByText(name)).toHaveCount(0);

	await page.getByRole("button", { name: "Back" }).click();
	await page.getByRole("button", { name: "Logout" }).click();
	await page.getByRole("button", { name: "Sign in with a passkey" }).click();

	await expect(
		page.getByText("This passkey is not registered to any account"),
	).toBeVisible();
	await expect(page).toHaveURL(/\/$/);
});
