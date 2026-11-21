"use client";

import { AuthError } from "@calibre-web-serverless/domain/errors/authError";
import { ChangeEmailError } from "@calibre-web-serverless/domain/errors/changeEmailError";
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

interface ChangeEmailFormData {
	newEmail: string;
	currentPassword: string;
}

interface ChangeEmailDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	currentEmail: string;
	/** Rejects with an `AuthError` or `ChangeEmailError` when the change is refused. */
	onChangeEmail: (newEmail: string, currentPassword: string) => Promise<void>;
}

export function ChangeEmailDialog({
	open,
	onOpenChange,
	currentEmail,
	onChangeEmail,
}: ChangeEmailDialogProps) {
	const formId = useId();
	const {
		register,
		handleSubmit,
		reset,
		setError,
		formState: { errors, isSubmitting },
	} = useForm<ChangeEmailFormData>({
		defaultValues: { newEmail: "", currentPassword: "" },
	});

	useEffect(() => {
		if (open) reset();
	}, [open, reset]);

	const close = () => {
		if (isSubmitting) return;
		onOpenChange(false);
	};

	const onSubmit = async ({
		newEmail,
		currentPassword,
	}: ChangeEmailFormData) => {
		try {
			await onChangeEmail(newEmail, currentPassword);
			onOpenChange(false);
		} catch (error) {
			if (error instanceof ChangeEmailError) {
				setError("newEmail", {
					message:
						error.code === "email-already-in-use"
							? "This email is already in use"
							: "Invalid email address",
				});
			} else if (
				error instanceof AuthError &&
				error.code === "invalid-credential"
			) {
				setError("currentPassword", {
					message: "Current password is incorrect",
				});
			} else if (
				error instanceof AuthError &&
				error.code === "too-many-requests"
			) {
				setError("root", {
					message: "Too many attempts. Please try again later",
				});
			} else {
				setError("root", {
					message: "Couldn't change your email. Please try again.",
				});
			}
		}
	};

	return (
		<DialogRoot
			open={open}
			onOpenChange={(e) => {
				if (!e.open) close();
			}}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Change email</DialogTitle>
				</DialogHeader>
				<DialogBody>
					<form id={formId} noValidate onSubmit={handleSubmit(onSubmit)}>
						<Stack gap={4}>
							<Text fontSize="sm" color="fg.muted">
								We'll send a verification link to the new address. Your email
								changes once you open it — until then, keep signing in with{" "}
								<Span color="fg" fontWeight="medium">
									{currentEmail}
								</Span>
								.
							</Text>
							{errors.root && (
								<Alert status="error" title={errors.root.message} />
							)}
							<Field
								label="New email"
								required
								invalid={!!errors.newEmail}
								errorText={errors.newEmail?.message}
							>
								<Input
									type="email"
									autoComplete="email"
									placeholder="example@email.com"
									{...register("newEmail", {
										required: "Email is required",
										pattern: {
											value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
											message: "Invalid email address",
										},
										validate: (value) =>
											value.trim().toLowerCase() !==
												currentEmail.toLowerCase() ||
											"This is already your email",
									})}
								/>
							</Field>
							<Field
								label="Current password"
								required
								invalid={!!errors.currentPassword}
								errorText={errors.currentPassword?.message}
								helperText={
									errors.currentPassword
										? undefined
										: "Enter your password to confirm it's you."
								}
							>
								<Input
									type="password"
									autoComplete="current-password"
									{...register("currentPassword", {
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
						colorPalette="blue"
						loading={isSubmitting}
					>
						Send verification email
					</Button>
				</DialogFooter>
				<DialogCloseTrigger onClick={close} disabled={isSubmitting} />
			</DialogContent>
		</DialogRoot>
	);
}
