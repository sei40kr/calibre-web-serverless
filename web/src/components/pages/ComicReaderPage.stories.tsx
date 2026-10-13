import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { ComicReaderPage } from "./ComicReaderPage";

// Served from the fixtures directory (see .storybook/main.ts staticDirs).
// An 8-page US comic whose ComicInfo.xml says Manga=No (left to right).
const cbzPath = "/books/joe-louis-champion-of-champions/book.cbz";

const meta = {
	title: "Pages/ComicReaderPage",
	component: ComicReaderPage,
	parameters: {
		layout: "fullscreen",
	},
	args: {
		title: "Joe Louis, Champion of Champions #2",
		coverUrl: "/books/joe-louis-champion-of-champions/cover.jpg",
		fileUrl: cbzPath,
		fileLoading: false,
		pageNo: 1,
		onPageNoChange: fn(),
		onBack: fn(),
	},
	// Each story starts in single-page view regardless of earlier toggles.
	beforeEach: () => {
		localStorage.removeItem("comicReader.spread");
	},
} satisfies Meta<typeof ComicReaderPage>;

export default meta;
type Story = StoryObj<typeof meta>;

// Unzipping and measuring the pages takes a moment in CI browsers.
const COMIC_RENDER_TIMEOUT = { timeout: 15_000 };

export const FirstPage: Story = {
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);

		await waitFor(
			() => expect(canvas.getByText("1 / 8")).toBeInTheDocument(),
			COMIC_RENDER_TIMEOUT,
		);
		await expect(canvas.getByRole("img", { name: "Page 1" })).toBeVisible();

		// Left to right: the left arrow goes back, and there is nothing before
		// the cover.
		await expect(
			canvas.getByRole("button", { name: /previous page/i }),
		).toBeDisabled();
		await userEvent.click(canvas.getByRole("button", { name: /next page/i }));
		await expect(args.onPageNoChange).toHaveBeenCalledWith(2);
	},
};

export const TwoPageSpread: Story = {
	args: {
		pageNo: 3,
	},
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);

		const spreadButton = await waitFor(
			() => canvas.getByRole("button", { name: /two-page spread/i }),
			COMIC_RENDER_TIMEOUT,
		);
		await userEvent.click(spreadButton);

		// The cover stands alone, so page 3 faces page 2.
		await expect(canvas.getByText("2–3 / 8")).toBeInTheDocument();
		await expect(canvas.getByRole("img", { name: "Page 2" })).toBeVisible();
		await expect(canvas.getByRole("img", { name: "Page 3" })).toBeVisible();
		await expect(localStorage.getItem("comicReader.spread")).toBe("true");

		await userEvent.click(canvas.getByRole("button", { name: /next page/i }));
		await expect(args.onPageNoChange).toHaveBeenCalledWith(4);
	},
};

export const KeyboardNavigation: Story = {
	args: {
		pageNo: 2,
	},
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);

		await waitFor(
			() => expect(canvas.getByText("2 / 8")).toBeInTheDocument(),
			COMIC_RENDER_TIMEOUT,
		);

		// Left to right, the right arrow key moves forward.
		await userEvent.keyboard("{ArrowRight}");
		await expect(args.onPageNoChange).toHaveBeenCalledWith(3);
		await userEvent.keyboard("{ArrowLeft}");
		await expect(args.onPageNoChange).toHaveBeenCalledWith(1);
	},
};

export const FileLoading: Story = {
	args: {
		fileUrl: null,
		fileLoading: true,
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(canvas.getByRole("progressbar")).toBeInTheDocument();
		await expect(
			canvas.queryByRole("button", { name: /two-page spread/i }),
		).not.toBeInTheDocument();
	},
};

export const NoFile: Story = {
	args: {
		fileUrl: null,
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(canvas.getByText("No CBZ file")).toBeInTheDocument();
	},
};

export const LoadError: Story = {
	args: {
		fileUrl: "/books/joe-louis-champion-of-champions/missing.cbz",
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await waitFor(
			() =>
				expect(canvas.getByText("Couldn't open the comic")).toBeInTheDocument(),
			COMIC_RENDER_TIMEOUT,
		);
	},
};
