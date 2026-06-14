import type { Book } from "@calibre-web-serverless/domain/models/book";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { BookCard } from "./BookCard";

const coverPath = "/books/alice-in-wonderland/cover.jpg";

const mockBook: Book = {
	id: "book-001",
	userId: "user-001",
	title: "Alice's Adventures in Wonderland",
	sortTitle: null,
	authorIds: ["author-001"],
	seriesId: null,
	seriesIndex: 1,
	tagIds: [],
	publisherId: null,
	pubDate: null,
	identifiers: [],
	languages: [],
	description: null,
	rating: null,
	format: "epub",
	fileSize: 189000,
	coverFormat: null,
	status: "ready",
	errorMessage: null,
	createdAt: new Date("2024-01-01"),
	updatedAt: new Date("2024-01-01"),
};

const meta = {
	title: "Components/BookCard",
	component: BookCard,
	parameters: {
		layout: "centered",
	},
	args: {
		book: mockBook,
		coverUrl: coverPath,
		coverLoading: false,
		onDelete: fn(async () => {}),
	},
	decorators: [
		(Story) => (
			<div style={{ width: "180px" }}>
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof BookCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(
			canvas.getByText("Alice's Adventures in Wonderland"),
		).toBeInTheDocument();
		await expect(canvas.getByText("EPUB")).toBeInTheDocument();
		await expect(
			canvas.getByRole("img", { name: "Alice's Adventures in Wonderland" }),
		).toBeInTheDocument();
	},
};

export const CoverLoading: Story = {
	args: {
		coverUrl: null,
		coverLoading: true,
	},
};

export const Processing: Story = {
	args: {
		book: {
			...mockBook,
			status: "processing",
		},
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(canvas.getByText("Processing...")).toBeInTheDocument();
		await expect(
			canvas.queryByRole("link", { name: /edit book/i }),
		).not.toBeInTheDocument();
	},
};

export const ErrorState: Story = {
	args: {
		book: {
			...mockBook,
			status: "error",
			errorMessage: "Failed to process book",
		},
	},
};

export const LongTitle: Story = {
	args: {
		book: {
			...mockBook,
			title:
				"The Complete Works of William Shakespeare Including All His Plays and Sonnets",
		},
		coverUrl: coverPath,
		coverLoading: false,
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		const titleElement = canvas.getByText(
			"The Complete Works of William Shakespeare Including All His Plays and Sonnets",
		);
		await expect(titleElement).toBeInTheDocument();
	},
};

export const DeleteConfirmed: Story = {
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		const body = within(canvasElement.ownerDocument.body);

		await userEvent.click(canvas.getByRole("button", { name: /delete book/i }));

		const dialog = await body.findByRole("alertdialog");
		await userEvent.click(
			within(dialog).getByRole("button", { name: /^delete$/i }),
		);

		await expect(args.onDelete).toHaveBeenCalled();
	},
};

export const DeleteCancelled: Story = {
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		const body = within(canvasElement.ownerDocument.body);

		await userEvent.click(canvas.getByRole("button", { name: /delete book/i }));

		const dialog = await body.findByRole("alertdialog");
		await userEvent.click(
			within(dialog).getByRole("button", { name: /cancel/i }),
		);

		await expect(args.onDelete).not.toHaveBeenCalled();
	},
};

export const PdfFormat: Story = {
	args: {
		book: {
			...mockBook,
			format: "pdf",
		},
		coverUrl: coverPath,
		coverLoading: false,
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(canvas.getByText("PDF")).toBeInTheDocument();
	},
};

export const MobiFormat: Story = {
	args: {
		book: {
			...mockBook,
			format: "mobi",
		},
		coverUrl: coverPath,
		coverLoading: false,
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(canvas.getByText("MOBI")).toBeInTheDocument();
	},
};
