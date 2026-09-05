import type { Book } from "@calibre-web-serverless/domain/models/book";
import type { Bookshelf } from "@calibre-web-serverless/domain/models/bookshelf";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { BookshelfPage } from "./BookshelfPage";

const bookshelf: Bookshelf = {
	id: "bookshelf-001",
	name: "Favorites",
	bookCount: 2,
	createdAt: new Date("2024-01-01"),
	updatedAt: new Date("2024-01-01"),
};

const otherBookshelf: Bookshelf = {
	id: "bookshelf-002",
	name: "To Read",
	bookCount: 0,
	createdAt: new Date("2024-01-02"),
	updatedAt: new Date("2024-01-02"),
};

const baseBook: Book = {
	id: "book-001",
	userId: "user-001",
	title: "Alice's Adventures in Wonderland",
	sortTitle: null,
	authorIds: [],
	seriesId: null,
	seriesIndex: 1,
	tagIds: [],
	bookshelfIds: [bookshelf.id],
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
	hasCover: true,
	hasCustomCover: false,
	status: "ready",
	errorCode: null,
	createdAt: new Date("2024-01-01"),
	updatedAt: new Date("2024-01-01"),
};

const books: Book[] = [
	baseBook,
	{ ...baseBook, id: "book-002", title: "I Am a Cat" },
];

const meta = {
	title: "Pages/BookshelfPage",
	component: BookshelfPage,
	parameters: { layout: "fullscreen" },
	args: {
		bookshelf,
		books,
		loading: false,
		bookCoverInfos: {
			"book-001": {
				coverUrl: "/books/alice-in-wonderland/cover.jpg",
				loading: false,
			},
			"book-002": {
				coverUrl: "/books/wagahai-wa-neko-de-aru/cover.jpg",
				loading: false,
			},
		},
		bookshelves: [bookshelf, otherBookshelf],
		sort: { key: "createdAt", direction: "desc" },
		onSortChange: fn(),
		onRemoveBook: fn(async () => {}),
		onToggleBookshelf: fn(async () => {}),
		onSignOut: fn(),
	},
} satisfies Meta<typeof BookshelfPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);

		await expect(
			canvas.getByRole("heading", { name: "Favorites" }),
		).toBeInTheDocument();
		await expect(canvas.getByText("2 books")).toBeInTheDocument();
		await expect(canvas.getByText("I Am a Cat")).toBeInTheDocument();

		// Bookshelf views take books off the bookshelf rather than deleting them.
		await expect(
			canvas.queryByRole("button", { name: /delete book/i }),
		).not.toBeInTheDocument();
		const removeButtons = canvas.getAllByRole("button", {
			name: /remove from bookshelf/i,
		});
		await expect(removeButtons).toHaveLength(2);

		await userEvent.click(removeButtons[1]);
		await expect(args.onRemoveBook).toHaveBeenCalledWith(books[1]);
	},
};

export const Empty: Story = {
	args: {
		bookshelf: { ...bookshelf, bookCount: 0 },
		books: [],
		bookCoverInfos: {},
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(canvas.getByText("0 books")).toBeInTheDocument();
		await expect(
			canvas.getByText("This bookshelf is empty"),
		).toBeInTheDocument();
		// Sorting is pointless with nothing to sort.
		await expect(
			canvas.queryByRole("combobox", { name: /sort books/i }),
		).not.toBeInTheDocument();
	},
};

export const Loading: Story = {
	args: { books: [], loading: true, bookCoverInfos: {} },
};
