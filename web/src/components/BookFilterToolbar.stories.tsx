import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import type { BookFacets } from "@/lib/bookFacets";
import {
	type BookFilter,
	defaultBookSort,
	emptyBookFilter,
} from "@/lib/bookFilter";
import { BookFilterToolbar } from "./BookFilterToolbar";

const facets: BookFacets = {
	authors: [
		{ value: "a1", label: "George Orwell" },
		{ value: "a2", label: "Haruki Murakami" },
	],
	tags: [
		{ value: "t1", label: "Science Fiction" },
		{ value: "t2", label: "Fantasy" },
	],
	series: [{ value: "s1", label: "Foundation" }],
	publishers: [{ value: "p1", label: "Penguin" }],
	languages: [
		{ value: "en", label: "English" },
		{ value: "ja", label: "Japanese" },
	],
};

const meta = {
	title: "Components/BookFilterToolbar",
	component: BookFilterToolbar,
	args: {
		filter: emptyBookFilter,
		sort: defaultBookSort,
		facets,
		onFilterChange: fn(),
		onSortChange: fn(),
	},
} satisfies Meta<typeof BookFilterToolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithActiveFilters: Story = {
	args: {
		filter: {
			...emptyBookFilter,
			arrayFilter: { dimension: "authorIds", values: ["a1"] },
			seriesIds: ["s1"],
			minRating: 4,
		},
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(canvas.getByText("Author: George Orwell")).toBeInTheDocument();
		await expect(canvas.getByText("Series: Foundation")).toBeInTheDocument();
		await expect(canvas.getByText("Rating: 4+ ★")).toBeInTheDocument();
	},
};

export const RemoveChip: Story = {
	args: {
		filter: {
			...emptyBookFilter,
			arrayFilter: { dimension: "authorIds", values: ["a1"] },
		},
	},
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);

		const chipLabel = canvas.getByText("Author: George Orwell");
		const closeButton = within(
			chipLabel.parentElement as HTMLElement,
		).getByRole("button");
		await userEvent.click(closeButton);

		await expect(args.onFilterChange).toHaveBeenCalledWith(
			expect.objectContaining({ arrayFilter: null }),
		);
	},
};

export const ChangeSort: Story = {
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);

		const select = canvas.getByLabelText("Sort books");
		await userEvent.selectOptions(select, "title:asc");

		await expect(args.onSortChange).toHaveBeenCalledWith({
			key: "title",
			direction: "asc",
		});
	},
};

export const SelectFromComboboxDrawer: Story = {
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);

		await userEvent.click(canvas.getByRole("button", { name: /filters/i }));

		// The drawer is portalled, so query the whole document.
		const drawer = within(document.body);
		const input = await drawer.findByPlaceholderText("Search authors...");
		await userEvent.click(input);
		await userEvent.type(input, "Orwell");
		await userEvent.click(await drawer.findByText("George Orwell"));

		await expect(args.onFilterChange).toHaveBeenCalledWith(
			expect.objectContaining({
				arrayFilter: { dimension: "authorIds", values: ["a1"] },
			}),
		);
	},
};

// Stateful wrapper: selecting must keep the drawer open and surface the choice
// as a removable tag (regressions previously closed the drawer and hid it).
export const SelectionStaysVisible: Story = {
	render: (args) => {
		const [filter, setFilter] = useState<BookFilter>(emptyBookFilter);
		return (
			<BookFilterToolbar {...args} filter={filter} onFilterChange={setFilter} />
		);
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await userEvent.click(canvas.getByRole("button", { name: /filters/i }));

		const drawer = within(document.body);
		const input = await drawer.findByPlaceholderText("Search authors...");
		await userEvent.click(input);
		await userEvent.type(input, "Orwell");
		await userEvent.click(await drawer.findByText("George Orwell"));

		// The drawer is still open ...
		await expect(
			drawer.getByRole("button", { name: "Done" }),
		).toBeInTheDocument();
		// ... and the selection is shown as a removable tag.
		await expect(
			drawer.getByRole("button", { name: "Remove George Orwell" }),
		).toBeInTheDocument();
	},
};
