import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { CreateBookshelfDialog } from "./CreateBookshelfDialog";

const meta = {
	title: "Components/CreateBookshelfDialog",
	component: CreateBookshelfDialog,
	args: {
		open: true,
		onOpenChange: fn(),
		onCreate: fn(async () => {}),
	},
} satisfies Meta<typeof CreateBookshelfDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	play: async ({ canvasElement, args }) => {
		const body = within(canvasElement.ownerDocument.body);
		const dialog = await body.findByRole("dialog");

		await userEvent.type(within(dialog).getByRole("textbox"), "Classics");
		await userEvent.click(
			within(dialog).getByRole("button", { name: /^create$/i }),
		);

		await expect(args.onCreate).toHaveBeenCalledWith("Classics");
		await expect(args.onOpenChange).toHaveBeenCalledWith(false);
	},
};

export const RejectsBlankName: Story = {
	play: async ({ canvasElement, args }) => {
		const body = within(canvasElement.ownerDocument.body);
		const dialog = await body.findByRole("dialog");

		await userEvent.type(within(dialog).getByRole("textbox"), "   ");
		await userEvent.click(
			within(dialog).getByRole("button", { name: /^create$/i }),
		);

		await expect(
			await within(dialog).findByText(/please enter a name/i),
		).toBeInTheDocument();
		await expect(args.onCreate).not.toHaveBeenCalled();
	},
};

export const Cancelled: Story = {
	play: async ({ canvasElement, args }) => {
		const body = within(canvasElement.ownerDocument.body);
		const dialog = await body.findByRole("dialog");

		await userEvent.click(
			within(dialog).getByRole("button", { name: /cancel/i }),
		);

		await expect(args.onOpenChange).toHaveBeenCalledWith(false);
		await expect(args.onCreate).not.toHaveBeenCalled();
	},
};
