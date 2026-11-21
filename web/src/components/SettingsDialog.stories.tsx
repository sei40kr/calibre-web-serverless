import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { SettingsDialog } from "./SettingsDialog";

const opdsApp = {
	id: "app1",
	name: "Study iPad",
	createdAt: new Date("2026-11-20T09:00:00Z"),
	lastUsedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
};

const meta = {
	title: "Components/SettingsDialog",
	component: SettingsDialog,
	args: {
		open: true,
		onOpenChange: fn(),
		email: "test@example.com",
		bookCount: 3,
		bookshelfCount: 1,
		onChangeEmail: fn(async () => {}),
		onChangePassword: fn(async () => {}),
		onDeleteAccount: fn(async () => {}),
		opdsCatalogUrl: "https://example.web.app/opds",
		opdsApps: [opdsApp],
		onRevokeOpdsApp: fn(async () => {}),
	},
} satisfies Meta<typeof SettingsDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	play: async ({ canvasElement }) => {
		const body = within(canvasElement.ownerDocument.body);
		const dialog = await body.findByRole("dialog", { name: "Settings" });

		await expect(
			within(dialog).getByRole("tab", { name: /account/i }),
		).toHaveAttribute("aria-selected", "true");

		await userEvent.click(
			within(dialog).getByRole("button", { name: /change email/i }),
		);
		await expect(await body.findByLabelText(/new email/i)).toBeInTheDocument();
	},
};

export const Close: Story = {
	play: async ({ canvasElement, args }) => {
		const dialog = await within(canvasElement.ownerDocument.body).findByRole(
			"dialog",
			{ name: "Settings" },
		);

		await userEvent.click(
			within(dialog).getByRole("button", { name: "Close" }),
		);
		await expect(args.onOpenChange).toHaveBeenCalledWith(false);
	},
};

export const RevokeOpdsApp: Story = {
	play: async ({ canvasElement, args }) => {
		const body = within(canvasElement.ownerDocument.body);
		const dialog = await body.findByRole("dialog", { name: "Settings" });

		await userEvent.click(within(dialog).getByRole("tab", { name: /opds/i }));
		await expect(within(dialog).getByLabelText("Catalog URL")).toHaveValue(
			"https://example.web.app/opds",
		);
		await expect(within(dialog).getByText("Study iPad")).toBeInTheDocument();

		await userEvent.click(
			within(dialog).getByRole("button", { name: "Revoke" }),
		);
		const confirm = await body.findByRole("alertdialog", {
			name: "Revoke access?",
		});
		await userEvent.click(
			within(confirm).getByRole("button", { name: "Revoke access" }),
		);
		await expect(args.onRevokeOpdsApp).toHaveBeenCalledWith(opdsApp);
	},
};

export const NoOpdsApps: Story = {
	args: { opdsApps: [] },
	play: async ({ canvasElement }) => {
		const body = within(canvasElement.ownerDocument.body);
		const dialog = await body.findByRole("dialog", { name: "Settings" });

		await userEvent.click(within(dialog).getByRole("tab", { name: /opds/i }));
		await expect(
			within(dialog).getByText(/no apps connected yet/i),
		).toBeInTheDocument();
	},
};
