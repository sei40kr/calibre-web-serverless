import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { OAuthConsentPage } from "./OAuthConsentPage";

const meta = {
	title: "Pages/OAuthConsentPage",
	component: OAuthConsentPage,
	args: {
		email: "test@example.com",
		onAllow: fn(async () => {}),
		onCancel: fn(),
		onSwitchAccount: fn(),
	},
} satisfies Meta<typeof OAuthConsentPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Allow: Story = {
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);

		await userEvent.type(canvas.getByLabelText(/name this app/i), "Study iPad");
		await userEvent.click(canvas.getByRole("button", { name: "Allow" }));

		await expect(args.onAllow).toHaveBeenCalledWith("Study iPad");
		await expect(await canvas.findByText("Access allowed")).toBeInTheDocument();
	},
};

export const RequiresName: Story = {
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);

		await userEvent.type(canvas.getByLabelText(/name this app/i), "   ");
		await userEvent.click(canvas.getByRole("button", { name: "Allow" }));

		await expect(
			await canvas.findByText("Enter a name for this app"),
		).toBeInTheDocument();
		await expect(args.onAllow).not.toHaveBeenCalled();
	},
};

export const Cancel: Story = {
	play: async ({ canvasElement, args }) => {
		await userEvent.click(
			within(canvasElement).getByRole("button", { name: "Cancel" }),
		);
		await expect(args.onCancel).toHaveBeenCalled();
	},
};
