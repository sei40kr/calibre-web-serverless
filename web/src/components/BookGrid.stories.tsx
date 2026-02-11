import type { Book } from "@calibre-web-serverless/domain/models/book";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { BookGrid } from "./BookGrid";

const baseBook: Book = {
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
	coverFormat: "jpg",
	status: "ready",
	errorMessage: null,
	createdAt: new Date("2024-01-01"),
	updatedAt: new Date("2024-01-01"),
};

const mockBooks: Book[] = [
	baseBook,
	{
		...baseBook,
		id: "book-002",
		title: "Rashomon",
		coverFormat: "jpg",
	},
	{
		...baseBook,
		id: "book-003",
		title: "The Metamorphosis",
		coverFormat: "jpg",
	},
	{
		...baseBook,
		id: "book-004",
		title: "I Am a Cat",
		coverFormat: "jpg",
	},
];

const mockBookCoverInfos: Record<
	string,
	{ coverUrl: string | null; loading: boolean }
> = {
	"book-001": {
		coverUrl: "/books/alice-in-wonderland/cover.jpg",
		loading: false,
	},
	"book-002": { coverUrl: "/books/rashomon/cover.jpg", loading: false },
	"book-003": {
		coverUrl: "/books/the-metamorphosis/cover.jpg",
		loading: false,
	},
	"book-004": {
		coverUrl: "/books/wagahai-wa-neko-de-aru/cover.jpg",
		loading: false,
	},
};

const meta = {
	title: "Components/BookGrid",
	component: BookGrid,
	args: {
		books: mockBooks,
		loading: false,
		bookCoverInfos: mockBookCoverInfos,
	},
} satisfies Meta<typeof BookGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(
			canvas.getByText("Alice's Adventures in Wonderland"),
		).toBeInTheDocument();
		await expect(canvas.getByText("Rashomon")).toBeInTheDocument();
		await expect(canvas.getByText("The Metamorphosis")).toBeInTheDocument();
		await expect(canvas.getByText("I Am a Cat")).toBeInTheDocument();
	},
};

export const Loading: Story = {
	args: {
		books: [],
		loading: true,
		bookCoverInfos: {},
	},
};

export const Empty: Story = {
	args: {
		books: [],
		loading: false,
		bookCoverInfos: {},
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(canvas.getByText("No books yet")).toBeInTheDocument();
		await expect(
			canvas.getByText("Upload your first book to get started"),
		).toBeInTheDocument();
	},
};

export const CoverLoading: Story = {
	args: {
		bookCoverInfos: {
			"book-001": { coverUrl: null, loading: true },
			"book-002": { coverUrl: null, loading: true },
			"book-003": { coverUrl: null, loading: true },
			"book-004": { coverUrl: null, loading: true },
		},
	},
};
