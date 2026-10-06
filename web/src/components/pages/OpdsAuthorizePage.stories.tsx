import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { OpdsAuthorizePage } from "./OpdsAuthorizePage";

const meta = {
	title: "Pages/OpdsAuthorizePage",
	component: OpdsAuthorizePage,
	parameters: {
		layout: "fullscreen",
	},
	args: {
		status: "ready",
		onAllow: fn(),
		onDeny: fn(),
	},
} satisfies Meta<typeof OpdsAuthorizePage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);

		await expect(
			canvas.getByText(/never sees your password/i),
		).toBeInTheDocument();

		await userEvent.click(canvas.getByRole("button", { name: /allow/i }));
		await expect(args.onAllow).toHaveBeenCalled();

		await userEvent.click(canvas.getByRole("button", { name: /deny/i }));
		await expect(args.onDeny).toHaveBeenCalled();
	},
};

export const Authorizing: Story = {
	args: { status: "authorizing" },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(canvas.getByRole("button", { name: /deny/i })).toBeDisabled();
	},
};

export const Failed: Story = {
	args: { status: "failed" },
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);

		await expect(
			canvas.getByText(/failed to connect the reader/i),
		).toBeInTheDocument();
		await userEvent.click(canvas.getByRole("button", { name: /allow/i }));
		await expect(args.onAllow).toHaveBeenCalled();
	},
};

export const Authorized: Story = {
	args: { status: "authorized" },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(canvas.getByText(/reader connected/i)).toBeInTheDocument();
		await expect(canvas.queryByRole("button")).not.toBeInTheDocument();
	},
};

export const Denied: Story = {
	args: { status: "denied" },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(canvas.getByText(/access denied/i)).toBeInTheDocument();
	},
};

export const InvalidRequest: Story = {
	args: { status: "invalid-request" },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(
			canvas.getByText(/invalid authorization request/i),
		).toBeInTheDocument();
		await expect(canvas.queryByRole("button")).not.toBeInTheDocument();
	},
};
