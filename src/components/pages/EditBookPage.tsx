"use client";

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
	Input,
	Portal,
	RatingGroup,
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
import { useCallback, useEffect, useId, useMemo, useRef } from "react";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { LuArrowLeft, LuBook } from "react-icons/lu";
import {
	IdentifierFieldArray,
	type IdentifierFormData,
} from "@/components/IdentifierFieldArray";
import {
	ComboboxContent,
	ComboboxControl,
	ComboboxEmpty,
	ComboboxItem,
	ComboboxItemText,
	ComboboxLabel,
} from "@/components/ui/combobox";
import { Field } from "@/components/ui/field";
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
import {
	isNewItemValue,
	useCreatableCombobox,
} from "@/hooks/useCreatableCombobox";
import { type Identifier, IdentifierType } from "@/models/identifier";
import { Language } from "@/models/language";

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
	authorSuggestions: string[];
	seriesSuggestions: string[];
	tagSuggestions: string[];
	publisherNames: string[];
	onUpdateBook: (params: UpdateBookParams) => Promise<void>;
	onCancel: (hasUnsavedChanges: boolean) => void;
	onSuccess: (title: string) => void;
	onHasUnsavedChangesChange: (hasUnsavedChanges: boolean) => void;
}

export function EditBookPage({
	book,
	authorSuggestions,
	seriesSuggestions,
	tagSuggestions,
	publisherNames,
	onUpdateBook,
	onCancel: onBack,
	onSuccess,
	onHasUnsavedChangesChange,
}: EditBookPageProps) {
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
		useListCollection({
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
		onBack(isDirty);
	}, [isDirty, onBack]);

	useEffect(() => {
		onHasUnsavedChangesChange(isDirty);
	}, [isDirty, onHasUnsavedChangesChange]);

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
		});

		onSuccess(data.title);
	};

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

				<FormProvider {...methods}>
					<form noValidate onSubmit={handleSubmit(onSubmit)}>
						<Grid templateColumns={{ base: "1fr", md: "200px 1fr" }} gap={8}>
							<Box>
								<Box
									bg="bg.muted"
									aspectRatio={2 / 3}
									borderRadius="md"
									display="flex"
									alignItems="center"
									justifyContent="center"
									flexDirection="column"
									gap={2}
								>
									<LuBook size={64} color="var(--chakra-colors-fg-muted)" />
									<Text color="fg.muted" fontSize="sm">
										Cover image
									</Text>
								</Box>
								<Text color="fg.muted" fontSize="xs" mt={2} textAlign="center">
									{book.format.toUpperCase()} &bull;{" "}
									<FormatByte value={book.fileSize} />
								</Text>
							</Box>

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
							<HStack justify="flex-end">
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
						</Box>
					</form>
				</FormProvider>
			</VStack>
		</Container>
	);
}
