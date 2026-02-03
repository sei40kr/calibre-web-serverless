import type { Book } from "@calibre-web-serverless/domain/models/book";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { BookCard } from "./BookCard";

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
	createdAt: new Date("2024-01-01"),
	updatedAt: new Date("2024-01-01"),
};

const meta = {
	title: "Components/BookCard",
	component: BookCard,
	parameters: {
		layout: "centered",
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
	args: {
		book: mockBook,
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(
			canvas.getByText("Alice's Adventures in Wonderland"),
		).toBeInTheDocument();
		await expect(canvas.getByText("EPUB")).toBeInTheDocument();
	},
};

export const LongTitle: Story = {
	args: {
		book: {
			...mockBook,
			title:
				"The Complete Works of William Shakespeare Including All His Plays and Sonnets",
		},
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		const titleElement = canvas.getByText(
			"The Complete Works of William Shakespeare Including All His Plays and Sonnets",
		);
		await expect(titleElement).toBeInTheDocument();
	},
};

export const PdfFormat: Story = {
	args: {
		book: {
			...mockBook,
			format: "pdf",
		},
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
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(canvas.getByText("MOBI")).toBeInTheDocument();
	},
};
