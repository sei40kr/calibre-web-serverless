import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { EpubReaderPage } from "./EpubReaderPage";

// Served from the fixtures directory (see .storybook/main.ts staticDirs).
// Default: a horizontal-writing English EPUB (15 spine chapters; the first
// is a single-page SVG cover).
const aliceEpubPath = "/books/alice-in-wonderland/book.epub";
// Horizontal-writing Japanese EPUB (5 chapters).
const wagahaiEpubPath = "/books/wagahai-wa-neko-de-aru/book.epub";
// Vertical-writing Japanese EPUB (3 chapters; single-page title page) whose
// spine declares page-progression-direction="rtl".
const rashomonEpubPath = "/books/rashomon/book.epub";

const meta = {
	title: "Pages/EpubReaderPage",
	component: EpubReaderPage,
	parameters: {
		layout: "fullscreen",
	},
	args: {
		title: "Alice's Adventures in Wonderland",
		coverUrl: "/books/alice-in-wonderland/cover.jpg",
		fileUrl: aliceEpubPath,
		fileLoading: false,
		chapterNo: 1,
		onChapterNoChange: fn(),
		onBack: fn(),
	},
} satisfies Meta<typeof EpubReaderPage>;

export default meta;
type Story = StoryObj<typeof meta>;

// Parsing the EPUB and laying out a chapter takes a moment in CI browsers.
const EPUB_RENDER_TIMEOUT = { timeout: 15_000 };

function chapterBody(canvasElement: HTMLElement) {
	return canvasElement.querySelector("iframe")?.contentDocument?.body ?? null;
}

export const FirstChapter: Story = {
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);

		// The counter appears once the chapter has been paginated. The cover
		// page fits on a single page.
		await waitFor(
			() =>
				expect(canvas.getByText(/^1 \/ 15 · p\. 1 \/ 1$/)).toBeInTheDocument(),
			EPUB_RENDER_TIMEOUT,
		);

		await expect(
			canvas.getByRole("button", { name: /previous page/i }),
		).toBeDisabled();

		const body = chapterBody(canvasElement);
		await expect(body).toBeTruthy();
		await expect(body && getComputedStyle(body).writingMode).toBe(
			"horizontal-tb",
		);

		// Turning past the single-page cover moves to the next chapter.
		await userEvent.click(canvas.getByRole("button", { name: /next page/i }));
		await expect(args.onChapterNoChange).toHaveBeenCalledWith(2);

		await userEvent.click(
			canvas.getByRole("button", { name: /back to library/i }),
		);
		await expect(args.onBack).toHaveBeenCalled();
	},
};

export const KeyboardNavigation: Story = {
	args: {
		chapterNo: 3,
	},
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);

		await waitFor(
			() =>
				expect(
					canvas.getByText(/^3 \/ 15 · p\. 1 \/ \d+$/),
				).toBeInTheDocument(),
			EPUB_RENDER_TIMEOUT,
		);

		// The right arrow turns forward, within the chapter.
		await userEvent.keyboard("{ArrowRight}");
		await expect(
			canvas.getByText(/^3 \/ 15 · p\. 2 \/ \d+$/),
		).toBeInTheDocument();
		await expect(args.onChapterNoChange).not.toHaveBeenCalled();

		// The left arrow turns back; past the first page it changes chapter.
		await userEvent.keyboard("{ArrowLeft}");
		await expect(
			canvas.getByText(/^3 \/ 15 · p\. 1 \/ \d+$/),
		).toBeInTheDocument();
		await userEvent.keyboard("{ArrowLeft}");
		await expect(args.onChapterNoChange).toHaveBeenCalledWith(2);
	},
};

export const HorizontalJapaneseBook: Story = {
	args: {
		title: "吾輩は猫である",
		coverUrl: "/books/wagahai-wa-neko-de-aru/cover.jpg",
		fileUrl: wagahaiEpubPath,
		chapterNo: 4,
	},
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);

		await waitFor(
			() =>
				expect(canvas.getByText(/^4 \/ 5 · p\. 1 \/ \d+$/)).toBeInTheDocument(),
			EPUB_RENDER_TIMEOUT,
		);

		const body = chapterBody(canvasElement);
		await expect(body && getComputedStyle(body).writingMode).toBe(
			"horizontal-tb",
		);

		// Japanese but horizontal: the arrows keep their ltr meaning.
		await userEvent.keyboard("{ArrowRight}");
		await expect(
			canvas.getByText(/^4 \/ 5 · p\. 2 \/ \d+$/),
		).toBeInTheDocument();
		await expect(args.onChapterNoChange).not.toHaveBeenCalled();
	},
};

export const VerticalJapaneseBook: Story = {
	args: {
		title: "羅生門",
		coverUrl: "/books/rashomon/cover.jpg",
		fileUrl: rashomonEpubPath,
	},
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);

		await waitFor(
			() =>
				expect(canvas.getByText(/^1 \/ 3 · p\. 1 \/ 1$/)).toBeInTheDocument(),
			EPUB_RENDER_TIMEOUT,
		);

		// The chapter is rendered with the book's own vertical writing mode.
		const body = chapterBody(canvasElement);
		await expect(body).toBeTruthy();
		await expect(body && getComputedStyle(body).writingMode).toBe(
			"vertical-rl",
		);

		// The book reads right-to-left, so the next page is to the left: the
		// chevron buttons swap sides compared to an ltr book.
		await expect(
			canvas.getByRole("button", { name: /previous page/i }),
		).toBeDisabled();
		await userEvent.click(canvas.getByRole("button", { name: /next page/i }));
		await expect(args.onChapterNoChange).toHaveBeenCalledWith(2);
	},
};

export const VerticalJapaneseBookKeyboardNavigation: Story = {
	args: {
		title: "羅生門",
		coverUrl: "/books/rashomon/cover.jpg",
		fileUrl: rashomonEpubPath,
		chapterNo: 2,
	},
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);

		await waitFor(
			() =>
				expect(canvas.getByText(/^2 \/ 3 · p\. 1 \/ \d+$/)).toBeInTheDocument(),
			EPUB_RENDER_TIMEOUT,
		);

		// rtl book: the left arrow turns forward, within the chapter.
		await userEvent.keyboard("{ArrowLeft}");
		await expect(
			canvas.getByText(/^2 \/ 3 · p\. 2 \/ \d+$/),
		).toBeInTheDocument();
		await expect(args.onChapterNoChange).not.toHaveBeenCalled();

		// The right arrow turns back; past the first page it changes chapter.
		await userEvent.keyboard("{ArrowRight}");
		await expect(
			canvas.getByText(/^2 \/ 3 · p\. 1 \/ \d+$/),
		).toBeInTheDocument();
		await userEvent.keyboard("{ArrowRight}");
		await expect(args.onChapterNoChange).toHaveBeenCalledWith(1);
	},
};

export const FileLoading: Story = {
	args: {
		fileUrl: null,
		fileLoading: true,
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		// The cover stands in while the EPUB loads, with a progress bar and
		// no page-turn controls — there is nothing to page through yet.
		await expect(
			canvasElement.querySelector("img[src$='cover.jpg']"),
		).toBeInTheDocument();
		await expect(canvas.getByText("Loading…")).toBeInTheDocument();
		await expect(canvas.getByRole("progressbar")).toBeInTheDocument();
		await expect(
			canvas.queryByRole("button", { name: /next page/i }),
		).not.toBeInTheDocument();
	},
};

export const NoEpubFile: Story = {
	args: {
		fileUrl: null,
		fileLoading: false,
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(canvas.getByText("No EPUB file")).toBeInTheDocument();
	},
};

export const LoadError: Story = {
	args: {
		fileUrl: "/books/alice-in-wonderland/missing.epub",
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await waitFor(
			() =>
				expect(canvas.getByText("Couldn't open the EPUB")).toBeInTheDocument(),
			EPUB_RENDER_TIMEOUT,
		);
	},
};
