import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { BookReaderLoading } from "./BookReaderLoading";

const meta = {
	title: "Components/BookReaderLoading",
	component: BookReaderLoading,
	parameters: {
		layout: "fullscreen",
	},
	args: {
		// Served from the fixtures directory (see .storybook/main.ts staticDirs).
		coverUrl: "/books/alice-in-wonderland/cover.jpg",
		progress: 0.4,
	},
	decorators: [
		(Story) => (
			<Box height="100dvh">
				<Story />
			</Box>
		),
	],
} satisfies Meta<typeof BookReaderLoading>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(
			canvasElement.querySelector("img[src$='cover.jpg']"),
		).toBeInTheDocument();
		await expect(canvas.getByText("Loading…")).toBeInTheDocument();
		await expect(canvas.getByRole("progressbar")).toBeInTheDocument();
	},
};

// Before the download size is known — and for books without a cover — a
// book icon fills the stand-in and the bar is indeterminate.
export const Indeterminate: Story = {
	args: {
		coverUrl: null,
		progress: null,
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(canvasElement.querySelector("img")).not.toBeInTheDocument();
		// The placeholder book icon renders as an inline SVG.
		await expect(canvasElement.querySelector("svg")).toBeInTheDocument();
		await expect(canvas.getByRole("progressbar")).toBeInTheDocument();
	},
};
