"use client";

import { AuthError } from "@calibre-web-serverless/domain/errors/authError";
import { ChangePasswordError } from "@calibre-web-serverless/domain/errors/changePasswordError";
import { Button, Input, Stack } from "@chakra-ui/react";
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

// Firebase Auth's default minimum; a stricter project policy still surfaces
// as a "weak-password" error.
const MIN_PASSWORD_LENGTH = 6;

interface ChangePasswordFormData {
	currentPassword: string;
	newPassword: string;
	confirmPassword: string;
}

interface ChangePasswordDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Rejects with an `AuthError` or `ChangePasswordError` when the change is refused. */
	onChangePassword: (
		currentPassword: string,
		newPassword: string,
	) => Promise<void>;
}

export function ChangePasswordDialog({
	open,
	onOpenChange,
	onChangePassword,
}: ChangePasswordDialogProps) {
	const formId = useId();
	const {
		register,
		handleSubmit,
		reset,
		setError,
		formState: { errors, isSubmitting },
	} = useForm<ChangePasswordFormData>({
		defaultValues: {
			currentPassword: "",
			newPassword: "",
			confirmPassword: "",
		},
	});

	useEffect(() => {
		if (open) reset();
	}, [open, reset]);

	const close = () => {
		if (isSubmitting) return;
		onOpenChange(false);
	};

	const onSubmit = async ({
		currentPassword,
		newPassword,
	}: ChangePasswordFormData) => {
		try {
			await onChangePassword(currentPassword, newPassword);
			onOpenChange(false);
		} catch (error) {
			if (error instanceof ChangePasswordError) {
				setError("newPassword", { message: "Choose a stronger password" });
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
					message: "Couldn't change your password. Please try again.",
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
					<DialogTitle>Change password</DialogTitle>
				</DialogHeader>
				<DialogBody>
					<form id={formId} noValidate onSubmit={handleSubmit(onSubmit)}>
						<Stack gap={4}>
							{errors.root && (
								<Alert status="error" title={errors.root.message} />
							)}
							<Field
								label="Current password"
								required
								invalid={!!errors.currentPassword}
								errorText={errors.currentPassword?.message}
							>
								<Input
									type="password"
									autoComplete="current-password"
									{...register("currentPassword", {
										required: "Password is required",
									})}
								/>
							</Field>
							<Field
								label="New password"
								required
								invalid={!!errors.newPassword}
								errorText={errors.newPassword?.message}
								helperText={
									errors.newPassword
										? undefined
										: `At least ${MIN_PASSWORD_LENGTH} characters`
								}
							>
								<Input
									type="password"
									autoComplete="new-password"
									{...register("newPassword", {
										required: "Password is required",
										minLength: {
											value: MIN_PASSWORD_LENGTH,
											message: `Use at least ${MIN_PASSWORD_LENGTH} characters`,
										},
									})}
								/>
							</Field>
							<Field
								label="Confirm new password"
								required
								invalid={!!errors.confirmPassword}
								errorText={errors.confirmPassword?.message}
							>
								<Input
									type="password"
									autoComplete="new-password"
									{...register("confirmPassword", {
										validate: (value, { newPassword }) =>
											value === newPassword || "Passwords don't match",
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
						Update password
					</Button>
				</DialogFooter>
				<DialogCloseTrigger onClick={close} disabled={isSubmitting} />
			</DialogContent>
		</DialogRoot>
	);
}
