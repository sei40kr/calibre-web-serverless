import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { BookNotFoundPage } from "./BookNotFoundPage";

const meta = {
	title: "Pages/BookNotFoundPage",
	component: BookNotFoundPage,
	parameters: {
		layout: "fullscreen",
	},
	args: {
		onBack: fn(),
	},
} satisfies Meta<typeof BookNotFoundPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(canvas.getByText(/book not found/i)).toBeInTheDocument();
		await expect(
			canvas.getByText(/the book you're looking for doesn't exist/i),
		).toBeInTheDocument();
		await expect(
			canvas.getByRole("button", { name: /back/i }),
		).toBeInTheDocument();
	},
};

export const BackButton: Story = {
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);

		const backButton = canvas.getByRole("button", { name: /back/i });
		await userEvent.click(backButton);

		await expect(args.onBack).toHaveBeenCalled();
	},
};
