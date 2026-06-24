"use client";

import {
	Combobox,
	TagsInput,
	Text,
	useCombobox,
	useFilter,
	useListCollection,
	useTagsInput,
} from "@chakra-ui/react";
import { type RefObject, useEffect, useId } from "react";
import {
	ComboboxContent,
	ComboboxEmpty,
	ComboboxItem,
	ComboboxItemText,
} from "@/components/ui/combobox";
import {
	TagsInputInput,
	TagsInputItemPreview,
	TagsInputItemText,
	TagsInputLabel,
	TagsInputRootProvider,
} from "@/components/ui/tags-input";
import type { FacetOption } from "@/lib/bookFacets";

interface ComboboxFilterSectionProps {
	label: string;
	options: FacetOption[];
	selected: string[];
	onChange: (next: string[]) => void;
	placeholder?: string;
	disabled?: boolean;
	helperText?: string;
	/**
	 * Container to portal the dropdown into. Inside a drawer this must point at
	 * the drawer content, otherwise clicking an option (portalled to the body by
	 * default) registers as an outside click and dismisses the drawer.
	 */
	portalRef?: RefObject<HTMLElement | null>;
}

/**
 * A multi-select combobox (text box + autocomplete) for one filter dimension,
 * mirroring the book edit form: selected values are shown as removable tags
 * inside the input itself, and typing filters the options. Selections are
 * driven through the combobox so only known option ids can be added — free text
 * typed into the box is rejected.
 */
export function ComboboxFilterSection({
	label,
	options,
	selected,
	onChange,
	placeholder,
	disabled = false,
	helperText,
	portalRef,
}: ComboboxFilterSectionProps) {
	const uid = useId();
	const ids = { input: `${uid}-input`, control: `${uid}-control` };

	const { contains } = useFilter({ sensitivity: "base" });
	const { collection, filter, set } = useListCollection<FacetOption>({
		initialItems: options,
		filter: contains,
		itemToString: (item) => item.label,
		itemToValue: (item) => item.value,
	});

	// Options arrive asynchronously (entities load after first render), so keep
	// the collection in sync as they change.
	useEffect(() => {
		set(options);
	}, [options, set]);

	const labelOf = (value: string): string =>
		options.find((option) => option.value === value)?.label ?? value;

	const tags = useTagsInput({
		ids,
		value: selected,
		disabled,
		editable: false,
		onValueChange: (details) => onChange(details.value),
		// Only ids that exist as options may be added. Combobox selection passes
		// the option id (accepted); free text typed into the box passes a label
		// that is not an id (rejected).
		validate: ({ inputValue }) =>
			options.some((option) => option.value === inputValue),
	});

	const combobox = useCombobox({
		ids,
		collection,
		disabled,
		value: [],
		selectionBehavior: "clear",
		onInputValueChange: (details) => filter(details.inputValue),
		onValueChange: (details) => {
			const value = details.value[0];
			if (value) {
				tags.addValue(value);
			}
		},
	});

	return (
		<Combobox.RootProvider value={combobox}>
			<TagsInputRootProvider value={tags}>
				<TagsInputLabel>{label}</TagsInputLabel>
				<TagsInput.Control>
					{tags.value.map((value, index) => (
						<TagsInput.Item key={value} index={index} value={value}>
							<TagsInputItemPreview>
								<TagsInputItemText>{labelOf(value)}</TagsInputItemText>
								<TagsInput.ItemDeleteTrigger
									aria-label={`Remove ${labelOf(value)}`}
								/>
							</TagsInputItemPreview>
						</TagsInput.Item>
					))}
					<Combobox.Input unstyled asChild>
						<TagsInputInput placeholder={placeholder} />
					</Combobox.Input>
				</TagsInput.Control>
				{helperText && (
					<Text fontSize="sm" color="fg.muted" mt={1}>
						{helperText}
					</Text>
				)}
				<ComboboxContent portalRef={portalRef}>
					<ComboboxEmpty>No matches</ComboboxEmpty>
					{collection.items.map((item) => (
						<ComboboxItem item={item} key={item.value}>
							<ComboboxItemText>{item.label}</ComboboxItemText>
						</ComboboxItem>
					))}
				</ComboboxContent>
			</TagsInputRootProvider>
		</Combobox.RootProvider>
	);
}
