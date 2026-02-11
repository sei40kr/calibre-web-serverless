"use client";

import { StorageError } from "@calibre-web-serverless/domain/errors/storageError";
import type { User } from "@calibre-web-serverless/domain/models/user";
import { bookRepository } from "@calibre-web-serverless/infrastructure/repositories/bookRepository";
import { Button, Fieldset, Spinner, Stack, Text } from "@chakra-ui/react";
import { useId, useRef, useState } from "react";
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

interface BookUploadFormData {
	file: File[];
}

interface UploadBookDialogProps {
	user: User;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess?: () => void;
}

const ACCEPTED_FORMATS = ".epub,.pdf,.mobi,.azw,.azw3,.fb2,.txt";
const PROCESSING_TIMEOUT_MS = 120_000;

export function UploadBookDialog({
	user,
	open,
	onOpenChange,
	onSuccess,
}: UploadBookDialogProps) {
	const formId = useId();
	const [uploadError, setUploadError] = useState<string | null>(null);
	const [processing, setProcessing] = useState(false);
	const unsubscribeRef = useRef<(() => void) | null>(null);
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const {
		control,
		handleSubmit,
		reset,
		formState: { errors, isSubmitting },
	} = useForm<BookUploadFormData>({
		defaultValues: {
			file: [],
		},
	});

	const cleanup = () => {
		if (unsubscribeRef.current) {
			unsubscribeRef.current();
			unsubscribeRef.current = null;
		}
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
			timeoutRef.current = null;
		}
	};

	const onSubmit = async (data: BookUploadFormData) => {
		setUploadError(null);

		if (data.file.length === 0) {
			setUploadError("Please select a file to upload");
			return;
		}

		try {
			const { bookId } = await bookRepository.uploadBook({
				userId: user.uid,
				file: data.file[0],
			});

			// Subscribe to book doc and wait for processing to complete
			setProcessing(true);

			await new Promise<void>((resolve, reject) => {
				timeoutRef.current = setTimeout(() => {
					cleanup();
					reject(
						new Error(
							"Processing timed out. The book may still be processing in the background.",
						),
					);
				}, PROCESSING_TIMEOUT_MS);

				unsubscribeRef.current = bookRepository.subscribeToBook(
					user.uid,
					bookId,
					{
						onData: (book) => {
							if (book.status === "ready") {
								cleanup();
								toaster.success({
									title: "Book uploaded",
									description: `"${book.title}" has been added to your library.`,
								});
								resolve();
							} else if (book.status === "error") {
								cleanup();
								reject(
									new Error(book.errorMessage || "Failed to process book"),
								);
							}
						},
						onError: (err) => {
							cleanup();
							reject(err);
						},
					},
				);
			});

			setProcessing(false);
			reset();
			onOpenChange(false);
			onSuccess?.();
		} catch (error) {
			setProcessing(false);
			if (error instanceof StorageError) {
				switch (error.code) {
					case "unauthorized":
						setUploadError("You don't have permission to upload files");
						break;
					case "canceled":
						setUploadError("Upload was cancelled");
						break;
					case "quota-exceeded":
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
		if (!isSubmitting && !processing) {
			cleanup();
			reset();
			setUploadError(null);
			setProcessing(false);
			onOpenChange(false);
		}
	};

	const isBusy = isSubmitting || processing;

	return (
		<DialogRoot
			open={open}
			onOpenChange={(e) => !isBusy && onOpenChange(e.open)}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Upload Book</DialogTitle>
				</DialogHeader>
				<DialogBody>
					{uploadError && <Alert status="error" title={uploadError} mb={4} />}

					{processing ? (
						<Stack align="center" gap={4} py={8}>
							<Spinner size="lg" />
							<Text color="fg.muted">Processing book metadata...</Text>
						</Stack>
					) : (
						<form id={formId} noValidate onSubmit={handleSubmit(onSubmit)}>
							<Fieldset.Root disabled={isSubmitting}>
								<Fieldset.Content>
									<Stack gap={4}>
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
					)}
				</DialogBody>
				<DialogFooter>
					<Button variant="outline" onClick={handleClose} disabled={isBusy}>
						Cancel
					</Button>
					{!processing && (
						<Button
							type="submit"
							form={formId}
							colorPalette="blue"
							loading={isSubmitting}
						>
							Upload
						</Button>
					)}
				</DialogFooter>
				<DialogCloseTrigger onClick={handleClose} />
			</DialogContent>
		</DialogRoot>
	);
}
