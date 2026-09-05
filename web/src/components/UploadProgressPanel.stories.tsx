import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import type { BookUpload } from "@/lib/bookUpload";
import { UploadProgressPanel } from "./UploadProgressPanel";

const upload = (
	overrides: Partial<BookUpload> & { id: string },
): BookUpload => ({
	fileName: `${overrides.id}.epub`,
	fileSize: 1_000_000,
	bytesTransferred: 0,
	status: "queued",
	bookId: null,
	title: null,
	failure: null,
	...overrides,
});

const mixedUploads: BookUpload[] = [
	upload({
		id: "hobbit",
		fileName: "the-hobbit.epub",
		status: "ready",
		bytesTransferred: 1_000_000,
		bookId: "book-1",
		title: "The Hobbit",
	}),
	upload({
		id: "dune",
		fileName: "dune.pdf",
		status: "uploading",
		bytesTransferred: 450_000,
	}),
	upload({
		id: "neuromancer",
		fileName: "neuromancer.mobi",
		status: "processing",
		bytesTransferred: 1_000_000,
		bookId: "book-3",
	}),
	upload({
		id: "broken",
		fileName: "broken.epub",
		status: "error",
		failure: { kind: "storage", code: "stalled" },
	}),
	upload({ id: "queued", fileName: "foundation.epub" }),
];

const finishedUploads: BookUpload[] = [
	mixedUploads[0],
	upload({
		id: "emma",
		fileName: "emma.epub",
		status: "ready",
		bytesTransferred: 1_000_000,
		bookId: "book-2",
		title: "Emma",
	}),
];

/** Owns the collapsed flag the way the app-level context does. */
function PanelHarness({
	uploads,
	onDismiss,
	onClose,
}: {
	uploads: BookUpload[];
	onDismiss: (id: string) => void;
	onClose: () => void;
}) {
	const [collapsed, setCollapsed] = useState(false);
	return (
		<UploadProgressPanel
			uploads={uploads}
			collapsed={collapsed}
			onCollapsedChange={setCollapsed}
			onDismiss={onDismiss}
			onClose={onClose}
		/>
	);
}

const meta = {
	title: "Components/UploadProgressPanel",
	component: PanelHarness,
	args: {
		uploads: mixedUploads,
		onDismiss: fn(),
		onClose: fn(),
	},
} satisfies Meta<typeof PanelHarness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const InProgress: Story = {
	play: async ({ canvasElement }) => {
		const panel = within(
			within(canvasElement).getByRole("region", { name: /upload progress/i }),
		);

		await expect(
			panel.getByText("Uploading 5 books (2 of 5 done)"),
		).toBeInTheDocument();
		await expect(panel.getByText('Added "The Hobbit"')).toBeInTheDocument();
		await expect(panel.getByText("Uploading 45%")).toBeInTheDocument();
		await expect(panel.getByText(/processing metadata/i)).toBeInTheDocument();
		await expect(panel.getByText(/upload stalled/i)).toBeInTheDocument();
		await expect(panel.getByText(/waiting/i)).toBeInTheDocument();

		// Nothing can be closed while uploads are still in flight.
		await expect(
			panel.queryByRole("button", { name: /^close$/i }),
		).not.toBeInTheDocument();
	},
};

export const CollapseAndExpand: Story = {
	play: async ({ canvasElement }) => {
		const panel = within(
			within(canvasElement).getByRole("region", { name: /upload progress/i }),
		);

		await userEvent.click(panel.getByRole("button", { name: /collapse/i }));
		// The content hides once the collapse animation finishes.
		await waitFor(() => expect(panel.getByText("dune.pdf")).not.toBeVisible());
		// The summary stays visible in the header.
		await expect(
			panel.getByText("Uploading 5 books (2 of 5 done)"),
		).toBeVisible();

		await userEvent.click(panel.getByRole("button", { name: /expand/i }));
		await waitFor(() => expect(panel.getByText("dune.pdf")).toBeVisible());
	},
};

export const DismissFinished: Story = {
	play: async ({ canvasElement, args }) => {
		const panel = within(
			within(canvasElement).getByRole("region", { name: /upload progress/i }),
		);

		// Only finished items expose a dismiss control.
		await expect(
			panel.queryByRole("button", { name: /dismiss dune\.pdf/i }),
		).not.toBeInTheDocument();

		await userEvent.click(
			panel.getByRole("button", { name: /dismiss the-hobbit\.epub/i }),
		);
		await expect(args.onDismiss).toHaveBeenCalledWith("hobbit");
	},
};

export const AllFinished: Story = {
	args: { uploads: finishedUploads },
	play: async ({ canvasElement, args }) => {
		const panel = within(
			within(canvasElement).getByRole("region", { name: /upload progress/i }),
		);

		await expect(panel.getByText("2 books uploaded")).toBeInTheDocument();
		await userEvent.click(panel.getByRole("button", { name: /^close$/i }));
		await expect(args.onClose).toHaveBeenCalled();
	},
};

export const WithFailures: Story = {
	args: {
		uploads: [
			finishedUploads[0],
			upload({
				id: "bad",
				fileName: "bad.txt",
				status: "error",
				failure: { kind: "processing", code: "extraction-failed" },
			}),
		],
	},
	play: async ({ canvasElement }) => {
		const panel = within(
			within(canvasElement).getByRole("region", { name: /upload progress/i }),
		);
		await expect(panel.getByText("1 upload failed")).toBeInTheDocument();
		await expect(
			panel.getByText(/failed to process the book file/i),
		).toBeInTheDocument();
	},
};

export const Empty: Story = {
	args: { uploads: [] },
	play: async ({ canvasElement }) => {
		await expect(
			within(canvasElement).queryByRole("region"),
		).not.toBeInTheDocument();
	},
};
