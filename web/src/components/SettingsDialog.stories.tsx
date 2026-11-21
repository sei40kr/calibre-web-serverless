import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { SettingsDialog } from "./SettingsDialog";

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
