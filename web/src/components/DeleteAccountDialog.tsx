"use client";

import { AuthError } from "@calibre-web-serverless/domain/errors/authError";
import { Button, Input, Span, Stack, Text } from "@chakra-ui/react";
import { useEffect, useId } from "react";
import { useForm } from "react-hook-form";
import { Alert } from "@/components/ui/alert";
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

interface DeleteAccountFormData {
	password: string;
}

interface DeleteAccountDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	email: string;
	bookCount: number;
	bookshelfCount: number;
	/** Rejects with an `AuthError` when the deletion is refused. */
	onDeleteAccount: (password: string) => Promise<void>;
}

const count = (n: number, singular: string, plural: string) =>
	`${n} ${n === 1 ? singular : plural}`;

export function DeleteAccountDialog({
	open,
	onOpenChange,
	email,
	bookCount,
	bookshelfCount,
	onDeleteAccount,
}: DeleteAccountDialogProps) {
	const formId = useId();
	const {
		register,
		handleSubmit,
		reset,
		setError,
		formState: { errors, isSubmitting },
	} = useForm<DeleteAccountFormData>({ defaultValues: { password: "" } });

	useEffect(() => {
		if (open) reset();
	}, [open, reset]);

	const close = () => {
		if (isSubmitting) return;
		onOpenChange(false);
	};

	const onSubmit = async ({ password }: DeleteAccountFormData) => {
		try {
			await onDeleteAccount(password);
		} catch (error) {
			if (error instanceof AuthError && error.code === "invalid-credential") {
				setError("password", { message: "Password is incorrect" });
			} else if (
				error instanceof AuthError &&
				error.code === "too-many-requests"
			) {
				setError("root", {
					message: "Too many attempts. Please try again later",
				});
			} else {
				setError("root", {
					message: "Couldn't delete your account. Please try again.",
				});
			}
		}
	};

	return (
		<DialogRoot
			role="alertdialog"
			open={open}
			onOpenChange={(e) => {
				if (!e.open) close();
			}}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Delete account</DialogTitle>
				</DialogHeader>
				<DialogBody>
					<form id={formId} noValidate onSubmit={handleSubmit(onSubmit)}>
						<Stack gap={4}>
							<Text>
								This permanently deletes{" "}
								<Span fontWeight="semibold">{email}</Span> and your entire
								library: {count(bookCount, "book", "books")}, their files and
								covers, and {count(bookshelfCount, "bookshelf", "bookshelves")}.
								This action cannot be undone.
							</Text>
							{errors.root && (
								<Alert status="error" title={errors.root.message} />
							)}
							<Field
								label="Password"
								required
								invalid={!!errors.password}
								errorText={errors.password?.message}
								helperText={
									errors.password
										? undefined
										: "Enter your password to confirm."
								}
							>
								<Input
									type="password"
									autoComplete="current-password"
									{...register("password", {
										required: "Password is required",
									})}
								/>
							</Field>
						</Stack>
					</form>
				</DialogBody>
				<DialogFooter>
					<Button variant="outline" onClick={close} disabled={isSubmitting}>
						Cancel
					</Button>
					<Button
						type="submit"
						form={formId}
						colorPalette="red"
						loading={isSubmitting}
					>
						Delete account
					</Button>
				</DialogFooter>
				<DialogCloseTrigger onClick={close} disabled={isSubmitting} />
			</DialogContent>
		</DialogRoot>
	);
}
