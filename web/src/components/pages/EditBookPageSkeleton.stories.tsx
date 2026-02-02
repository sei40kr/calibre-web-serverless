import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import { EditBookPageSkeleton } from "./EditBookPageSkeleton";

const meta = {
	title: "Pages/EditBookPageSkeleton",
	component: EditBookPageSkeleton,
	parameters: {
		layout: "fullscreen",
	},
} satisfies Meta<typeof EditBookPageSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	play: async ({ canvasElement }) => {
		const skeletons = canvasElement.querySelectorAll(".chakra-skeleton");
		await expect(skeletons.length).toBeGreaterThan(0);
	},
};
