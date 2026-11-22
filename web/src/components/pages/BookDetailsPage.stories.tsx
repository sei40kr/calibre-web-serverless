import type { Book } from "@calibre-web-serverless/domain/models/book";
import { ISBN13 } from "@calibre-web-serverless/domain/models/identifier";
import { Language } from "@calibre-web-serverless/domain/models/language";
import { unreadProgress } from "@calibre-web-serverless/domain/models/readingProgress";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { BookDetailsPage } from "./BookDetailsPage";

const date = new Date("2024-01-01");

const book: Book = {
	id: "book-001",
	userId: "user-001",
	title: "Alice's Adventures in Wonderland",
	sortTitle: null,
	authorIds: ["author-001"],
	seriesId: null,
	seriesIndex: 1,
	tagIds: ["tag-001"],
	bookshelfIds: ["bookshelf-001"],
	publisherId: "publisher-001",
	pubDate: new Date("1865-11-26"),
	identifiers: [{ type: ISBN13, value: "9780141439761" }],
	languages: [Language.EN],
	description:
		"A young girl named Alice falls through a rabbit hole into a subterranean fantasy world populated by peculiar creatures.",
	rating: 5,
	files: [
		{
			format: "epub",
			fileSize: 187000,
			status: "ready",
			errorCode: null,
			addedAt: date,
		},
		{
			format: "pdf",
			fileSize: 664000,
			status: "ready",
			errorCode: null,
			addedAt: date,
		},
	],
	hasCover: true,
	hasCustomCover: false,
	status: "ready",
	errorCode: null,
	reading: {
		status: "reading",
		lastReadAt: new Date(Date.now() - 86_400_000),
		lastFormat: "epub",
		positions: {
			epub: {
				chapterNo: 3,
				charOffset: 0,
				chapterTitle: "CHAPTER I. Down the Rabbit-Hole",
				chapterLengths: [100, 100, 9800],
				activeSeconds: 0,
				unitsRead: 0,
			},
		},
	},
	createdAt: date,
	updatedAt: date,
};

const meta = {
	title: "Pages/BookDetailsPage",
	component: BookDetailsPage,
	parameters: { layout: "fullscreen" },
	args: {
		book,
		authors: [
			{
				id: "author-001",
				name: "Lewis Carroll",
				sortName: null,
				createdAt: date,
				updatedAt: date,
			},
		],
		series: null,
		tags: [
			{ id: "tag-001", name: "Fantasy", createdAt: date, updatedAt: date },
		],
		publisher: {
			id: "publisher-001",
			name: "Macmillan",
			createdAt: date,
			updatedAt: date,
		},
		bookshelves: [
			{
				id: "bookshelf-001",
				name: "Favorites",
				bookCount: 1,
				createdAt: date,
				updatedAt: date,
			},
		],
		coverUrl: "/books/alice-in-wonderland/cover.jpg",
		coverLoading: false,
		onDownload: fn(async () => {}),
		onDelete: fn(async () => {}),
		onToggleBookshelf: fn(async () => {}),
		onMarkRead: fn(),
		onMarkUnread: fn(),
	},
} satisfies Meta<typeof BookDetailsPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		const body = within(canvasElement.ownerDocument.body);

		await expect(
			canvas.getByRole("heading", { name: book.title }),
		).toBeInTheDocument();
		await expect(
			canvas.getByRole("link", { name: "Lewis Carroll" }),
		).toHaveAttribute("href", "/dashboard?authors=author-001");
		await expect(
			canvas.getByRole("link", { name: "Macmillan" }),
		).toHaveAttribute("href", "/dashboard?publishers=publisher-001");
		await expect(
			canvas.getByRole("link", { name: "Favorites" }),
		).toHaveAttribute("href", "/dashboard/bookshelves/bookshelf-001");
		await expect(
			canvas.getByText("CHAPTER I. Down the Rabbit-Hole"),
		).toBeInTheDocument();
		await expect(canvas.getByText("2%")).toBeInTheDocument();
		await expect(canvas.getByText("187 kB")).toBeInTheDocument();

		// Continue reading resumes in the format read last.
		await expect(
			canvas.getByRole("link", { name: /continue reading/i }),
		).toHaveAttribute("href", "/books/book-001/pages/3?format=epub");

		// Other formats are offered in a chooser.
		await userEvent.click(
			canvas.getByRole("button", { name: /read in another format/i }),
		);
		const dialog = await body.findByRole("dialog");
		await expect(
			within(dialog).getByRole("link", { name: "PDF" }),
		).toHaveAttribute("href", "/books/book-001/pages/1?format=pdf");
		await userEvent.keyboard("{Escape}");

		await userEvent.click(canvas.getByRole("button", { name: "Download PDF" }));
		await expect(args.onDownload).toHaveBeenCalledWith("pdf");
	},
};

export const Unread: Story = {
	args: {
		book: {
			...book,
			reading: unreadProgress,
			files: [book.files[0]],
			description: null,
			rating: null,
			identifiers: [],
		},
		tags: [],
		publisher: null,
		bookshelves: [],
		coverUrl: null,
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(canvas.getByText("Not started")).toBeInTheDocument();
		await expect(canvas.getByRole("link", { name: /^read$/i })).toHaveAttribute(
			"href",
			"/books/book-001/pages/1?format=epub",
		);
		await expect(
			canvas.queryByRole("button", { name: /read in another format/i }),
		).not.toBeInTheDocument();
		await expect(canvas.queryByText("Description")).not.toBeInTheDocument();
	},
};
