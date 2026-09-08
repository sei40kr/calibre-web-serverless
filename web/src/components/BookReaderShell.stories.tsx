import { Center, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { BookReaderShell } from "./BookReaderShell";

const meta = {
	title: "Components/BookReaderShell",
	component: BookReaderShell,
	parameters: {
		layout: "fullscreen",
	},
	args: {
		title: "Alice's Adventures in Wonderland",
		onBack: fn(),
		pageTurn: {
			indicator: "1 / 12",
			// At the first page: no page to turn back to.
			leftButton: { label: "Previous page", disabled: true, onClick: fn() },
			rightButton: { label: "Next page", disabled: false, onClick: fn() },
		},
		children: (
			<Center height="100%">
				<Text color="fg.muted">Book content</Text>
			</Center>
		),
	},
} satisfies Meta<typeof BookReaderShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);

		await expect(
			canvas.getByText("Alice's Adventures in Wonderland"),
		).toBeInTheDocument();
		await expect(canvas.getByText("1 / 12")).toBeInTheDocument();
		await expect(canvas.getByText("Book content")).toBeInTheDocument();

		await expect(
			canvas.getByRole("button", { name: /previous page/i }),
		).toBeDisabled();
		await userEvent.click(canvas.getByRole("button", { name: /next page/i }));
		await expect(args.pageTurn?.rightButton.onClick).toHaveBeenCalled();

		await userEvent.click(
			canvas.getByRole("button", { name: /back to library/i }),
		);
		await expect(args.onBack).toHaveBeenCalled();
	},
};

// A vertical-writing (rtl) book turns pages leftward: the caller assigns
// "Next page" to the left chevron and "Previous page" to the right one.
export const RightToLeftPageTurn: Story = {
	args: {
		title: "羅生門",
		pageTurn: {
			indicator: "1 / 3 · p. 1 / 4",
			leftButton: { label: "Next page", disabled: false, onClick: fn() },
			rightButton: { label: "Previous page", disabled: true, onClick: fn() },
		},
	},
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);

		await expect(
			canvas.getByRole("button", { name: /previous page/i }),
		).toBeDisabled();
		await userEvent.click(canvas.getByRole("button", { name: /next page/i }));
		await expect(args.pageTurn?.leftButton.onClick).toHaveBeenCalled();
	},
};

// While the book is loading (or failed to load) there is nothing to page
// through, so the readers omit pageTurn and only back/title remain.
export const WithoutPageTurnControls: Story = {
	args: {
		pageTurn: undefined,
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(
			canvas.getByRole("button", { name: /back to library/i }),
		).toBeInTheDocument();
		await expect(
			canvas.queryByRole("button", { name: /next page/i }),
		).not.toBeInTheDocument();
		await expect(
			canvas.queryByRole("button", { name: /previous page/i }),
		).not.toBeInTheDocument();
	},
};
