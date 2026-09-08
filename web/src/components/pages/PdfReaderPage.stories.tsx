import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { PdfReaderPage } from "./PdfReaderPage";

// Served from the fixtures directory (see .storybook/main.ts staticDirs).
const pdfPath = "/books/alice-in-wonderland/book.pdf";

const meta = {
	title: "Pages/PdfReaderPage",
	component: PdfReaderPage,
	parameters: {
		layout: "fullscreen",
	},
	args: {
		title: "Alice's Adventures in Wonderland",
		coverUrl: "/books/alice-in-wonderland/cover.jpg",
		fileUrl: pdfPath,
		fileLoading: false,
		pageNo: 1,
		onPageNoChange: fn(),
		onBack: fn(),
	},
} satisfies Meta<typeof PdfReaderPage>;

export default meta;
type Story = StoryObj<typeof meta>;

// Rendering a real PDF takes a moment in CI browsers.
const PDF_RENDER_TIMEOUT = { timeout: 15_000 };

export const FirstPage: Story = {
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);

		// The page counter appears once pdf.js has parsed the document.
		await waitFor(
			() => expect(canvas.getByText(/^1 \/ \d+$/)).toBeInTheDocument(),
			PDF_RENDER_TIMEOUT,
		);

		await expect(
			canvas.getByRole("button", { name: /previous page/i }),
		).toBeDisabled();

		await userEvent.click(canvas.getByRole("button", { name: /next page/i }));
		await expect(args.onPageNoChange).toHaveBeenCalledWith(2);

		await userEvent.click(
			canvas.getByRole("button", { name: /back to library/i }),
		);
		await expect(args.onBack).toHaveBeenCalled();
	},
};

export const KeyboardNavigation: Story = {
	args: {
		pageNo: 2,
	},
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);

		await waitFor(
			() => expect(canvas.getByText(/^2 \/ \d+$/)).toBeInTheDocument(),
			PDF_RENDER_TIMEOUT,
		);

		await userEvent.keyboard("{ArrowRight}");
		await expect(args.onPageNoChange).toHaveBeenCalledWith(3);

		await userEvent.keyboard("{ArrowLeft}");
		await expect(args.onPageNoChange).toHaveBeenCalledWith(1);
	},
};

export const FileLoading: Story = {
	args: {
		fileUrl: null,
		fileLoading: true,
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		// The cover stands in while the PDF loads, with a progress bar and
		// no page-turn controls — there is nothing to page through yet.
		await expect(
			canvasElement.querySelector("img[src$='cover.jpg']"),
		).toBeInTheDocument();
		await expect(canvas.getByText("Loading…")).toBeInTheDocument();
		await expect(canvas.getByRole("progressbar")).toBeInTheDocument();
		await expect(
			canvas.queryByRole("button", { name: /next page/i }),
		).not.toBeInTheDocument();
	},
};

export const NoReadableFile: Story = {
	args: {
		fileUrl: null,
		fileLoading: false,
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(canvas.getByText("No readable file")).toBeInTheDocument();
	},
};

export const LoadError: Story = {
	args: {
		fileUrl: "/books/alice-in-wonderland/missing.pdf",
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await waitFor(
			() =>
				expect(canvas.getByText("Couldn't open the PDF")).toBeInTheDocument(),
			PDF_RENDER_TIMEOUT,
		);
	},
};
