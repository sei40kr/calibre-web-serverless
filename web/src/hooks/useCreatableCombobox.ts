import {
	type Combobox,
	createListCollection,
	useCombobox,
	useFilter,
} from "@chakra-ui/react";
import { useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";

interface Item {
	label: string;
	value: string;
	isNew?: boolean;
}

type CreateOptionMode = "append" | "prepend";

const NEW_ITEM_VALUE = "[[new]]";

const createNewItem = (value: string): Item => ({
	label: value,
	value: NEW_ITEM_VALUE,
});

const replaceNewItemValue = (values: string[], value: string) =>
	values.map((v) => (v === NEW_ITEM_VALUE ? value : v));

const getNewItemData = (inputValue: string): Item => ({
	label: inputValue,
	value: inputValue,
	isNew: true,
});

const updateItems = (v: Item[], i: Item, mode: CreateOptionMode) => {
	return mode === "prepend" ? [i, ...v] : [...v, i];
};

export const isNewItemValue = (value: string) => value === NEW_ITEM_VALUE;

export interface UseCreatableComboboxProps {
	initialItems: Item[];
	onCreateItem: (item: Item) => void;
	createOptionMode: CreateOptionMode;
}

export const useCreatableCombobox = (props: UseCreatableComboboxProps) => {
	const { initialItems, onCreateItem, createOptionMode } = props;

	const [items, setItems] = useState<Item[]>(initialItems);
	const itemsRef = useRef<Item[]>(initialItems);

	const { contains } = useFilter({ sensitivity: "base" });

	const filterFn = (item: Item, query: string) =>
		!isNewItemValue(item.value) && contains(item.label, query);

	const [selectedValue, setSelectedValue] = useState<string[]>([]);

	const collection = useMemo(
		() =>
			createListCollection({
				items,
				itemToString: (item) => item.label,
				itemToValue: (item) => item.value,
			}),
		[items],
	);

	const isValidNewItem = (inputValue: string) => {
		const exactOptionMatch =
			items.filter(
				(item) => item.label.toLowerCase() === inputValue.toLowerCase(),
			).length > 0;
		return !exactOptionMatch && inputValue.trim().length > 0;
	};

	const filter = (query: string) => {
		if (isValidNewItem(query)) {
			const newItem = createNewItem(query);
			const filtered = itemsRef.current.filter((item) => filterFn(item, query));
			setItems(updateItems(filtered, newItem, createOptionMode));
			return;
		}

		if (query.trim().length === 0) {
			setItems(itemsRef.current);
		} else {
			const filtered = itemsRef.current.filter((item) => filterFn(item, query));
			setItems(filtered);
		}
	};

	const selectNewItem = (inputValue: string) => {
		const newItem = getNewItemData(inputValue);
		const filtered = itemsRef.current.filter(
			(item) => !isNewItemValue(item.value),
		);

		itemsRef.current = updateItems(filtered, newItem, createOptionMode);
		setItems(itemsRef.current);
		onCreateItem?.(newItem);
	};

	const combobox = useCombobox({
		collection,
		allowCustomValue: true,
		onInputValueChange: (details: Combobox.InputValueChangeDetails) => {
			const { inputValue, reason } = details;
			if (reason === "input-change" || reason === "item-select") {
				flushSync(() => filter(inputValue));
			}
		},
		onOpenChange(details) {
			const { reason, open } = details;
			if (reason === "trigger-click") {
				setItems(itemsRef.current);
			}

			if (!open && selectedValue.length > 0) {
				const inputValue = collection.stringify(selectedValue[0]) || "";
				combobox.setInputValue(inputValue);
			}
		},
		value: selectedValue,
		onValueChange(details) {
			const { value } = details;
			const inputValue = combobox.inputValue;
			setSelectedValue(replaceNewItemValue(value, inputValue));
			if (value.includes(NEW_ITEM_VALUE)) {
				selectNewItem(inputValue);
			}
		},
	});

	return combobox;
};
