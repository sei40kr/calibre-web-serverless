import { AuthError } from "@calibre-web-serverless/domain/errors/authError";
import { ChangeEmailError } from "@calibre-web-serverless/domain/errors/changeEmailError";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { ChangeEmailDialog } from "./ChangeEmailDialog";

const meta = {
	title: "Components/ChangeEmailDialog",
	component: ChangeEmailDialog,
	args: {
		open: true,
		onOpenChange: fn(),
		currentEmail: "test@example.com",
		onChangeEmail: fn(async () => {}),
	},
} satisfies Meta<typeof ChangeEmailDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	play: async ({ canvasElement, args }) => {
		const dialog = await within(canvasElement.ownerDocument.body).findByRole(
			"dialog",
		);

		await userEvent.type(
			within(dialog).getByLabelText(/new email/i),
			"reader@example.com",
		);
		await userEvent.type(
			within(dialog).getByLabelText(/current password/i),
			"password123",
		);
		await userEvent.click(
			within(dialog).getByRole("button", { name: /send verification email/i }),
		);

		await expect(args.onChangeEmail).toHaveBeenCalledWith(
			"reader@example.com",
			"password123",
		);
		await expect(args.onOpenChange).toHaveBeenCalledWith(false);
	},
};

export const RejectsCurrentEmail: Story = {
	play: async ({ canvasElement, args }) => {
		const dialog = await within(canvasElement.ownerDocument.body).findByRole(
			"dialog",
		);

		await userEvent.type(
			within(dialog).getByLabelText(/new email/i),
			"Test@example.com",
		);
		await userEvent.type(
			within(dialog).getByLabelText(/current password/i),
			"password123",
		);
		await userEvent.click(
			within(dialog).getByRole("button", { name: /send verification email/i }),
		);

		await expect(
			await within(dialog).findByText(/already your email/i),
		).toBeInTheDocument();
		await expect(args.onChangeEmail).not.toHaveBeenCalled();
	},
};

export const EmailInUse: Story = {
	args: {
		onChangeEmail: fn(async () => {
			throw new ChangeEmailError("email-already-in-use", "in use");
		}),
	},
	play: async ({ canvasElement, args }) => {
		const dialog = await within(canvasElement.ownerDocument.body).findByRole(
			"dialog",
		);

		await userEvent.type(
			within(dialog).getByLabelText(/new email/i),
			"reader@example.com",
		);
		await userEvent.type(
			within(dialog).getByLabelText(/current password/i),
			"password123",
		);
		await userEvent.click(
			within(dialog).getByRole("button", { name: /send verification email/i }),
		);

		await expect(
			await within(dialog).findByText(/already in use/i),
		).toBeInTheDocument();
		await expect(args.onOpenChange).not.toHaveBeenCalled();
	},
};

export const WrongPassword: Story = {
	args: {
		onChangeEmail: fn(async () => {
			throw new AuthError("invalid-credential", "wrong");
		}),
	},
	play: async ({ canvasElement, args }) => {
		const dialog = await within(canvasElement.ownerDocument.body).findByRole(
			"dialog",
		);

		await userEvent.type(
			within(dialog).getByLabelText(/new email/i),
			"reader@example.com",
		);
		await userEvent.type(
			within(dialog).getByLabelText(/current password/i),
			"wrong",
		);
		await userEvent.click(
			within(dialog).getByRole("button", { name: /send verification email/i }),
		);

		await expect(
			await within(dialog).findByText(/current password is incorrect/i),
		).toBeInTheDocument();
		await expect(args.onOpenChange).not.toHaveBeenCalled();
	},
};
