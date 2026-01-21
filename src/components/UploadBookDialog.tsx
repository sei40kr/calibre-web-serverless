"use client";

import { Button, Fieldset, Input, Stack } from "@chakra-ui/react";
import { FirebaseError } from "firebase/app";
import type { User } from "firebase/auth";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
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
import {
	FileUploadDropzone,
	FileUploadList,
	FileUploadRoot,
} from "@/components/ui/file-upload";
import { toaster } from "@/components/ui/toaster";
import { uploadBook } from "@/services/bookService";
import type { BookUploadFormData } from "@/types/book";

interface UploadBookDialogProps {
	user: User;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess?: () => void;
}

const ACCEPTED_FORMATS = ".epub,.pdf,.mobi,.azw,.azw3,.fb2,.txt";

export function UploadBookDialog({
	user,
	open,
	onOpenChange,
	onSuccess,
}: UploadBookDialogProps) {
	const [uploadError, setUploadError] = useState<string | null>(null);
	const {
		register,
		control,
		handleSubmit,
		reset,
		formState: { errors, isSubmitting },
	} = useForm<BookUploadFormData>({
		defaultValues: {
			title: "",
			file: [],
		},
	});

	const onSubmit = async (data: BookUploadFormData) => {
		setUploadError(null);

		if (data.file.length === 0) {
			setUploadError("Please select a file to upload");
			return;
		}

		try {
			await uploadBook({
				userId: user.uid,
				title: data.title,
				file: data.file[0],
			});

			toaster.success({
				title: "Book uploaded",
				description: `"${data.title}" has been added to your library.`,
			});

			reset();
			onOpenChange(false);
			onSuccess?.();
		} catch (error) {
			if (error instanceof FirebaseError) {
				switch (error.code) {
					case "storage/unauthorized":
						setUploadError("You don't have permission to upload files");
						break;
					case "storage/canceled":
						setUploadError("Upload was cancelled");
						break;
					case "storage/quota-exceeded":
						setUploadError("Storage quota exceeded");
						break;
					default:
						setUploadError(`Upload failed: ${error.code}`);
				}
			} else {
				setUploadError(
					`Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		}
	};

	const handleClose = () => {
		if (!isSubmitting) {
			reset();
			setUploadError(null);
			onOpenChange(false);
		}
	};

	return (
		<DialogRoot
			open={open}
			onOpenChange={(e) => !isSubmitting && onOpenChange(e.open)}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Upload Book</DialogTitle>
				</DialogHeader>
				<DialogBody>
					{uploadError && <Alert status="error" title={uploadError} mb={4} />}

					<form
						id="upload-book-form"
						noValidate
						onSubmit={handleSubmit(onSubmit)}
					>
						<Fieldset.Root disabled={isSubmitting}>
							<Fieldset.Content>
								<Stack gap={4}>
									<Field
										label="Title"
										required
										invalid={!!errors.title}
										errorText={errors.title?.message}
									>
										<Input
											placeholder="Enter book title"
											{...register("title", {
												required: "Title is required",
											})}
										/>
									</Field>

									<Controller
										control={control}
										name="file"
										rules={{
											validate: (files) =>
												files.length > 0 || "Please select a file",
										}}
										render={({ field }) => (
											<Field
												label="Book File"
												required
												invalid={!!errors.file}
												errorText={errors.file?.message}
											>
												<FileUploadRoot
													maxFiles={1}
													maxFileSize={100 * 1024 * 1024}
													accept={ACCEPTED_FORMATS}
													width="100%"
													onFileChange={(e) => {
														field.onChange(e.acceptedFiles);
													}}
												>
													<FileUploadDropzone
														label="Drag and drop your book here"
														description="EPUB, PDF, MOBI up to 100MB"
														minW="full"
													/>
													<FileUploadList showSize clearable />
												</FileUploadRoot>
											</Field>
										)}
									/>
								</Stack>
							</Fieldset.Content>
						</Fieldset.Root>
					</form>
				</DialogBody>
				<DialogFooter>
					<Button
						variant="outline"
						onClick={handleClose}
						disabled={isSubmitting}
					>
						Cancel
					</Button>
					<Button
						type="submit"
						form="upload-book-form"
						colorPalette="blue"
						loading={isSubmitting}
					>
						Upload
					</Button>
				</DialogFooter>
				<DialogCloseTrigger onClick={handleClose} />
			</DialogContent>
		</DialogRoot>
	);
}
