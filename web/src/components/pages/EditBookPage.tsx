"use client";

import {
	COVER_UPLOAD_ACCEPT,
	MAX_COVER_UPLOAD_BYTES,
} from "@calibre-web-serverless/domain/models/bookCover";
import {
	type Identifier,
	IdentifierType,
} from "@calibre-web-serverless/domain/models/identifier";
import { Language } from "@calibre-web-serverless/domain/models/language";
import {
	Badge,
	Box,
	Button,
	Combobox,
	Container,
	Fieldset,
	FormatByte,
	Grid,
	Heading,
	HStack,
	Image,
	Input,
	Portal,
	RatingGroup,
	Skeleton,
	Span,
	Stack,
	TagsInput,
	Text,
	Textarea,
	useCombobox,
	useFilter,
	useListCollection,
	useTagsInput,
	VStack,
	Wrap,
} from "@chakra-ui/react";
import {
	useCallback,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";
import { Controller, FormProvider, useForm } from "react-hook-form";
import {
	LuArrowLeft,
	LuBook,
	LuImageUp,
	LuRotateCcw,
	LuTrash2,
	LuUndo2,
} from "react-icons/lu";
import {
	IdentifierFieldArray,
	type IdentifierFormData,
} from "@/components/IdentifierFieldArray";
import { Alert } from "@/components/ui/alert";
import {
	ComboboxContent,
	ComboboxControl,
	ComboboxEmpty,
	ComboboxItem,
	ComboboxItemText,
	ComboboxLabel,
} from "@/components/ui/combobox";
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
import { FileUploadRoot, FileUploadTrigger } from "@/components/ui/file-upload";
import {
	NumberInputField,
	NumberInputRoot,
} from "@/components/ui/number-input";
import {
	TagsInputInput,
	TagsInputItemPreview,
	TagsInputItemText,
	TagsInputLabel,
	TagsInputRootProvider,
} from "@/components/ui/tags-input";
import { toaster } from "@/components/ui/toaster";
import {
	isNewItemValue,
	useCreatableCombobox,
} from "@/hooks/useCreatableCombobox";

interface BookEditFormData {
	title: string;
	sortTitle: string;
	authorNames: string[];
	seriesName: string;
	seriesIndex: number;
	tagNames: string[];
	description: string;
	publisher: string;
	pubDate: string;
	languages: string[];
	rating: number | null;
	identifiers: IdentifierFormData[];
}

/**
 * A pending cover change, applied together with the book metadata on save:
 * `upload` stages a new custom cover, `reset` reverts to the extracted cover,
 * `null` leaves the cover untouched.
 */
export type CoverChange =
	| { type: "upload"; file: File }
	| { type: "reset" }
	| null;

export interface UpdateBookParams {
	title: string;
	sortTitle: string | null;
	authorNames: string[];
	seriesName: string | null;
	seriesIndex: number;
	tagNames: string[];
	description: string | null;
	publisherName: string | null;
	pubDate: Date | null;
	languages: Language[];
	rating: number | null;
	identifiers: Identifier[];
	coverChange: CoverChange;
}

export interface BookEditData {
	title: string;
	sortTitle: string;
	authorNames: string[];
	seriesName: string;
	seriesIndex: number;
	tagNames: string[];
	description: string;
	publisherName: string;
	pubDate: Date | null;
	languages: Language[];
	rating: number | null;
	identifiers: Identifier[];
	format: string;
	fileSize: number;
}

export interface EditBookPageProps {
	book: BookEditData;
	/** URL of the currently saved cover (custom if active, else extracted). */
	coverUrl: string | null;
	coverLoading: boolean;
	/** URL of the metadata-extracted cover, shown when previewing a reset. */
	originalCoverUrl: string | null;
	/** Whether a custom cover is currently saved, enabling reset-to-original. */
	hasCustomCover: boolean;
	authorSuggestions: string[];
	seriesSuggestions: string[];
	tagSuggestions: string[];
	publisherNames: string[];
	onUpdateBook: (params: UpdateBookParams) => Promise<void>;
	onDeleteBook: () => Promise<void>;
	onCancel: () => void;
}

const ACCEPTED_COVER_EXT_LABEL = "PNG, JPEG, WebP";
const MAX_COVER_UPLOAD_MB = Math.round(MAX_COVER_UPLOAD_BYTES / (1024 * 1024));

interface CoverEditorProps {
	previewUrl: string | null;
	previewLoading: boolean;
	title: string;
	format: string;
	fileSize: number;
	/** A pending (unsaved) cover change exists. */
	changed: boolean;
	/** A saved custom cover can be reverted to the extracted one. */
	canResetToOriginal: boolean;
	disabled: boolean;
	onPickFile: (file: File) => void;
	onResetToOriginal: () => void;
	onUndo: () => void;
}

function CoverEditor({
	previewUrl,
	previewLoading,
	title,
	format,
	fileSize,
	changed,
	canResetToOriginal,
	disabled,
	onPickFile,
	onResetToOriginal,
	onUndo,
}: CoverEditorProps) {
	const handleFileChange = useCallback(
		(details: {
			acceptedFiles: File[];
			rejectedFiles: { file: File; errors: string[] }[];
		}) => {
			const rejected = details.rejectedFiles[0];
			if (rejected) {
				const tooLarge = rejected.errors.includes("FILE_TOO_LARGE");
				toaster.error({
					title: "Couldn't use that image",
					description: tooLarge
						? `Image must be ${MAX_COVER_UPLOAD_MB} MB or smaller.`
						: `Use a supported image type (${ACCEPTED_COVER_EXT_LABEL}).`,
				});
				return;
			}

			const file = details.acceptedFiles[0];
			if (file) onPickFile(file);
		},
		[onPickFile],
	);

	return (
		<Box>
			<Box
				position="relative"
				bg="bg.muted"
				aspectRatio={2 / 3}
				borderRadius="md"
				display="flex"
				alignItems="center"
				justifyContent="center"
				flexDirection="column"
				gap={2}
				overflow="hidden"
			>
				{previewLoading ? (
					<Skeleton width="100%" height="100%" />
				) : previewUrl ? (
					<Image
						src={previewUrl}
						alt={title || "Book cover"}
						width="100%"
						height="100%"
						objectFit="cover"
					/>
				) : (
					<>
						<LuBook size={64} color="var(--chakra-colors-fg-muted)" />
						<Text color="fg.muted" fontSize="sm">
							Cover image
						</Text>
					</>
				)}
			</Box>
			<Text color="fg.muted" fontSize="xs" mt={2} textAlign="center">
				{format.toUpperCase()} &bull; <FormatByte value={fileSize} />
			</Text>

			<Stack gap={2} mt={3}>
				<FileUploadRoot
					maxFiles={1}
					maxFileSize={MAX_COVER_UPLOAD_BYTES}
					accept={COVER_UPLOAD_ACCEPT}
					disabled={disabled}
					onFileChange={handleFileChange}
				>
					<FileUploadTrigger asChild>
						<Button
							variant="outline"
							size="sm"
							width="full"
							disabled={disabled}
						>
							<LuImageUp />
							Upload cover
						</Button>
					</FileUploadTrigger>
				</FileUploadRoot>
				{canResetToOriginal && (
					<Button
						variant="ghost"
						size="sm"
						width="full"
						disabled={disabled}
						onClick={onResetToOriginal}
					>
						<LuRotateCcw />
						Reset to original
					</Button>
				)}
				{changed && (
					<Button
						variant="ghost"
						size="sm"
						width="full"
						disabled={disabled}
						onClick={onUndo}
					>
						<LuUndo2 />
						Undo change
					</Button>
				)}
				<Text color="fg.muted" fontSize="xs" textAlign="center">
					{ACCEPTED_COVER_EXT_LABEL} up to {MAX_COVER_UPLOAD_MB} MB
					{changed && " · saved when you click Save"}
				</Text>
			</Stack>
		</Box>
	);
}

export function EditBookPage({
	book,
	coverUrl,
	coverLoading,
	originalCoverUrl,
	hasCustomCover,
	authorSuggestions,
	seriesSuggestions,
	tagSuggestions,
	publisherNames,
	onUpdateBook,
	onDeleteBook,
	onCancel: onBack,
}: EditBookPageProps) {
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [coverChange, setCoverChange] = useState<CoverChange>(null);

	// Show a local preview of the pending cover until the form is saved.
	const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(
		null,
	);
	useEffect(() => {
		if (coverChange?.type === "upload") {
			const url = URL.createObjectURL(coverChange.file);
			setPendingPreviewUrl(url);
			return () => URL.revokeObjectURL(url);
		}
		setPendingPreviewUrl(null);
	}, [coverChange]);

	const coverPreviewUrl =
		coverChange?.type === "upload"
			? pendingPreviewUrl
			: coverChange?.type === "reset"
				? originalCoverUrl
				: coverUrl;
	const coverDirty = coverChange !== null;
	// The preview already shows the extracted original when resetting, or when no
	// custom cover is saved and nothing is staged. Offer reset only otherwise.
	const coverPreviewIsOriginal =
		coverChange?.type === "reset" || (coverChange === null && !hasCustomCover);

	const handlePickCover = useCallback((file: File) => {
		setCoverChange({ type: "upload", file });
	}, []);
	const handleResetCover = useCallback(() => {
		setCoverChange({ type: "reset" });
	}, []);
	const handleUndoCover = useCallback(() => {
		setCoverChange(null);
	}, []);
	const methods = useForm<BookEditFormData>({
		defaultValues: {
			title: "",
			sortTitle: "",
			authorNames: [],
			seriesName: "",
			seriesIndex: 1,
			tagNames: [],
			description: "",
			publisher: "",
			pubDate: "",
			languages: [],
			rating: 0,
			identifiers: [],
		},
	});

	const {
		register,
		handleSubmit,
		reset,
		control,
		watch,
		setValue,
		setError,
		formState: { errors, isSubmitting, isDirty },
	} = methods;

	const { contains } = useFilter({ sensitivity: "base" });

	const watchedAuthorNames = watch("authorNames");
	const watchedTagNames = watch("tagNames");
	const watchedLanguages = watch("languages");

	const authorUid = useId();
	const authorItems = authorSuggestions;
	const { collection: authorCollection, filter: filterAuthors } =
		useListCollection({
			initialItems: authorItems,
			filter: contains,
		});
	const authorTags = useTagsInput({
		value: watchedAuthorNames,
		onValueChange: (e) =>
			setValue("authorNames", e.value, { shouldDirty: true }),
		ids: {
			input: `author_input_${authorUid}`,
			control: `author_control_${authorUid}`,
		},
	});
	const authorCombobox = useCombobox({
		ids: {
			input: `author_input_${authorUid}`,
			control: `author_control_${authorUid}`,
		},
		collection: authorCollection,
		onInputValueChange: (e) => filterAuthors(e.inputValue),
		value: [],
		allowCustomValue: true,
		onValueChange: (e) => {
			if (e.value[0]) {
				authorTags.addValue(e.value[0]);
			}
		},
		selectionBehavior: "clear",
	});

	const seriesItems = useMemo(
		() => seriesSuggestions.map((s) => ({ label: s, value: s })),
		[seriesSuggestions],
	);
	const seriesCombobox = useCreatableCombobox({
		initialItems: seriesItems,
		onCreateItem: () => {},
		createOptionMode: "prepend",
	});

	const tagUid = useId();
	const tagItems = tagSuggestions;
	const { collection: tagCollection, filter: filterTags } = useListCollection({
		initialItems: tagItems,
		filter: contains,
	});
	const tagTags = useTagsInput({
		value: watchedTagNames,
		onValueChange: (e) => setValue("tagNames", e.value, { shouldDirty: true }),
		ids: { input: `tag_input_${tagUid}`, control: `tag_control_${tagUid}` },
	});
	const tagCombobox = useCombobox({
		ids: { input: `tag_input_${tagUid}`, control: `tag_control_${tagUid}` },
		collection: tagCollection,
		onInputValueChange: (e) => filterTags(e.inputValue),
		value: [],
		allowCustomValue: true,
		onValueChange: (e) => {
			if (e.value[0]) {
				tagTags.addValue(e.value[0]);
			}
		},
		selectionBehavior: "clear",
	});

	const publisherItems = useMemo(
		() => publisherNames.map((p) => ({ label: p, value: p })),
		[publisherNames],
	);
	const publisherCombobox = useCreatableCombobox({
		initialItems: publisherItems,
		onCreateItem: () => {},
		createOptionMode: "prepend",
	});

	const languageItems = useMemo(
		() => Language.all().map((l) => ({ label: l.name, value: l.name })),
		[],
	);
	const { collection: languageCollection, filter: filterLanguages } =
		useListCollection<{ label: string; value: string }>({
			initialItems: languageItems,
			filter: contains,
			itemToString: (item) => item.label,
			itemToValue: (item) => item.value,
		});
	const languageCombobox = useCombobox({
		collection: languageCollection,
		onInputValueChange: (e) => filterLanguages(e.inputValue),
		multiple: true,
		value: watchedLanguages,
		onValueChange: (e) => {
			setValue("languages", e.value, { shouldDirty: true });
		},
	});

	const seriesComboboxRef = useRef(seriesCombobox);
	seriesComboboxRef.current = seriesCombobox;
	const publisherComboboxRef = useRef(publisherCombobox);
	publisherComboboxRef.current = publisherCombobox;

	useEffect(() => {
		if (book) {
			reset({
				title: book.title,
				sortTitle: book.sortTitle,
				authorNames: book.authorNames,
				seriesName: book.seriesName,
				seriesIndex: book.seriesIndex,
				tagNames: book.tagNames,
				description: book.description,
				publisher: book.publisherName,
				pubDate: book.pubDate ? book.pubDate.toISOString().split("T")[0] : "",
				languages: book.languages.map((l) => l.name),
				rating: book.rating ?? 0,
				identifiers: book.identifiers.map((id) => ({
					type: id.type.value,
					value: id.value,
				})),
			});
			seriesComboboxRef.current.setInputValue(book.seriesName);
			publisherComboboxRef.current.setInputValue(book.publisherName);
		}
	}, [book, reset]);

	const handleBack = useCallback(() => {
		if (isDirty || coverDirty) {
			const confirmed = window.confirm(
				"You have unsaved changes. Are you sure you want to leave without saving?",
			);
			if (!confirmed) {
				return;
			}
		}
		onBack();
	}, [isDirty, coverDirty, onBack]);

	useEffect(() => {
		const handleBeforeUnload = (e: BeforeUnloadEvent) => {
			if (isDirty || coverDirty) {
				e.preventDefault();
			}
		};

		window.addEventListener("beforeunload", handleBeforeUnload);
		return () => window.removeEventListener("beforeunload", handleBeforeUnload);
	}, [isDirty, coverDirty]);

	const onSubmit = async (data: BookEditFormData) => {
		const allLangs = Language.all();
		const languages = data.languages.flatMap((name) => {
			const lang = allLangs.find((l) => l.name === name);
			return lang ? [lang] : [];
		});

		const identifiers: Identifier[] = data.identifiers
			.filter((id) => id.type && id.value)
			.flatMap((id) => {
				const type = IdentifierType.from(id.type);
				return type ? [{ type, value: id.value }] : [];
			});

		try {
			await onUpdateBook({
				title: data.title,
				sortTitle: data.sortTitle || null,
				authorNames: data.authorNames,
				seriesName: seriesCombobox.inputValue || null,
				seriesIndex: data.seriesIndex,
				tagNames: data.tagNames,
				description: data.description || null,
				publisherName: publisherCombobox.inputValue || null,
				pubDate: data.pubDate ? new Date(data.pubDate) : null,
				languages,
				rating: data.rating || null,
				identifiers,
				coverChange,
			});
		} catch {
			setError("root", {
				message: "Failed to update book. Please try again.",
			});
		}
	};

	const handleDelete = useCallback(async () => {
		setIsDeleting(true);
		try {
			await onDeleteBook();
		} catch {
			setError("root", {
				message: "Failed to delete book. Please try again.",
			});
			setIsDeleteDialogOpen(false);
		} finally {
			setIsDeleting(false);
		}
	}, [onDeleteBook, setError]);

	return (
		<Container maxW="container.lg" py={8}>
			<VStack gap={6} align="stretch">
				<HStack>
					<Button variant="ghost" onClick={handleBack}>
						<LuArrowLeft />
						Back
					</Button>
				</HStack>

				<Heading size="xl">Edit Book</Heading>

				{errors.root && <Alert status="error" title={errors.root.message} />}

				<FormProvider {...methods}>
					<form noValidate onSubmit={handleSubmit(onSubmit)}>
						<Grid templateColumns={{ base: "1fr", md: "200px 1fr" }} gap={8}>
							<CoverEditor
								previewUrl={coverPreviewUrl}
								previewLoading={!coverDirty && coverLoading}
								title={book.title}
								format={book.format}
								fileSize={book.fileSize}
								changed={coverDirty}
								canResetToOriginal={!coverPreviewIsOriginal}
								disabled={isSubmitting}
								onPickFile={handlePickCover}
								onResetToOriginal={handleResetCover}
								onUndo={handleUndoCover}
							/>

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
													validate: (value) =>
														value.trim() !== "" || "Title cannot be empty",
												})}
											/>
										</Field>

										<Field
											label="Sort Title"
											helperText="Used for sorting (e.g., 'Lord of the Rings, The')"
										>
											<Input
												placeholder="Enter sort title"
												{...register("sortTitle")}
											/>
										</Field>

										<Combobox.RootProvider value={authorCombobox}>
											<TagsInputRootProvider value={authorTags}>
												<TagsInputLabel>Authors</TagsInputLabel>
												<TagsInput.Control>
													{authorTags.value.map((name, index) => (
														<TagsInput.Item
															key={name}
															index={index}
															value={name}
														>
															<TagsInputItemPreview>
																<TagsInputItemText>{name}</TagsInputItemText>
																<TagsInput.ItemDeleteTrigger />
															</TagsInputItemPreview>
														</TagsInput.Item>
													))}
													<Combobox.Input unstyled asChild>
														<TagsInputInput placeholder="Add author..." />
													</Combobox.Input>
												</TagsInput.Control>
												<Portal>
													<Combobox.Positioner>
														<Combobox.Content>
															{authorCollection.items.length === 0 ? (
																<Box p={2} color="fg.muted" fontSize="sm">
																	No authors found
																</Box>
															) : (
																authorCollection.items.map((item) => (
																	<Combobox.Item item={item} key={item}>
																		{!authorSuggestions.includes(item) && "+ "}
																		<ComboboxItemText>{item}</ComboboxItemText>
																		<Combobox.ItemIndicator />
																	</Combobox.Item>
																))
															)}
														</Combobox.Content>
													</Combobox.Positioner>
												</Portal>
											</TagsInputRootProvider>
										</Combobox.RootProvider>

										<Grid
											templateColumns={{ base: "1fr", sm: "1fr auto" }}
											gap={4}
										>
											<Combobox.RootProvider value={seriesCombobox}>
												<Combobox.Label>Series</Combobox.Label>
												<Combobox.Control>
													<Combobox.Input placeholder="Select or create series..." />
													<Combobox.IndicatorGroup>
														<Combobox.ClearTrigger />
														<Combobox.Trigger />
													</Combobox.IndicatorGroup>
												</Combobox.Control>
												<Portal>
													<Combobox.Positioner>
														<Combobox.Content>
															{seriesCombobox.collection.items.map((item) => (
																<Combobox.Item key={item.value} item={item}>
																	{isNewItemValue(item.value) ? (
																		<Combobox.ItemText>
																			{`+ Create "${item.label}"`}
																		</Combobox.ItemText>
																	) : (
																		<HStack justify="space-between" flex="1">
																			<Combobox.ItemText flex="1">
																				{item.label}
																			</Combobox.ItemText>
																			{item.isNew && (
																				<Span textStyle="xs">NEW</Span>
																			)}
																		</HStack>
																	)}
																	<Combobox.ItemIndicator />
																</Combobox.Item>
															))}
														</Combobox.Content>
													</Combobox.Positioner>
												</Portal>
											</Combobox.RootProvider>

											<Field label="Series Index">
												<Controller
													name="seriesIndex"
													control={control}
													render={({ field }) => (
														<NumberInputRoot
															min={1}
															value={String(field.value)}
															onValueChange={({ value }) =>
																field.onChange(Number(value))
															}
														>
															<NumberInputField
																placeholder="#"
																onBlur={field.onBlur}
															/>
														</NumberInputRoot>
													)}
												/>
											</Field>
										</Grid>

										<Combobox.RootProvider value={tagCombobox}>
											<TagsInputRootProvider value={tagTags}>
												<TagsInputLabel>Tags</TagsInputLabel>
												<TagsInput.Control>
													{tagTags.value.map((name, index) => (
														<TagsInput.Item
															key={name}
															index={index}
															value={name}
														>
															<TagsInputItemPreview>
																<TagsInputItemText>{name}</TagsInputItemText>
																<TagsInput.ItemDeleteTrigger />
															</TagsInputItemPreview>
														</TagsInput.Item>
													))}
													<Combobox.Input unstyled asChild>
														<TagsInputInput placeholder="Add tag..." />
													</Combobox.Input>
												</TagsInput.Control>
												<Portal>
													<Combobox.Positioner>
														<Combobox.Content>
															{tagCollection.items.length === 0 ? (
																<Box p={2} color="fg.muted" fontSize="sm">
																	No tags found
																</Box>
															) : (
																tagCollection.items.map((item) => (
																	<Combobox.Item item={item} key={item}>
																		{!tagSuggestions.includes(item) && "+ "}
																		<ComboboxItemText>{item}</ComboboxItemText>
																		<Combobox.ItemIndicator />
																	</Combobox.Item>
																))
															)}
														</Combobox.Content>
													</Combobox.Positioner>
												</Portal>
											</TagsInputRootProvider>
										</Combobox.RootProvider>

										<Field label="Description">
											<Textarea
												placeholder="Enter book description"
												rows={4}
												{...register("description")}
											/>
										</Field>

										<Grid
											templateColumns={{ base: "1fr", sm: "1fr 1fr" }}
											gap={4}
										>
											<Combobox.RootProvider value={publisherCombobox}>
												<Combobox.Label>Publisher</Combobox.Label>
												<Combobox.Control>
													<Combobox.Input placeholder="Select or enter publisher..." />
													<Combobox.IndicatorGroup>
														<Combobox.ClearTrigger />
														<Combobox.Trigger />
													</Combobox.IndicatorGroup>
												</Combobox.Control>
												<Portal>
													<Combobox.Positioner>
														<Combobox.Content>
															{publisherCombobox.collection.items.map(
																(item) => (
																	<Combobox.Item key={item.value} item={item}>
																		{isNewItemValue(item.value) ? (
																			<Combobox.ItemText>
																				+ Create "{item.label}"
																			</Combobox.ItemText>
																		) : (
																			<HStack justify="space-between" flex="1">
																				<Combobox.ItemText flex="1">
																					{item.label}
																				</Combobox.ItemText>
																				{item.isNew && (
																					<Span textStyle="xs">NEW</Span>
																				)}
																			</HStack>
																		)}
																		<Combobox.ItemIndicator />
																	</Combobox.Item>
																),
															)}
														</Combobox.Content>
													</Combobox.Positioner>
												</Portal>
											</Combobox.RootProvider>

											<Field label="Publication Date">
												<Input type="date" {...register("pubDate")} />
											</Field>
										</Grid>

										<Combobox.RootProvider value={languageCombobox}>
											<ComboboxLabel>Languages</ComboboxLabel>
											{watchedLanguages.length > 0 && (
												<Wrap gap={2} mb={2}>
													{watchedLanguages.map((name) => (
														<Badge key={name} size="md">
															{name}
														</Badge>
													))}
												</Wrap>
											)}
											<ComboboxControl clearable>
												<Combobox.Input placeholder="Add language..." />
											</ComboboxControl>
											<ComboboxContent>
												{languageCollection.items.map((item) => (
													<ComboboxItem item={item} key={item.value}>
														<ComboboxItemText>{item.label}</ComboboxItemText>
													</ComboboxItem>
												))}
												<ComboboxEmpty>No languages found</ComboboxEmpty>
											</ComboboxContent>
										</Combobox.RootProvider>

										<Field label="Rating">
											<Controller
												control={control}
												name="rating"
												render={({ field }) => (
													<RatingGroup.Root
														count={5}
														value={field.value ?? undefined}
														onValueChange={(e) => field.onChange(e.value)}
													>
														<RatingGroup.HiddenInput />
														<RatingGroup.Control />
													</RatingGroup.Root>
												)}
											/>
										</Field>

										<Heading size="md" mt={4}>
											Identifiers
										</Heading>

										<IdentifierFieldArray />
									</Stack>
								</Fieldset.Content>
							</Fieldset.Root>
						</Grid>

						<Box
							position="sticky"
							bottom={0}
							bg="bg"
							borderTopWidth="1px"
							py={4}
							mt={4}
							mx={-4}
							px={4}
						>
							<HStack justify="space-between">
								<Button
									variant="outline"
									colorPalette="red"
									onClick={() => setIsDeleteDialogOpen(true)}
								>
									<LuTrash2 />
									Delete
								</Button>
								<HStack>
									<Button variant="outline" onClick={handleBack}>
										Cancel
									</Button>
									<Button
										type="submit"
										colorPalette="blue"
										loading={isSubmitting}
									>
										Save
									</Button>
								</HStack>
							</HStack>
						</Box>
					</form>
				</FormProvider>

				<DialogRoot
					role="alertdialog"
					open={isDeleteDialogOpen}
					onOpenChange={(e) => {
						if (!isDeleting) {
							setIsDeleteDialogOpen(e.open);
						}
					}}
				>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Delete Book</DialogTitle>
						</DialogHeader>
						<DialogBody>
							<Text>
								Are you sure you want to delete{" "}
								<Span fontWeight="semibold">{book.title || "this book"}</Span>?
								This action cannot be undone.
							</Text>
						</DialogBody>
						<DialogFooter>
							<Button
								variant="outline"
								onClick={() => setIsDeleteDialogOpen(false)}
								disabled={isDeleting}
							>
								Cancel
							</Button>
							<Button
								colorPalette="red"
								onClick={handleDelete}
								loading={isDeleting}
							>
								Delete
							</Button>
						</DialogFooter>
						<DialogCloseTrigger disabled={isDeleting} />
					</DialogContent>
				</DialogRoot>
			</VStack>
		</Container>
	);
}
