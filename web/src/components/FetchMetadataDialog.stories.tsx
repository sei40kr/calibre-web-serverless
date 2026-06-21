import type {
	BookMetadataSearchResponse,
	BookMetadataSearchResult,
} from "@calibre-web-serverless/domain/models/bookMetadataSearch";
import { Button } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { FetchMetadataDialog } from "./FetchMetadataDialog";

const sampleResult: BookMetadataSearchResult = {
	source: "google_play_books",
	sourceName: "Google Play Books",
	id: "vol123",
	title: "The Hobbit",
	authors: ["J.R.R. Tolkien"],
	publisher: "George Allen & Unwin",
	publishedDate: "1937-09-21",
	description: "A hobbit goes on an unexpected journey.",
	languages: ["en"],
	identifiers: [{ type: "isbn13", value: "9780261103283" }],
	tags: ["Fantasy"],
	coverUrl: null,
	infoUrl: "https://play.google.com/store/books/details?id=vol123",
};

/**
 * Self-contained harness: a trigger button opens a controlled dialog so the
 * interaction tests drive it the way the edit page does.
 */
function DialogHarness({
	initialQuery = "the hobbit",
	onSearch,
	onSelect = fn(async () => {}),
}: {
	initialQuery?: string;
	onSearch: (query: string) => Promise<BookMetadataSearchResponse>;
	onSelect?: (result: BookMetadataSearchResult) => Promise<void>;
}) {
	const [open, setOpen] = useState(false);
	return (
		<>
			<Button onClick={() => setOpen(true)}>Open</Button>
			<FetchMetadataDialog
				open={open}
				onOpenChange={setOpen}
				initialQuery={initialQuery}
				onSearch={onSearch}
				onSelect={onSelect}
			/>
		</>
	);
}

const meta = {
	title: "Components/FetchMetadataDialog",
	component: DialogHarness,
} satisfies Meta<typeof DialogHarness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Results: Story = {
	args: {
		onSearch: fn(async () => ({ results: [sampleResult], errors: [] })),
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const body = within(canvasElement.ownerDocument.body);

		await userEvent.click(canvas.getByRole("button", { name: /open/i }));
		await body.findByPlaceholderText(/search by title, author/i);

		await expect(body.findByText("The Hobbit")).resolves.toBeInTheDocument();
		await expect(
			body.getByText("George Allen & Unwin · 1937"),
		).toBeInTheDocument();
	},
};

export const AutoSearchesOnOpen: Story = {
	args: {
		initialQuery: "the hobbit",
		onSearch: fn(async () => ({ results: [sampleResult], errors: [] })),
	},
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		const body = within(canvasElement.ownerDocument.body);

		await userEvent.click(canvas.getByRole("button", { name: /open/i }));

		// No explicit search click: opening the dialog searches the seeded query.
		await expect(body.findByText("The Hobbit")).resolves.toBeInTheDocument();
		await expect(args.onSearch).toHaveBeenCalledWith("the hobbit");
	},
};

export const NoResults: Story = {
	args: {
		onSearch: fn(async () => ({ results: [], errors: [] })),
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const body = within(canvasElement.ownerDocument.body);

		await userEvent.click(canvas.getByRole("button", { name: /open/i }));
		await body.findByPlaceholderText(/search by title, author/i);

		await expect(
			body.findByText(/no results found/i),
		).resolves.toBeInTheDocument();
	},
};

export const SearchFails: Story = {
	args: {
		onSearch: fn(async () => {
			throw new Error("network");
		}),
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const body = within(canvasElement.ownerDocument.body);

		await userEvent.click(canvas.getByRole("button", { name: /open/i }));
		await body.findByPlaceholderText(/search by title, author/i);

		await expect(
			body.findByText(/search failed/i),
		).resolves.toBeInTheDocument();
	},
};

export const PartialSourceError: Story = {
	args: {
		onSearch: fn(async () => ({
			results: [sampleResult],
			errors: [
				{
					source: "google_play_books",
					sourceName: "Google Play Books",
					message: "Rate limited. Please wait a moment and try again.",
				},
			],
		})),
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const body = within(canvasElement.ownerDocument.body);

		await userEvent.click(canvas.getByRole("button", { name: /open/i }));
		await body.findByPlaceholderText(/search by title, author/i);

		await expect(body.findByText("The Hobbit")).resolves.toBeInTheDocument();
		await expect(body.getByText(/rate limited/i)).toBeInTheDocument();
	},
};

export const SelectClosesDialog: Story = {
	args: {
		onSearch: fn(async () => ({ results: [sampleResult], errors: [] })),
		onSelect: fn(async () => {}),
	},
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		const body = within(canvasElement.ownerDocument.body);

		await userEvent.click(canvas.getByRole("button", { name: /open/i }));
		await body.findByPlaceholderText(/search by title, author/i);

		const useButton = await body.findByRole("button", { name: /use this/i });
		await userEvent.click(useButton);

		await expect(args.onSelect).toHaveBeenCalledWith(
			expect.objectContaining({ id: "vol123" }),
		);
		await waitFor(() =>
			expect(
				body.queryByPlaceholderText(/search by title, author/i),
			).not.toBeInTheDocument(),
		);
	},
};
