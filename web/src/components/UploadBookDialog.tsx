"use client";

import { BOOK_FILE_FORMATS } from "@calibre-web-serverless/domain/models/bookFile";
import { Button, Fieldset, Stack } from "@chakra-ui/react";
import { useId, useState } from "react";
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

interface BookUploadFormData {
	files: File[];
}

interface UploadBookDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Called once with every selected file; the dialog closes right after. */
	onUpload: (files: File[]) => void;
}

const ACCEPTED_FORMATS = BOOK_FILE_FORMATS.map((f) => `.${f}`).join(",");
const MAX_FILES = 50;
const MAX_FILE_SIZE = 100 * 1024 * 1024;

const rejectionReason = (errors: string[]): string => {
	if (errors.includes("FILE_TOO_LARGE")) return "larger than 100MB";
	if (errors.includes("FILE_INVALID_TYPE")) return "unsupported format";
	if (errors.includes("TOO_MANY_FILES"))
		return `over the ${MAX_FILES}-file limit`;
	return "not accepted";
};

/**
 * Picks one or more book files and hands them off via `onUpload`. Transfer
 * and processing happen elsewhere so the dialog never blocks the page.
 */
export function UploadBookDialog({
	open,
	onOpenChange,
	onUpload,
}: UploadBookDialogProps) {
	const formId = useId();
	const [rejected, setRejected] = useState<string[]>([]);
	const {
		control,
		handleSubmit,
		reset,
		formState: { errors },
	} = useForm<BookUploadFormData>({
		defaultValues: {
			files: [],
		},
	});

	const close = () => {
		reset();
		setRejected([]);
		onOpenChange(false);
	};

	const onSubmit = (data: BookUploadFormData) => {
		onUpload(data.files);
		close();
	};

	return (
		<DialogRoot
			open={open}
			onOpenChange={(e) => {
				if (!e.open) close();
			}}
			lazyMount
			unmountOnExit
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Upload Books</DialogTitle>
				</DialogHeader>
				<DialogBody>
					{rejected.length > 0 && (
						<Alert status="warning" title="Some files were skipped" mb={4}>
							{rejected.join(", ")}
						</Alert>
					)}

					<form id={formId} noValidate onSubmit={handleSubmit(onSubmit)}>
						<Fieldset.Root>
							<Fieldset.Content>
								<Stack gap={4}>
									<Controller
										control={control}
										name="files"
										rules={{
											validate: (files) =>
												files.length > 0 || "Please select at least one file",
										}}
										render={({ field }) => (
											<Field
												label="Book Files"
												required
												invalid={!!errors.files}
												errorText={errors.files?.message}
											>
												<FileUploadRoot
													maxFiles={MAX_FILES}
													maxFileSize={MAX_FILE_SIZE}
													accept={ACCEPTED_FORMATS}
													width="100%"
													onFileChange={(e) => {
														field.onChange(e.acceptedFiles);
														setRejected(
															e.rejectedFiles.map(
																(r) =>
																	`${r.file.name} (${rejectionReason(r.errors)})`,
															),
														);
													}}
												>
													<FileUploadDropzone
														label="Drag and drop your books here"
														description="EPUB, PDF, MOBI up to 100MB each"
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
					<Button variant="outline" onClick={close}>
						Cancel
					</Button>
					<Button type="submit" form={formId} colorPalette="blue">
						Upload
					</Button>
				</DialogFooter>
				<DialogCloseTrigger />
			</DialogContent>
		</DialogRoot>
	);
}
