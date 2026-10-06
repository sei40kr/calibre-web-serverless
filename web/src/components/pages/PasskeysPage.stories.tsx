import type { Passkey } from "@calibre-web-serverless/domain/models/passkey";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { PasskeysPage } from "./PasskeysPage";

const passkeys: Passkey[] = [
	{
		id: "cred-1",
		name: "MacBook Touch ID",
		backedUp: true,
		createdAt: new Date("2026-01-10T09:00:00Z"),
		lastUsedAt: new Date("2026-03-02T21:15:00Z"),
	},
	{
		id: "cred-2",
		name: "YubiKey",
		backedUp: false,
		createdAt: new Date("2026-02-01T12:00:00Z"),
		lastUsedAt: null,
	},
];

const meta = {
	title: "Pages/PasskeysPage",
	component: PasskeysPage,
	parameters: {
		layout: "fullscreen",
	},
	args: {
		passkeys,
		loading: false,
		loadError: false,
		supported: true,
		onAdd: fn(async () => {}),
		onDelete: fn(async () => {}),
		onBack: fn(),
	},
} satisfies Meta<typeof PasskeysPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const list = canvas.getByRole("list", { name: /passkeys/i });

		await expect(within(list).getAllByRole("listitem")).toHaveLength(2);
		await expect(within(list).getByText("MacBook Touch ID")).toBeVisible();
		await expect(within(list).getByText(/synced/i)).toBeVisible();
		await expect(within(list).getByText(/never used/i)).toBeVisible();
	},
};

export const AddPasskey: Story = {
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		const input = canvas.getByRole("textbox", { name: /name/i });

		await userEvent.type(input, "Pixel");
		await userEvent.click(canvas.getByRole("button", { name: /add passkey/i }));

		await expect(args.onAdd).toHaveBeenCalledWith("Pixel");
		await expect(input).toHaveValue("");
	},
};

export const AddPasskeyFailure: Story = {
	args: {
		onAdd: fn(async () => {
			throw new Error("cancelled");
		}),
	},
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		const input = canvas.getByRole("textbox", { name: /name/i });

		await userEvent.type(input, "Pixel");
		await userEvent.click(canvas.getByRole("button", { name: /add passkey/i }));

		await expect(args.onAdd).toHaveBeenCalled();
		// The name survives so the user can simply try again.
		await expect(input).toHaveValue("Pixel");
	},
};

export const DeletePasskey: Story = {
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		const body = within(canvasElement.ownerDocument.body);

		await userEvent.click(
			canvas.getByRole("button", { name: /delete yubikey/i }),
		);
		const dialog = await body.findByRole("alertdialog");
		await userEvent.click(
			within(dialog).getByRole("button", { name: /^delete$/i }),
		);

		await expect(args.onDelete).toHaveBeenCalledWith(passkeys[1]);
	},
};

export const CancelDelete: Story = {
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		const body = within(canvasElement.ownerDocument.body);

		await userEvent.click(
			canvas.getByRole("button", { name: /delete yubikey/i }),
		);
		const dialog = await body.findByRole("alertdialog");
		await userEvent.click(
			within(dialog).getByRole("button", { name: /cancel/i }),
		);

		await expect(args.onDelete).not.toHaveBeenCalled();
	},
};

export const Empty: Story = {
	args: { passkeys: [] },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(canvas.getByText(/no passkeys yet/i)).toBeVisible();
	},
};

export const Loading: Story = {
	args: { passkeys: [], loading: true },
};

export const LoadError: Story = {
	args: { passkeys: [], loadError: true },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(
			canvas.getByText(/failed to load your passkeys/i),
		).toBeVisible();
	},
};

export const Unsupported: Story = {
	args: { supported: false },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(canvas.getByText(/does not support passkeys/i)).toBeVisible();
		await expect(
			canvas.queryByRole("button", { name: /add passkey/i }),
		).not.toBeInTheDocument();
	},
};

export const BackButton: Story = {
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);

		await userEvent.click(canvas.getByRole("button", { name: /back/i }));

		await expect(args.onBack).toHaveBeenCalled();
	},
};
