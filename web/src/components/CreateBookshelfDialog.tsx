"use client";

import { BookshelfError } from "@calibre-web-serverless/domain/errors/bookshelfError";
import {
	bookshelfNameProblem,
	MAX_BOOKSHELF_NAME_LENGTH,
} from "@calibre-web-serverless/domain/models/bookshelf";
import { Button, Input } from "@chakra-ui/react";
import { useId, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import {
	DialogBody,
	DialogCloseTrigger,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogRoot,
	DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";

interface CreateBookshelfFormData {
	name: string;
}

interface CreateBookshelfDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Rejects with a `BookshelfError` for a name that cannot be used. */
	onCreate: (name: string) => Promise<void>;
}

const validateName = (name: string): true | string => {
	switch (bookshelfNameProblem(name)) {
		case "empty":
			return "Please enter a name";
		case "too-long":
			return `Use at most ${MAX_BOOKSHELF_NAME_LENGTH} characters`;
		default:
			return true;
	}
};

export function CreateBookshelfDialog({
	open,
	onOpenChange,
	onCreate,
}: CreateBookshelfDialogProps) {
	const formId = useId();
	const inputRef = useRef<HTMLInputElement | null>(null);
	const [submitError, setSubmitError] = useState<string | null>(null);
	const {
		register,
		handleSubmit,
		reset,
		formState: { errors, isSubmitting },
	} = useForm<CreateBookshelfFormData>({ defaultValues: { name: "" } });

	const close = () => {
		if (isSubmitting) return;
		reset();
		setSubmitError(null);
		onOpenChange(false);
	};

	const onSubmit = async ({ name }: CreateBookshelfFormData) => {
		setSubmitError(null);
		try {
			await onCreate(name);
			reset();
			onOpenChange(false);
		} catch (error) {
			if (error instanceof BookshelfError && error.code === "duplicate-name") {
				setSubmitError("You already have a bookshelf with this name");
			} else if (error instanceof BookshelfError) {
				setSubmitError(error.message);
			} else {
				setSubmitError("Couldn't create the bookshelf. Please try again.");
			}
		}
	};

	const errorText = errors.name?.message ?? submitError ?? undefined;

	const { ref: registerRef, ...nameField } = register("name", {
		validate: validateName,
		onChange: () => setSubmitError(null),
	});

	return (
		<DialogRoot
			open={open}
			onOpenChange={(e) => {
				if (!e.open) close();
			}}
			initialFocusEl={() => inputRef.current}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>New Bookshelf</DialogTitle>
				</DialogHeader>
				<DialogBody>
					<form id={formId} noValidate onSubmit={handleSubmit(onSubmit)}>
						<Field
							label="Name"
							required
							invalid={!!errorText}
							errorText={errorText}
						>
							<Input
								placeholder="e.g. To Read"
								autoComplete="off"
								ref={(element) => {
									registerRef(element);
									inputRef.current = element;
								}}
								{...nameField}
							/>
						</Field>
					</form>
				</DialogBody>
				<DialogFooter>
					<Button variant="outline" onClick={close} disabled={isSubmitting}>
						Cancel
					</Button>
					<Button
						type="submit"
						form={formId}
						colorPalette="blue"
						loading={isSubmitting}
					>
						Create
					</Button>
				</DialogFooter>
				<DialogCloseTrigger onClick={close} disabled={isSubmitting} />
			</DialogContent>
		</DialogRoot>
	);
}
