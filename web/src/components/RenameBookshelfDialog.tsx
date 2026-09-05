"use client";

import { BookshelfError } from "@calibre-web-serverless/domain/errors/bookshelfError";
import {
	bookshelfNameProblem,
	MAX_BOOKSHELF_NAME_LENGTH,
} from "@calibre-web-serverless/domain/models/bookshelf";
import { Button, Input } from "@chakra-ui/react";
import { useEffect, useId, useRef, useState } from "react";
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

interface RenameBookshelfFormData {
	name: string;
}

interface RenameBookshelfDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** The name the bookshelf has now; pre-fills the form. */
	currentName: string;
	/** Rejects with a `BookshelfError` for a name that cannot be used. */
	onRename: (name: string) => Promise<void>;
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

export function RenameBookshelfDialog({
	open,
	onOpenChange,
	currentName,
	onRename,
}: RenameBookshelfDialogProps) {
	const formId = useId();
	const inputRef = useRef<HTMLInputElement | null>(null);
	const [submitError, setSubmitError] = useState<string | null>(null);
	const {
		register,
		handleSubmit,
		reset,
		formState: { errors, isSubmitting },
	} = useForm<RenameBookshelfFormData>({
		defaultValues: { name: currentName },
	});

	// The dialog is reused across bookshelves, so refill the form each time it
	// opens for the one being renamed.
	useEffect(() => {
		if (open) {
			reset({ name: currentName });
			setSubmitError(null);
		}
	}, [open, currentName, reset]);

	const close = () => {
		if (isSubmitting) return;
		onOpenChange(false);
	};

	const onSubmit = async ({ name }: RenameBookshelfFormData) => {
		setSubmitError(null);
		try {
			await onRename(name);
			onOpenChange(false);
		} catch (error) {
			if (error instanceof BookshelfError && error.code === "duplicate-name") {
				setSubmitError("You already have a bookshelf with this name");
			} else if (error instanceof BookshelfError) {
				setSubmitError(error.message);
			} else {
				setSubmitError("Couldn't rename the bookshelf. Please try again.");
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
					<DialogTitle>Rename Bookshelf</DialogTitle>
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
						Rename
					</Button>
				</DialogFooter>
				<DialogCloseTrigger onClick={close} disabled={isSubmitting} />
			</DialogContent>
		</DialogRoot>
	);
}
