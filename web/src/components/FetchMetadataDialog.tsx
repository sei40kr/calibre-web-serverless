"use client";

import type {
	BookMetadataSearchResponse,
	BookMetadataSearchResult,
	BookMetadataSourceError,
} from "@calibre-web-serverless/domain/models/bookMetadataSearch";
import {
	Button,
	HStack,
	Input,
	Spinner,
	Stack,
	Text,
	VStack,
} from "@chakra-ui/react";
import { type FormEvent, useCallback, useEffect, useId, useState } from "react";
import { LuSearch, LuSearchX } from "react-icons/lu";
import { MetadataResultCard } from "@/components/MetadataResultCard";
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
import { EmptyState } from "@/components/ui/empty-state";

export interface FetchMetadataDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** The search box is prefilled with this value each time the dialog opens. */
	initialQuery: string;
	/** Run a search; rejects on transport failure. */
	onSearch: (query: string) => Promise<BookMetadataSearchResponse>;
	/**
	 * Apply the chosen result to the edit form. May be async (e.g. to download
	 * the cover); the dialog shows a spinner on the card until it resolves, then
	 * closes.
	 */
	onSelect: (result: BookMetadataSearchResult) => Promise<void>;
}

type Status = "idle" | "searching" | "done" | "error";

export function FetchMetadataDialog({
	open,
	onOpenChange,
	initialQuery,
	onSearch,
	onSelect,
}: FetchMetadataDialogProps) {
	const formId = useId();
	const [query, setQuery] = useState(initialQuery);
	const [status, setStatus] = useState<Status>("idle");
	const [results, setResults] = useState<BookMetadataSearchResult[]>([]);
	const [sourceErrors, setSourceErrors] = useState<BookMetadataSourceError[]>(
		[],
	);
	const [actionError, setActionError] = useState<string | null>(null);
	const [selectingId, setSelectingId] = useState<string | null>(null);

	const runSearch = useCallback(
		async (rawQuery: string) => {
			const trimmed = rawQuery.trim();
			if (!trimmed) return;

			setStatus("searching");
			setActionError(null);
			setResults([]);
			setSourceErrors([]);
			try {
				const response = await onSearch(trimmed);
				setResults(response.results);
				setSourceErrors(response.errors);
				setStatus("done");
			} catch {
				setStatus("error");
			}
		},
		[onSearch],
	);

	// Each time the dialog opens, seed the box with the latest derived query and
	// kick off a search automatically so results are ready without an extra
	// click. The user can still refine the query and search again.
	useEffect(() => {
		if (!open) return;
		setQuery(initialQuery);
		setActionError(null);
		setSelectingId(null);
		if (initialQuery.trim()) {
			runSearch(initialQuery);
		} else {
			setStatus("idle");
			setResults([]);
			setSourceErrors([]);
		}
	}, [open, initialQuery, runSearch]);

	const handleSearch = (event: FormEvent) => {
		event.preventDefault();
		runSearch(query);
	};

	const handleSelect = async (result: BookMetadataSearchResult) => {
		setSelectingId(result.id);
		setActionError(null);
		try {
			await onSelect(result);
			onOpenChange(false);
		} catch {
			setActionError("Couldn't apply this result. Please try again.");
		} finally {
			setSelectingId(null);
		}
	};

	const busy = selectingId !== null;

	return (
		<DialogRoot
			size="lg"
			scrollBehavior="inside"
			open={open}
			onOpenChange={(e) => !busy && onOpenChange(e.open)}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Fetch metadata from the internet</DialogTitle>
				</DialogHeader>
				<DialogBody>
					<Stack gap={4}>
						<form id={formId} onSubmit={handleSearch}>
							<HStack>
								<Input
									value={query}
									onChange={(e) => setQuery(e.target.value)}
									placeholder="Search by title, author, ISBN…"
									disabled={busy}
									autoFocus
								/>
								<Button
									type="submit"
									colorPalette="blue"
									loading={status === "searching"}
									disabled={busy || query.trim() === ""}
									flexShrink={0}
								>
									<LuSearch />
									Search
								</Button>
							</HStack>
						</form>

						{status === "error" && (
							<Alert status="error" title="Search failed. Please try again." />
						)}
						{actionError && <Alert status="error" title={actionError} />}
						{sourceErrors.map((sourceError) => (
							<Alert
								key={sourceError.source}
								status="warning"
								title={`${sourceError.sourceName}: ${sourceError.message}`}
							/>
						))}

						{status === "searching" ? (
							<VStack py={8} gap={3}>
								<Spinner />
								<Text color="fg.muted">Searching…</Text>
							</VStack>
						) : status === "done" && results.length === 0 ? (
							<EmptyState
								icon={<LuSearchX />}
								title="No results found"
								description="Try a different search."
							/>
						) : (
							<Stack gap={3}>
								{results.map((result) => (
									<MetadataResultCard
										key={`${result.source}:${result.id}`}
										result={result}
										selecting={selectingId === result.id}
										disabled={busy}
										onSelect={() => handleSelect(result)}
									/>
								))}
							</Stack>
						)}
					</Stack>
				</DialogBody>
				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={busy}
					>
						Cancel
					</Button>
				</DialogFooter>
				<DialogCloseTrigger disabled={busy} />
			</DialogContent>
		</DialogRoot>
	);
}
