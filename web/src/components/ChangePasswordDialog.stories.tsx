import { AuthError } from "@calibre-web-serverless/domain/errors/authError";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { ChangePasswordDialog } from "./ChangePasswordDialog";

const meta = {
	title: "Components/ChangePasswordDialog",
	component: ChangePasswordDialog,
	args: {
		open: true,
		onOpenChange: fn(),
		onChangePassword: fn(async () => {}),
	},
} satisfies Meta<typeof ChangePasswordDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

const fill = async (
	dialog: HTMLElement,
	current: string,
	next: string,
	confirm: string,
) => {
	const scope = within(dialog);
	await userEvent.type(scope.getByLabelText(/^current password/i), current);
	await userEvent.type(scope.getByLabelText(/^new password/i), next);
	await userEvent.type(scope.getByLabelText(/^confirm new password/i), confirm);
	await userEvent.click(
		scope.getByRole("button", { name: /update password/i }),
	);
};

export const Default: Story = {
	play: async ({ canvasElement, args }) => {
		const dialog = await within(canvasElement.ownerDocument.body).findByRole(
			"dialog",
		);

		await fill(dialog, "password123", "new-password", "new-password");

		await expect(args.onChangePassword).toHaveBeenCalledWith(
			"password123",
			"new-password",
		);
		await expect(args.onOpenChange).toHaveBeenCalledWith(false);
	},
};

export const RejectsMismatch: Story = {
	play: async ({ canvasElement, args }) => {
		const dialog = await within(canvasElement.ownerDocument.body).findByRole(
			"dialog",
		);

		await fill(dialog, "password123", "new-password", "other-password");

		await expect(
			await within(dialog).findByText(/passwords don't match/i),
		).toBeInTheDocument();
		await expect(args.onChangePassword).not.toHaveBeenCalled();
	},
};

export const WrongPassword: Story = {
	args: {
		onChangePassword: fn(async () => {
			throw new AuthError("invalid-credential", "wrong");
		}),
	},
	play: async ({ canvasElement, args }) => {
		const dialog = await within(canvasElement.ownerDocument.body).findByRole(
			"dialog",
		);

		await fill(dialog, "wrong", "new-password", "new-password");

		await expect(
			await within(dialog).findByText(/current password is incorrect/i),
		).toBeInTheDocument();
		await expect(args.onOpenChange).not.toHaveBeenCalled();
	},
};
