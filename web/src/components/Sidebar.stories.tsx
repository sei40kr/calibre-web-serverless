import { BookshelfError } from "@calibre-web-serverless/domain/errors/bookshelfError";
import type { Bookshelf } from "@calibre-web-serverless/domain/models/bookshelf";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { Sidebar } from "./Sidebar";

const bookshelves: Bookshelf[] = [
	{
		id: "bookshelf-001",
		name: "Favorites",
		bookCount: 2,
		createdAt: new Date("2024-01-01"),
		updatedAt: new Date("2024-01-01"),
	},
	{
		id: "bookshelf-002",
		name: "To Read",
		bookCount: 0,
		createdAt: new Date("2024-01-02"),
		updatedAt: new Date("2024-01-02"),
	},
];

const meta = {
	title: "Components/Sidebar",
	component: Sidebar,
	args: {
		bookshelves,
		activeBookshelfId: null,
		onCreateBookshelf: fn(async () => {}),
		onRenameBookshelf: fn(async () => {}),
		onDeleteBookshelf: fn(async () => {}),
	},
	decorators: [
		(Story) => (
			<div style={{ width: "256px" }}>
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof Sidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		const allBooks = canvas.getByRole("link", { name: /all books/i });
		await expect(allBooks).toHaveAttribute("href", "/dashboard");
		await expect(allBooks).toHaveAttribute("aria-current", "page");

		const favorites = canvas.getByRole("link", { name: /favorites/i });
		await expect(favorites).toHaveAttribute(
			"href",
			"/dashboard/bookshelves/bookshelf-001",
		);
		await expect(favorites).toHaveTextContent("2");
	},
};

export const ActiveBookshelf: Story = {
	args: { activeBookshelfId: "bookshelf-002" },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(
			canvas.getByRole("link", { name: /to read/i }),
		).toHaveAttribute("aria-current", "page");
		await expect(
			canvas.getByRole("link", { name: /all books/i }),
		).not.toHaveAttribute("aria-current");
	},
};

export const Empty: Story = {
	args: { bookshelves: [] },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText("No bookshelves yet")).toBeInTheDocument();
	},
};

export const CreateBookshelf: Story = {
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		const body = within(canvasElement.ownerDocument.body);

		await userEvent.click(
			canvas.getByRole("button", { name: /new bookshelf/i }),
		);

		const dialog = await body.findByRole("dialog");
		await userEvent.type(within(dialog).getByRole("textbox"), "  Sci-Fi ");
		await userEvent.click(
			within(dialog).getByRole("button", { name: /^create$/i }),
		);

		await expect(args.onCreateBookshelf).toHaveBeenCalledWith("  Sci-Fi ");
	},
};

export const CreateBookshelfDuplicateName: Story = {
	args: {
		onCreateBookshelf: fn(async () => {
			throw new BookshelfError("duplicate-name", "exists");
		}),
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const body = within(canvasElement.ownerDocument.body);

		await userEvent.click(
			canvas.getByRole("button", { name: /new bookshelf/i }),
		);

		const dialog = await body.findByRole("dialog");
		await userEvent.type(within(dialog).getByRole("textbox"), "Favorites");
		await userEvent.click(
			within(dialog).getByRole("button", { name: /^create$/i }),
		);

		await expect(
			await within(dialog).findByText(
				/already have a bookshelf with this name/i,
			),
		).toBeInTheDocument();
	},
};

export const RenameBookshelf: Story = {
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		const body = within(canvasElement.ownerDocument.body);

		await userEvent.click(
			canvas.getByRole("button", { name: /bookshelf actions for favorites/i }),
		);
		await userEvent.click(
			await body.findByRole("menuitem", { name: /rename/i }),
		);

		const dialog = await body.findByRole("dialog");
		const input = within(dialog).getByRole("textbox");
		await expect(input).toHaveValue("Favorites");
		await userEvent.clear(input);
		await userEvent.type(input, "Best Books");
		await userEvent.click(
			within(dialog).getByRole("button", { name: /^rename$/i }),
		);

		await expect(args.onRenameBookshelf).toHaveBeenCalledWith(
			bookshelves[0],
			"Best Books",
		);
	},
};

export const RenameBookshelfDuplicateName: Story = {
	args: {
		onRenameBookshelf: fn(async () => {
			throw new BookshelfError("duplicate-name", "exists");
		}),
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const body = within(canvasElement.ownerDocument.body);

		await userEvent.click(
			canvas.getByRole("button", { name: /bookshelf actions for to read/i }),
		);
		await userEvent.click(
			await body.findByRole("menuitem", { name: /rename/i }),
		);

		const dialog = await body.findByRole("dialog");
		const input = within(dialog).getByRole("textbox");
		await userEvent.clear(input);
		await userEvent.type(input, "Favorites");
		await userEvent.click(
			within(dialog).getByRole("button", { name: /^rename$/i }),
		);

		await expect(
			await within(dialog).findByText(
				/already have a bookshelf with this name/i,
			),
		).toBeInTheDocument();
	},
};

export const DeleteBookshelfConfirmed: Story = {
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		const body = within(canvasElement.ownerDocument.body);

		await userEvent.click(
			canvas.getByRole("button", { name: /bookshelf actions for favorites/i }),
		);
		await userEvent.click(
			await body.findByRole("menuitem", { name: /delete/i }),
		);

		const dialog = await body.findByRole("alertdialog");
		await expect(dialog).toHaveTextContent(/favorites/i);
		await userEvent.click(
			within(dialog).getByRole("button", { name: /^delete$/i }),
		);

		await expect(args.onDeleteBookshelf).toHaveBeenCalledWith(bookshelves[0]);
	},
};

export const DeleteBookshelfCancelled: Story = {
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		const body = within(canvasElement.ownerDocument.body);

		await userEvent.click(
			canvas.getByRole("button", { name: /bookshelf actions for to read/i }),
		);
		await userEvent.click(
			await body.findByRole("menuitem", { name: /delete/i }),
		);

		const dialog = await body.findByRole("alertdialog");
		await userEvent.click(
			within(dialog).getByRole("button", { name: /cancel/i }),
		);

		await expect(args.onDeleteBookshelf).not.toHaveBeenCalled();
	},
};
