import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { ISBN } from "@/models/identifier";
import { Language } from "@/models/language";
import type { BookEditData } from "./EditBookPage";
import { EditBookPage } from "./EditBookPage";

const mockAuthorSuggestions = ["Lewis Carroll", "J.R.R. Tolkien"];
const mockSeriesSuggestions = ["Alice Series", "The Lord of the Rings"];
const mockTagSuggestions = ["Fantasy", "Classic", "Children"];
const mockPublisherNames = ["Penguin Books", "HarperCollins", "Random House"];

const mockBook: BookEditData = {
	title: "Alice's Adventures in Wonderland",
	sortTitle: "Alice's Adventures in Wonderland",
	authorNames: ["Lewis Carroll"],
	seriesName: "Alice Series",
	seriesIndex: 1,
	tagNames: ["Fantasy", "Children"],
	publisherName: "Penguin Books",
	pubDate: new Date("1865-11-26"),
	identifiers: [{ type: ISBN, value: "0141439769" }],
	languages: [Language.EN],
	description: "A young girl falls through a rabbit hole into a fantasy world.",
	rating: 4,
	format: "epub",
	fileSize: 189000,
};

const meta = {
	title: "Pages/EditBookPage",
	component: EditBookPage,
	parameters: {
		layout: "fullscreen",
	},
	args: {
		book: mockBook,
		authorSuggestions: mockAuthorSuggestions,
		seriesSuggestions: mockSeriesSuggestions,
		tagSuggestions: mockTagSuggestions,
		publisherNames: mockPublisherNames,
		onUpdateBook: fn(async () => {}),
		onCancel: fn(),
	},
} satisfies Meta<typeof EditBookPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(
			canvas.getByRole("heading", { name: /edit book/i }),
		).toBeInTheDocument();
		await expect(canvas.getByPlaceholderText(/enter book title/i)).toHaveValue(
			"Alice's Adventures in Wonderland",
		);
		await expect(canvas.getByText("Lewis Carroll")).toBeInTheDocument();
		await expect(canvas.getByText("Fantasy")).toBeInTheDocument();
		await expect(canvas.getByText("Children")).toBeInTheDocument();
		await expect(canvas.getByText("English")).toBeInTheDocument();
	},
};

export const TitleValidation: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		const titleInput = canvas.getByPlaceholderText(/enter book title/i);
		await userEvent.clear(titleInput);

		const saveButton = canvas.getByRole("button", { name: /save/i });
		await userEvent.click(saveButton);

		await expect(
			canvas.findByText(/title is required/i),
		).resolves.toBeInTheDocument();
	},
};

export const TitleCannotBeEmpty: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		const titleInput = canvas.getByPlaceholderText(/enter book title/i);
		await userEvent.clear(titleInput);
		await userEvent.type(titleInput, "   ", { delay: 50 });

		const saveButton = canvas.getByRole("button", { name: /save/i });
		await userEvent.click(saveButton);

		await expect(
			canvas.findByText(/title cannot be empty/i),
		).resolves.toBeInTheDocument();
	},
};

export const AuthorSuggestions: Story = {
	args: {
		book: {
			...mockBook,
			authorNames: [],
		},
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const body = within(canvasElement.ownerDocument.body);

		const authorInput = canvas.getByPlaceholderText(/add author/i);
		await userEvent.type(authorInput, "l", { delay: 50 });

		const listbox = await body.findByRole("listbox");
		const options = within(listbox);

		await expect(
			options.getByRole("option", { name: "Lewis Carroll" }),
		).toBeInTheDocument();
	},
};

export const AuthorAddNew: Story = {
	args: {
		book: {
			...mockBook,
			authorNames: [],
		},
	},
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		const body = within(canvasElement.ownerDocument.body);

		const authorInput = canvas.getByPlaceholderText(/add author/i);
		await userEvent.click(authorInput);
		await userEvent.type(authorInput, "New Author Name", { delay: 50 });

		// Wait for the dropdown to show and then press Enter to add
		await body.findByRole("listbox");
		await userEvent.keyboard("{Enter}");

		await expect(canvas.getByText("New Author Name")).toBeInTheDocument();

		const saveButton = canvas.getByRole("button", { name: /save/i });
		await userEvent.click(saveButton);

		await expect(args.onUpdateBook).toHaveBeenCalled();
		const call = (args.onUpdateBook as ReturnType<typeof fn>).mock.calls[0][0];
		await expect(call.authorNames).toContain("New Author Name");
	},
};

export const SeriesSuggestions: Story = {
	args: {
		book: {
			...mockBook,
			seriesName: "",
			seriesIndex: 1,
		},
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const body = within(canvasElement.ownerDocument.body);

		const seriesInput = canvas.getByPlaceholderText(/select or create series/i);
		await userEvent.type(seriesInput, "a", { delay: 50 });

		const listbox = await body.findByRole("listbox");
		const options = within(listbox);

		await expect(
			options.getByRole("option", { name: "Alice Series" }),
		).toBeInTheDocument();
	},
};

export const SeriesEnterNew: Story = {
	args: {
		book: {
			...mockBook,
			seriesName: "",
			seriesIndex: 1,
		},
	},
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		const body = within(canvasElement.ownerDocument.body);

		const seriesInput = canvas.getByPlaceholderText(/select or create series/i);
		await userEvent.click(seriesInput);
		await userEvent.type(seriesInput, "New Series Name", { delay: 50 });

		// Wait for the dropdown to show and select the "Create" option
		const listbox = await body.findByRole("listbox");
		const createOption = within(listbox).getByText(
			/\+ Create "New Series Name"/,
		);
		await userEvent.click(createOption);

		const saveButton = canvas.getByRole("button", { name: /save/i });
		await userEvent.click(saveButton);

		await expect(args.onUpdateBook).toHaveBeenCalled();
		const call = (args.onUpdateBook as ReturnType<typeof fn>).mock.calls[0][0];
		await expect(call.seriesName).toBe("New Series Name");
	},
};

export const TagSuggestions: Story = {
	args: {
		book: {
			...mockBook,
			tagNames: [],
		},
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const body = within(canvasElement.ownerDocument.body);

		const tagInput = canvas.getByPlaceholderText(/add tag/i);
		await userEvent.type(tagInput, "c", { delay: 50 });

		const listbox = await body.findByRole("listbox");
		const options = within(listbox);

		await expect(
			options.getByRole("option", { name: "Classic" }),
		).toBeInTheDocument();
		await expect(
			options.getByRole("option", { name: "Children" }),
		).toBeInTheDocument();
	},
};

export const TagAddNew: Story = {
	args: {
		book: {
			...mockBook,
			tagNames: [],
		},
	},
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		const body = within(canvasElement.ownerDocument.body);

		const tagInput = canvas.getByPlaceholderText(/add tag/i);
		await userEvent.click(tagInput);
		await userEvent.type(tagInput, "New Tag", { delay: 50 });

		// Wait for the dropdown to show and then press Enter to add
		await body.findByRole("listbox");
		await userEvent.keyboard("{Enter}");

		await expect(canvas.getByText("New Tag")).toBeInTheDocument();

		const saveButton = canvas.getByRole("button", { name: /save/i });
		await userEvent.click(saveButton);

		await expect(args.onUpdateBook).toHaveBeenCalled();
		const call = (args.onUpdateBook as ReturnType<typeof fn>).mock.calls[0][0];
		await expect(call.tagNames).toContain("New Tag");
	},
};

export const PublisherSuggestions: Story = {
	args: {
		book: {
			...mockBook,
			publisherName: "",
		},
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const body = within(canvasElement.ownerDocument.body);

		const publisherInput = canvas.getByPlaceholderText(
			/select or enter publisher/i,
		);
		await userEvent.type(publisherInput, "p", { delay: 50 });

		const listbox = await body.findByRole("listbox");
		const options = within(listbox);

		await expect(
			options.getByRole("option", { name: "Penguin Books" }),
		).toBeInTheDocument();
	},
};

export const EditPublisherEnterNew: Story = {
	args: {
		book: {
			...mockBook,
			publisherName: "",
		},
	},
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		const body = within(canvasElement.ownerDocument.body);

		const publisherInput = canvas.getByPlaceholderText(
			/select or enter publisher/i,
		);
		await userEvent.click(publisherInput);
		await userEvent.type(publisherInput, "New Publisher", { delay: 50 });

		// Wait for the dropdown to show and select the "Create" option
		const listbox = await body.findByRole("listbox");
		const createOption = within(listbox).getByText(/\+ Create "New Publisher"/);
		await userEvent.click(createOption);

		const saveButton = canvas.getByRole("button", { name: /save/i });
		await userEvent.click(saveButton);

		await expect(args.onUpdateBook).toHaveBeenCalled();
		const call = (args.onUpdateBook as ReturnType<typeof fn>).mock.calls[0][0];
		await expect(call.publisherName).toBe("New Publisher");
	},
};

export const LanguageSuggestions: Story = {
	args: {
		book: {
			...mockBook,
			languages: [],
		},
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const body = within(canvasElement.ownerDocument.body);

		const languageInput = canvas.getByPlaceholderText(/add language/i);
		await userEvent.type(languageInput, "ja", { delay: 50 });

		const listbox = await body.findByRole("listbox");
		const options = within(listbox);

		await expect(
			options.getByRole("option", { name: "Japanese" }),
		).toBeInTheDocument();
	},
};

export const SubmitFormVerifyArguments: Story = {
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);

		const saveButton = canvas.getByRole("button", { name: /save/i });
		await userEvent.click(saveButton);

		await expect(args.onUpdateBook).toHaveBeenCalled();
		const call = (args.onUpdateBook as ReturnType<typeof fn>).mock.calls[0][0];
		await expect(call.title).toBe("Alice's Adventures in Wonderland");
		await expect(call.sortTitle).toBe("Alice's Adventures in Wonderland");
		await expect(call.authorNames).toEqual(["Lewis Carroll"]);
		await expect(call.seriesName).toBe("Alice Series");
		await expect(call.seriesIndex).toBe(1);
		await expect(call.tagNames).toEqual(["Fantasy", "Children"]);
		await expect(call.description).toBe(
			"A young girl falls through a rabbit hole into a fantasy world.",
		);
		await expect(call.publisherName).toBe("Penguin Books");
		await expect(call.pubDate).toBeInstanceOf(Date);
		await expect(call.languages).toEqual([Language.EN]);
		await expect(call.rating).toBe(4);
		await expect(call.identifiers).toHaveLength(1);
		await expect(call.identifiers[0].type).toBe(ISBN);
		await expect(call.identifiers[0].value).toBe("0141439769");
	},
};

export const UpdateError: Story = {
	args: {
		onUpdateBook: fn(async () => {
			throw new Error("Network error");
		}),
	},
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);

		const saveButton = canvas.getByRole("button", { name: /save/i });
		await userEvent.click(saveButton);

		await expect(
			canvas.findByText(/failed to update book/i),
		).resolves.toBeInTheDocument();

		await expect(saveButton).toBeEnabled();
	},
};

export const BackButtonWithoutChanges: Story = {
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);

		const backButton = canvas.getByRole("button", { name: /back/i });
		await userEvent.click(backButton);

		await expect(args.onCancel).toHaveBeenCalled();
	},
};

export const BackButtonWithChangesConfirmed: Story = {
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		const win = canvasElement.ownerDocument.defaultView!;
		const originalConfirm = win.confirm;
		win.confirm = () => true;

		try {
			const titleInput = canvas.getByPlaceholderText(/enter book title/i);
			await userEvent.clear(titleInput);
			await userEvent.type(titleInput, "Modified Title", { delay: 50 });

			const backButton = canvas.getByRole("button", { name: /back/i });
			await userEvent.click(backButton);

			await expect(args.onCancel).toHaveBeenCalled();
		} finally {
			win.confirm = originalConfirm;
		}
	},
};

export const BackButtonWithChangesDeclined: Story = {
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		const win = canvasElement.ownerDocument.defaultView!;
		const originalConfirm = win.confirm;
		win.confirm = () => false;

		try {
			const titleInput = canvas.getByPlaceholderText(/enter book title/i);
			await userEvent.clear(titleInput);
			await userEvent.type(titleInput, "Modified Title", { delay: 50 });

			const backButton = canvas.getByRole("button", { name: /back/i });
			await userEvent.click(backButton);

			await expect(args.onCancel).not.toHaveBeenCalled();
		} finally {
			win.confirm = originalConfirm;
		}
	},
};

export const CancelButtonWithoutChanges: Story = {
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);

		const cancelButton = canvas.getByRole("button", { name: /cancel/i });
		await userEvent.click(cancelButton);

		await expect(args.onCancel).toHaveBeenCalled();
	},
};

export const CancelButtonWithChangesConfirmed: Story = {
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		const win = canvasElement.ownerDocument.defaultView!;
		const originalConfirm = win.confirm;
		win.confirm = () => true;

		try {
			const titleInput = canvas.getByPlaceholderText(/enter book title/i);
			await userEvent.clear(titleInput);
			await userEvent.type(titleInput, "Modified Title", { delay: 50 });

			const cancelButton = canvas.getByRole("button", { name: /cancel/i });
			await userEvent.click(cancelButton);

			await expect(args.onCancel).toHaveBeenCalled();
		} finally {
			win.confirm = originalConfirm;
		}
	},
};

export const CancelButtonWithChangesDeclined: Story = {
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		const win = canvasElement.ownerDocument.defaultView!;
		const originalConfirm = win.confirm;
		win.confirm = () => false;

		try {
			const titleInput = canvas.getByPlaceholderText(/enter book title/i);
			await userEvent.clear(titleInput);
			await userEvent.type(titleInput, "Modified Title", { delay: 50 });

			const cancelButton = canvas.getByRole("button", { name: /cancel/i });
			await userEvent.click(cancelButton);

			await expect(args.onCancel).not.toHaveBeenCalled();
		} finally {
			win.confirm = originalConfirm;
		}
	},
};

export const BeforeUnloadWithoutChanges: Story = {
	play: async ({ canvasElement }) => {
		const win = canvasElement.ownerDocument.defaultView!;

		const event = new Event("beforeunload", { cancelable: true });
		win.dispatchEvent(event);

		await expect(event.defaultPrevented).toBe(false);
	},
};

export const BeforeUnloadWithChanges: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const win = canvasElement.ownerDocument.defaultView!;

		const titleInput = canvas.getByPlaceholderText(/enter book title/i);
		await userEvent.clear(titleInput);
		await userEvent.type(titleInput, "Modified Title", { delay: 50 });

		const event = new Event("beforeunload", { cancelable: true });
		win.dispatchEvent(event);

		await expect(event.defaultPrevented).toBe(true);
	},
};
