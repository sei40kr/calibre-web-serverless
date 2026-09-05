import { Button } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { UploadBookDialog } from "./UploadBookDialog";

/** A trigger button opens the controlled dialog, as the dashboard does. */
function DialogHarness({ onUpload }: { onUpload: (files: File[]) => void }) {
	const [open, setOpen] = useState(false);
	return (
		<>
			<Button onClick={() => setOpen(true)}>Open</Button>
			<UploadBookDialog
				open={open}
				onOpenChange={setOpen}
				onUpload={onUpload}
			/>
		</>
	);
}

const meta = {
	title: "Components/UploadBookDialog",
	component: DialogHarness,
	args: {
		onUpload: fn(),
	},
} satisfies Meta<typeof DialogHarness>;

export default meta;
type Story = StoryObj<typeof meta>;

const epub = (name: string) =>
	new File(["book"], name, { type: "application/epub+zip" });

const openDialog = async (canvasElement: HTMLElement) => {
	const canvas = within(canvasElement);
	const body = within(canvasElement.ownerDocument.body);
	await userEvent.click(canvas.getByRole("button", { name: /open/i }));
	const dialog = await body.findByRole("dialog");
	const input = dialog.querySelector<HTMLInputElement>('input[type="file"]');
	if (!input) throw new Error("file input not rendered");
	return { dialog: within(dialog), dialogElement: dialog, input, body };
};

export const RequiresAFile: Story = {
	play: async ({ canvasElement, args }) => {
		const { dialog } = await openDialog(canvasElement);

		await userEvent.click(dialog.getByRole("button", { name: /^upload$/i }));

		await expect(
			await dialog.findByText(/please select at least one file/i),
		).toBeInTheDocument();
		await expect(args.onUpload).not.toHaveBeenCalled();
	},
};

export const UploadsSeveralFilesAndCloses: Story = {
	play: async ({ canvasElement, args }) => {
		const { dialog, input, body } = await openDialog(canvasElement);

		await expect(input).toHaveAttribute("multiple");
		await userEvent.upload(input, [epub("alpha.epub"), epub("beta.epub")]);

		await expect(await dialog.findByText("alpha.epub")).toBeInTheDocument();
		await expect(dialog.getByText("beta.epub")).toBeInTheDocument();

		await userEvent.click(dialog.getByRole("button", { name: /^upload$/i }));

		await waitFor(() => expect(args.onUpload).toHaveBeenCalledTimes(1));
		const files = (args.onUpload as ReturnType<typeof fn>).mock
			.calls[0][0] as File[];
		expect(files.map((f) => f.name)).toEqual(["alpha.epub", "beta.epub"]);

		// The dialog closes right away; the upload continues elsewhere.
		await waitFor(() =>
			expect(body.queryByRole("dialog")).not.toBeInTheDocument(),
		);
	},
};

export const SkipsRejectedFiles: Story = {
	play: async ({ canvasElement }) => {
		const { dialog, input } = await openDialog(canvasElement);

		// user-event pre-filters by the input's accept attribute; disable that so
		// the component's own validation is what rejects the file.
		await userEvent.upload(
			input,
			[
				epub("good.epub"),
				new File(["x"], "notes.docx", { type: "application/msword" }),
			],
			{ applyAccept: false },
		);

		await expect(
			await dialog.findByText(/some files were skipped/i),
		).toBeInTheDocument();
		await expect(
			dialog.getByText(/notes\.docx \(unsupported format\)/i),
		).toBeInTheDocument();
		await expect(dialog.getByText("good.epub")).toBeInTheDocument();
	},
};

export const CancelResetsSelection: Story = {
	play: async ({ canvasElement, args }) => {
		const first = await openDialog(canvasElement);
		await userEvent.upload(first.input, epub("alpha.epub"));
		await expect(
			await first.dialog.findByText("alpha.epub"),
		).toBeInTheDocument();

		await userEvent.click(
			first.dialog.getByRole("button", { name: /cancel/i }),
		);
		await waitFor(() =>
			expect(first.body.queryByRole("dialog")).not.toBeInTheDocument(),
		);
		await expect(args.onUpload).not.toHaveBeenCalled();

		const second = await openDialog(canvasElement);
		await expect(
			second.dialog.queryByText("alpha.epub"),
		).not.toBeInTheDocument();
	},
};
