"use client";

import {
	Button,
	HStack,
	IconButton,
	Input,
	NativeSelect,
	Stack,
	Text,
} from "@chakra-ui/react";
import { useCallback, useMemo } from "react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { LuPlus, LuTrash2 } from "react-icons/lu";
import { Field } from "@/components/ui/field";
import { IdentifierType, ISBN } from "@/models/identifier";

export interface IdentifierFormData {
	type: string;
	value: string;
}

interface IdentifierFormValues {
	identifiers: IdentifierFormData[];
}

export function IdentifierFieldArray() {
	const {
		register,
		formState: { errors },
	} = useFormContext<IdentifierFormValues>();

	const { fields, append, remove } = useFieldArray<IdentifierFormValues>({
		name: "identifiers",
	});

	const watchedIdentifiers: IdentifierFormData[] =
		(useWatch<IdentifierFormValues>({
			name: "identifiers",
		}) as IdentifierFormData[] | undefined) ?? [];

	const allIdentifierTypes = IdentifierType.all();

	const usedIdentifierTypeValues = useMemo(
		() => watchedIdentifiers.map((id) => id.type),
		[watchedIdentifiers],
	);

	const getAvailableTypesForIndex = useCallback(
		(currentIndex: number) => {
			const currentTypeValue = watchedIdentifiers[currentIndex]?.type;
			return allIdentifierTypes.filter(
				(type) =>
					type.value === currentTypeValue ||
					!usedIdentifierTypeValues.includes(type.value),
			);
		},
		[allIdentifierTypes, usedIdentifierTypeValues, watchedIdentifiers],
	);

	const firstUnusedType = useMemo(() => {
		return allIdentifierTypes.find(
			(type) => !usedIdentifierTypeValues.includes(type.value),
		);
	}, [allIdentifierTypes, usedIdentifierTypeValues]);

	const canAddIdentifier = useMemo(
		() => usedIdentifierTypeValues.length < allIdentifierTypes.length,
		[usedIdentifierTypeValues.length, allIdentifierTypes.length],
	);

	return (
		<Stack gap={2}>
			{fields.map((field, index) => {
				const availableTypes = getAvailableTypesForIndex(index);
				const currentTypeValue = watchedIdentifiers[index]?.type;
				const currentType = IdentifierType.from(currentTypeValue);
				return (
					<HStack key={field.id} gap={2} align="flex-start">
						<NativeSelect.Root width="140px" flexShrink={0}>
							<NativeSelect.Field
								{...register(`identifiers.${index}.type`, {
									required: true,
								})}
							>
								{availableTypes.map((type) => (
									<option key={type.value} value={type.value}>
										{type.name}
									</option>
								))}
							</NativeSelect.Field>
							<NativeSelect.Indicator />
						</NativeSelect.Root>
						<Field
							flex={1}
							invalid={!!errors.identifiers?.[index]?.value}
							errorText={errors.identifiers?.[index]?.value?.message}
						>
							<Input
								placeholder="Value"
								{...register(`identifiers.${index}.value`, {
									required: "Value is required",
									validate: (value) =>
										currentType?.validate(value) ?? "Unknown identifier type",
								})}
							/>
						</Field>
						<IconButton
							aria-label="Remove identifier"
							variant="ghost"
							size="sm"
							colorPalette="red"
							onClick={() => remove(index)}
						>
							<LuTrash2 />
						</IconButton>
					</HStack>
				);
			})}
			{fields.length === 0 && (
				<Text color="fg.muted" fontSize="sm">
					No identifiers added yet.
				</Text>
			)}
			<Button
				variant="ghost"
				size="sm"
				alignSelf="flex-start"
				disabled={!canAddIdentifier}
				onClick={() =>
					append({
						type: firstUnusedType?.value ?? ISBN.value,
						value: "",
					})
				}
			>
				<LuPlus />
				Add Identifier
			</Button>
		</Stack>
	);
}
