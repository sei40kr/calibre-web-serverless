import type { Book } from "@calibre-web-serverless/domain/models/book";
import type { Bookshelf } from "@calibre-web-serverless/domain/models/bookshelf";
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
	bookshelfIds: [],
	publisherId: null,
	pubDate: null,
	identifiers: [],
	languages: [],
	description: null,
	rating: null,
	files: [
		{
			format: "epub",
			fileSize: 189000,
			status: "ready",
			errorCode: null,
			addedAt: new Date("2024-01-01"),
		},
	],
	hasCover: false,
	hasCustomCover: false,
	status: "ready",
	errorCode: null,
	createdAt: new Date("2024-01-01"),
	updatedAt: new Date("2024-01-01"),
};

const bookshelves: Bookshelf[] = [
	{
		id: "bookshelf-001",
		name: "Favorites",
		bookCount: 1,
		createdAt: new Date("2024-01-01"),
		updatedAt: new Date("2024-01-01"),
	},
	{
		id: "bookshelf-002",
		name: "To Read",
		bookCount: 0,
		createdAt: new Date("2024-01-02"),
		updatedAt: new Date("2024-01-02"),
	},
];

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
			errorCode: "extraction-failed",
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
			files: [
				{
					format: "pdf",
					fileSize: 189000,
					status: "ready",
					errorCode: null,
					addedAt: new Date("2024-01-01"),
				},
			],
		},
		coverUrl: coverPath,
		coverLoading: false,
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(canvas.getByText("PDF")).toBeInTheDocument();
	},
};

export const MultipleFormats: Story = {
	args: {
		book: {
			...mockBook,
			files: [
				{
					format: "epub",
					fileSize: 189000,
					status: "ready",
					errorCode: null,
					addedAt: new Date("2024-01-01"),
				},
				{
					format: "pdf",
					fileSize: 240000,
					status: "ready",
					errorCode: null,
					addedAt: new Date("2024-01-02"),
				},
				{
					// Still uploading/processing: not shown as a badge yet.
					format: "mobi",
					fileSize: 120000,
					status: "processing",
					errorCode: null,
					addedAt: new Date("2024-01-03"),
				},
			],
		},
		coverUrl: coverPath,
		coverLoading: false,
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(canvas.getByText("EPUB")).toBeInTheDocument();
		await expect(canvas.getByText("PDF")).toBeInTheDocument();
		await expect(canvas.queryByText("MOBI")).not.toBeInTheDocument();
	},
};

export const AddToBookshelf: Story = {
	args: {
		book: { ...mockBook, bookshelfIds: ["bookshelf-001"] },
		bookshelves,
		onToggleBookshelf: fn(async () => {}),
	},
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		const body = within(canvasElement.ownerDocument.body);

		await userEvent.click(
			canvas.getByRole("button", { name: /add to bookshelf/i }),
		);

		// Membership is reflected as checked items.
		const favorites = await body.findByRole("menuitemcheckbox", {
			name: /favorites/i,
		});
		await expect(favorites).toHaveAttribute("aria-checked", "true");
		const toRead = body.getByRole("menuitemcheckbox", { name: /to read/i });
		await expect(toRead).toHaveAttribute("aria-checked", "false");

		await userEvent.click(toRead);
		await expect(args.onToggleBookshelf).toHaveBeenCalledWith(
			bookshelves[1],
			true,
		);

		await userEvent.click(favorites);
		await expect(args.onToggleBookshelf).toHaveBeenCalledWith(
			bookshelves[0],
			false,
		);
	},
};

export const NoBookshelvesYet: Story = {
	args: {
		bookshelves: [],
		onToggleBookshelf: fn(async () => {}),
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const body = within(canvasElement.ownerDocument.body);

		await userEvent.click(
			canvas.getByRole("button", { name: /add to bookshelf/i }),
		);

		await expect(
			await body.findByText("No bookshelves yet"),
		).toBeInTheDocument();
	},
};

export const OnBookshelf: Story = {
	args: {
		onDelete: undefined,
		onRemoveFromBookshelf: fn(async () => {}),
	},
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);

		await expect(
			canvas.queryByRole("button", { name: /delete book/i }),
		).not.toBeInTheDocument();

		await userEvent.click(
			canvas.getByRole("button", { name: /remove from bookshelf/i }),
		);
		await expect(args.onRemoveFromBookshelf).toHaveBeenCalled();
	},
};
