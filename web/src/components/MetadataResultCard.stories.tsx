import type { BookMetadataSearchResult } from "@calibre-web-serverless/domain/models/bookMetadataSearch";
import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { MetadataResultCard } from "./MetadataResultCard";

const baseResult: BookMetadataSearchResult = {
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
	coverUrl: "/books/alice-in-wonderland/cover.jpg",
	infoUrl: "https://play.google.com/store/books/details?id=vol123",
};

const meta = {
	title: "Components/MetadataResultCard",
	component: MetadataResultCard,
	args: {
		result: baseResult,
		selecting: false,
		disabled: false,
		onSelect: fn(),
	},
	decorators: [
		(Story) => (
			<Box maxW="md">
				<Story />
			</Box>
		),
	],
} satisfies Meta<typeof MetadataResultCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);

		await expect(canvas.getByText("The Hobbit")).toBeInTheDocument();
		await expect(canvas.getByText("J.R.R. Tolkien")).toBeInTheDocument();
		await expect(
			canvas.getByText("George Allen & Unwin · 1937"),
		).toBeInTheDocument();
		await expect(canvas.getByText("Google Play Books")).toBeInTheDocument();
		await expect(canvas.getByText("English")).toBeInTheDocument();
		await expect(
			canvas.getByRole("img", { name: "The Hobbit" }),
		).toBeInTheDocument();

		await userEvent.click(canvas.getByRole("button", { name: /use this/i }));
		await expect(args.onSelect).toHaveBeenCalledOnce();
	},
};

export const NoCover: Story = {
	args: { result: { ...baseResult, coverUrl: null } },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		// Falls back to the placeholder icon, so there is no cover image.
		await expect(canvas.queryByRole("img")).not.toBeInTheDocument();
	},
};

export const Minimal: Story = {
	args: {
		result: {
			...baseResult,
			authors: [],
			publisher: null,
			publishedDate: null,
			languages: [],
		},
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText("The Hobbit")).toBeInTheDocument();
		// Only the source badge remains (no authors / meta / language badge).
		await expect(canvas.getByText("Google Play Books")).toBeInTheDocument();
		await expect(canvas.queryByText("J.R.R. Tolkien")).not.toBeInTheDocument();
	},
};

export const UnknownLanguageCode: Story = {
	args: { result: { ...baseResult, languages: ["xx"] } },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		// Unknown ISO codes fall back to showing the raw code.
		await expect(canvas.getByText("xx")).toBeInTheDocument();
	},
};

export const Selecting: Story = {
	args: { selecting: true },
};

export const Disabled: Story = {
	args: { disabled: true },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByRole("button", { name: /use this/i }),
		).toBeDisabled();
	},
};
