import type { Book } from "@calibre-web-serverless/domain/models/book";
import { unreadProgress } from "@calibre-web-serverless/domain/models/readingProgress";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { ContinueReading } from "./ContinueReading";

const baseBook: Book = {
	id: "book-001",
	userId: "user-001",
	title: "Alice's Adventures in Wonderland",
	sortTitle: null,
	authorIds: [],
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
	hasCover: true,
	hasCustomCover: false,
	status: "ready",
	errorCode: null,
	reading: unreadProgress,
	createdAt: new Date("2024-01-01"),
	updatedAt: new Date("2024-01-01"),
};

const alice: Book = {
	...baseBook,
	reading: {
		status: "reading",
		lastReadAt: new Date("2024-02-02"),
		lastFormat: "epub",
		positions: {
			epub: {
				chapterNo: 3,
				charOffset: 0,
				chapterTitle: "CHAPTER I. Down the Rabbit-Hole",
				chapterLengths: [10, 70, 920],
				activeSeconds: 0,
				unitsRead: 0,
			},
		},
	},
};

const joeLouis: Book = {
	...baseBook,
	id: "book-002",
	title: "Joe Louis, Champion of Champions #2",
	files: [{ ...baseBook.files[0], format: "cbz" }],
	reading: {
		status: "reading",
		lastReadAt: new Date("2024-02-01"),
		lastFormat: "cbz",
		positions: {
			cbz: { pageNo: 4, pageCount: 8, activeSeconds: 0, unitsRead: 0 },
		},
	},
};

const meta = {
	title: "Components/ContinueReading",
	component: ContinueReading,
	args: {
		books: [alice, joeLouis],
		bookCoverInfos: {
			"book-001": { coverUrl: "/books/alice-in-wonderland/cover.jpg" },
			"book-002": {
				coverUrl: "/books/joe-louis-champion-of-champions/cover.jpg",
			},
		},
	},
} satisfies Meta<typeof ContinueReading>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(
			canvas.getByRole("heading", { name: "Continue reading" }),
		).toBeInTheDocument();

		// Each book opens its last-read format where it was left.
		const links = canvas.getAllByRole("link");
		await expect(links[0]).toHaveAttribute(
			"href",
			"/books/book-001/pages/3?format=epub",
		);
		await expect(links[1]).toHaveAttribute(
			"href",
			"/books/book-002/pages/4?format=cbz",
		);

		// EPUBs show the chapter; comics have none.
		await expect(
			canvas.getByText("CHAPTER I. Down the Rabbit-Hole"),
		).toBeInTheDocument();
		await expect(canvas.getByText("8%")).toBeInTheDocument();
		await expect(canvas.getByText("50%")).toBeInTheDocument();
		await expect(
			canvas.getByRole("progressbar", {
				name: "Alice's Adventures in Wonderland reading progress",
			}),
		).toBeInTheDocument();
	},
};

export const Empty: Story = {
	args: { books: [] },
	play: async ({ canvasElement }) => {
		await expect(canvasElement.textContent).toBe("");
	},
};
