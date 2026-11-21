import { AuthError } from "@calibre-web-serverless/domain/errors/authError";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { DeleteAccountDialog } from "./DeleteAccountDialog";

const meta = {
	title: "Components/DeleteAccountDialog",
	component: DeleteAccountDialog,
	args: {
		open: true,
		onOpenChange: fn(),
		email: "test@example.com",
		bookCount: 5,
		bookshelfCount: 1,
		onDeleteAccount: fn(async () => {}),
	},
} satisfies Meta<typeof DeleteAccountDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	play: async ({ canvasElement, args }) => {
		const dialog = await within(canvasElement.ownerDocument.body).findByRole(
			"alertdialog",
		);

		await expect(dialog).toHaveTextContent(/5 books/);
		await expect(dialog).toHaveTextContent(/1 bookshelf\./);

		await userEvent.type(within(dialog).getByLabelText(/password/i), "pw");
		await userEvent.click(
			within(dialog).getByRole("button", { name: /delete account/i }),
		);

		await expect(args.onDeleteAccount).toHaveBeenCalledWith("pw");
	},
};

export const WrongPassword: Story = {
	args: {
		onDeleteAccount: fn(async () => {
			throw new AuthError("invalid-credential", "wrong");
		}),
	},
	play: async ({ canvasElement }) => {
		const dialog = await within(canvasElement.ownerDocument.body).findByRole(
			"alertdialog",
		);

		await userEvent.type(within(dialog).getByLabelText(/password/i), "wrong");
		await userEvent.click(
			within(dialog).getByRole("button", { name: /delete account/i }),
		);

		await expect(
			await within(dialog).findByText(/password is incorrect/i),
		).toBeInTheDocument();
	},
};
