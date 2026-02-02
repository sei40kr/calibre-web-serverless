import { Button } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { FormProvider, useForm } from "react-hook-form";
import { expect, fn, userEvent, within } from "storybook/test";
import {
	IdentifierFieldArray,
	type IdentifierFormData,
} from "./IdentifierFieldArray";

function Wrapper({
	defaultIdentifiers = [],
	onSubmit,
}: {
	defaultIdentifiers?: IdentifierFormData[];
	onSubmit?: (data: { identifiers: IdentifierFormData[] }) => void;
}) {
	const methods = useForm<{ identifiers: IdentifierFormData[] }>({
		defaultValues: { identifiers: defaultIdentifiers },
	});

	return (
		<FormProvider {...methods}>
			<form onSubmit={methods.handleSubmit((data) => onSubmit?.(data))}>
				<IdentifierFieldArray />
				<Button type="submit" mt={4}>
					Submit
				</Button>
			</form>
		</FormProvider>
	);
}

const meta = {
	title: "Components/IdentifierFieldArray",
	component: Wrapper,
	args: {
		defaultIdentifiers: [],
		onSubmit: fn(),
	},
} satisfies Meta<typeof Wrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(
			canvas.getByText(/no identifiers added yet/i),
		).toBeInTheDocument();
		await expect(
			canvas.getByRole("button", { name: /add identifier/i }),
		).toBeEnabled();
	},
};

export const DefaultsToUnusedType: Story = {
	args: {
		defaultIdentifiers: [
			{ type: "isbn", value: "0141439769" },
			{ type: "isbn13", value: "9780141439761" },
		],
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		const addButton = canvas.getByRole("button", { name: /add identifier/i });
		await userEvent.click(addButton);

		// The first unused type should be AMAZON (after ISBN and ISBN13)
		const selects = canvasElement.querySelectorAll("select");
		const lastSelect = selects[selects.length - 1];
		await expect(lastSelect).toHaveValue("amazon");
	},
};

export const TypeSelectShowsOnlyUnusedTypes: Story = {
	args: {
		defaultIdentifiers: [
			{ type: "isbn", value: "0141439769" },
			{ type: "isbn13", value: "9780141439761" },
		],
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		const addButton = canvas.getByRole("button", { name: /add identifier/i });
		await userEvent.click(addButton);

		// The newly added row's select should only contain its own type (AMAZON)
		// plus the remaining unused types (GOOGLE, GOODREADS)
		const selects = canvasElement.querySelectorAll("select");
		const lastSelect = selects[selects.length - 1];
		const options = lastSelect.querySelectorAll("option");
		const optionValues = Array.from(options).map((o) => o.value);

		await expect(optionValues).toContain("amazon");
		await expect(optionValues).toContain("google");
		await expect(optionValues).toContain("goodreads");
		await expect(optionValues).not.toContain("isbn");
		await expect(optionValues).not.toContain("isbn13");
	},
};

export const AddButtonDisabledWhenAllTypesUsed: Story = {
	args: {
		defaultIdentifiers: [
			{ type: "isbn", value: "0141439769" },
			{ type: "isbn13", value: "9780141439761" },
			{ type: "amazon", value: "B00K0ULECY" },
			{ type: "google", value: "XYZ123456789" },
			{ type: "goodreads", value: "12345678" },
		],
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		const addButton = canvas.getByRole("button", { name: /add identifier/i });
		await expect(addButton).toBeDisabled();
	},
};

export const Validation: Story = {
	args: {
		defaultIdentifiers: [{ type: "isbn", value: "0141439769" }],
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		const valueInput = canvas.getByDisplayValue("0141439769");
		await userEvent.clear(valueInput);
		await userEvent.type(valueInput, "invalid", { delay: 50 });

		const submitButton = canvas.getByRole("button", { name: /submit/i });
		await userEvent.click(submitButton);

		await expect(
			canvas.findByText(/isbn must be 10 characters/i),
		).resolves.toBeInTheDocument();
	},
};

export const EmptyValueValidation: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		const addButton = canvas.getByRole("button", { name: /add identifier/i });
		await userEvent.click(addButton);

		const submitButton = canvas.getByRole("button", { name: /submit/i });
		await userEvent.click(submitButton);

		await expect(
			canvas.findByText(/value is required/i),
		).resolves.toBeInTheDocument();
	},
};

export const ValidationPerType: Story = {
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);

		// Add one identifier (defaults to ISBN)
		const addButton = canvas.getByRole("button", { name: /add identifier/i });
		await userEvent.click(addButton);

		// Enter a valid ISBN-10 value
		const valueInput = canvas.getByPlaceholderText("Value");
		await userEvent.type(valueInput, "0141439769", { delay: 50 });

		const submitButton = canvas.getByRole("button", { name: /submit/i });
		await userEvent.click(submitButton);

		// Valid for ISBN — form submits successfully
		await expect(args.onSubmit).toHaveBeenCalled();

		// Change type to ISBN13 — same value should now fail validation
		const typeSelect = canvasElement.querySelector("select");
		if (!typeSelect) throw new Error("select element not found");
		await userEvent.selectOptions(typeSelect, "isbn13");
		await userEvent.click(submitButton);

		await expect(
			canvas.findByText(/isbn-13 must be 13 digits/i),
		).resolves.toBeInTheDocument();
	},
};
