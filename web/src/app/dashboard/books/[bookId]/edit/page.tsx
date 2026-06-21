"use client";

import type { Book } from "@calibre-web-serverless/domain/models/book";
import type { BookMetadataSearchResult } from "@calibre-web-serverless/domain/models/bookMetadataSearch";
import { authorRepository } from "@calibre-web-serverless/infrastructure/repositories/authorRepository";
import { bookCoverRepository } from "@calibre-web-serverless/infrastructure/repositories/bookCoverRepository";
import { bookRepository } from "@calibre-web-serverless/infrastructure/repositories/bookRepository";
import { publisherRepository } from "@calibre-web-serverless/infrastructure/repositories/publisherRepository";
import { seriesRepository } from "@calibre-web-serverless/infrastructure/repositories/seriesRepository";
import { tagRepository } from "@calibre-web-serverless/infrastructure/repositories/tagRepository";
import { bookMetadataSearchService } from "@calibre-web-serverless/infrastructure/services/bookMetadataSearchService";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { BookNotFoundPage } from "@/components/pages/BookNotFoundPage";
import {
	type BookEditData,
	EditBookPage,
	type UpdateBookParams,
} from "@/components/pages/EditBookPage";
import { EditBookPageSkeleton } from "@/components/pages/EditBookPageSkeleton";
import { toaster } from "@/components/ui/toaster";
import { useAuthors } from "@/hooks/useAuthors";
import { useBook } from "@/hooks/useBook";
import { useBookCoverUrl } from "@/hooks/useBookCoverUrl";
import { usePublishers } from "@/hooks/usePublishers";
import { useSeries } from "@/hooks/useSeries";
import { useTags } from "@/hooks/useTags";

export default function EditBookRoute() {
	// This route is served as a static shell (rewritten from any book id), so the
	// prerendered route params are a placeholder. Derive the real id reactively
	// from the browser path instead — usePathname() updates on client-side
	// navigation, whereas a one-time window.location read can run before the URL
	// has changed and capture an empty id.
	const pathname = usePathname();
	const bookId = pathname?.match(/\/books\/([^/]+)\/edit/)?.[1] ?? "";

	return (
		<AuthGuard>
			{({ user }) => <EditBookRouteContent userId={user.uid} bookId={bookId} />}
		</AuthGuard>
	);
}

interface EditBookRouteContentProps {
	userId: string;
	bookId: string;
}

function EditBookRouteContent({ userId, bookId }: EditBookRouteContentProps) {
	const router = useRouter();
	const { book, loading, error } = useBook(userId, bookId);
	const { authors, loading: authorsLoading } = useAuthors(userId);
	const { series, loading: seriesLoading } = useSeries(userId);
	const { tags, loading: tagsLoading } = useTags(userId);
	const { publishers, loading: publishersLoading } = usePublishers(userId);
	const { coverUrl, loading: coverLoading } = useBookCoverUrl(
		userId,
		bookId,
		book?.hasCover ?? false,
		book?.hasCustomCover ?? false,
		book?.updatedAt?.getTime(),
	);
	// The extracted cover, shown when previewing a reset of a custom cover.
	const { coverUrl: originalCoverUrl } = useBookCoverUrl(
		userId,
		bookId,
		book?.hasCover ?? false,
		false,
		book?.updatedAt?.getTime(),
	);

	const bookEditData: BookEditData | null = useMemo(() => {
		if (!book) return null;

		const authorNames = book.authorIds
			.map((id) => authors.find((a) => a.id === id)?.name)
			.filter((name): name is string => !!name);

		const seriesName = book.seriesId
			? (series.find((s) => s.id === book.seriesId)?.name ?? "")
			: "";

		const tagNames = book.tagIds
			.map((id) => tags.find((t) => t.id === id)?.name)
			.filter((name): name is string => !!name);

		const publisherName = book.publisherId
			? (publishers.find((p) => p.id === book.publisherId)?.name ?? "")
			: "";

		return {
			title: book.title,
			sortTitle: book.sortTitle ?? "",
			authorNames,
			seriesName,
			seriesIndex: book.seriesIndex,
			tagNames,
			description: book.description ?? "",
			publisherName,
			pubDate: book.pubDate,
			languages: book.languages,
			rating: book.rating,
			identifiers: book.identifiers,
			format: book.format,
			fileSize: book.fileSize,
		};
	}, [book, authors, series, tags, publishers]);

	const authorSuggestions = useMemo(
		() => authors.map((a) => a.name),
		[authors],
	);
	const seriesSuggestions = useMemo(() => series.map((s) => s.name), [series]);
	const tagSuggestions = useMemo(() => tags.map((t) => t.name), [tags]);
	const publisherSuggestions = useMemo(
		() => publishers.map((p) => p.name),
		[publishers],
	);

	const handleUpdateBook = useCallback(
		async (params: UpdateBookParams) => {
			if (!book) return;

			const authorIds = await Promise.all(
				params.authorNames.map((name) =>
					authorRepository.findByNameOrCreate(userId, name).then((a) => a.id),
				),
			);

			const seriesName = params.seriesName;
			const seriesId = seriesName
				? await seriesRepository
						.findByNameOrCreate(userId, seriesName)
						.then((s) => s.id)
				: null;

			const tagIds = await Promise.all(
				params.tagNames.map((name) =>
					tagRepository.findByNameOrCreate(userId, name).then((t) => t.id),
				),
			);

			const publisherName = params.publisherName;
			const publisherId = publisherName
				? await publisherRepository
						.findByNameOrCreate(userId, publisherName)
						.then((p) => p.id)
				: null;

			const updatedBook: Book = {
				...book,
				title: params.title,
				sortTitle: params.sortTitle,
				authorIds,
				seriesId,
				seriesIndex: params.seriesIndex,
				tagIds,
				description: params.description,
				publisherId,
				pubDate: params.pubDate,
				languages: params.languages,
				rating: params.rating,
				identifiers: params.identifiers,
			};

			await bookRepository.updateBook(userId, updatedBook);

			// Apply the pending cover change alongside the metadata. A custom upload
			// is resized and applied asynchronously by the resizeBookCover function;
			// a reset clears the custom cover immediately.
			if (params.coverChange?.type === "upload") {
				await bookCoverRepository.uploadCustomCover({
					userId,
					bookId,
					file: params.coverChange.file,
				});
			} else if (params.coverChange?.type === "reset") {
				await bookCoverRepository.resetCustomCover({ userId, bookId });
			}

			toaster.success({
				title: "Book updated",
				description: `"${params.title}" has been updated.`,
			});
			router.push("/dashboard");
		},
		[book, userId, bookId, router],
	);

	const handleDeleteBook = useCallback(async () => {
		const title = book?.title;
		await bookRepository.deleteBook(userId, bookId);

		toaster.success({
			title: "Book deleted",
			description: title ? `"${title}" has been deleted.` : undefined,
		});
		router.push("/dashboard");
	}, [book, userId, bookId, router]);

	const handleCancel = useCallback(() => {
		router.push("/dashboard");
	}, [router]);

	const handleSearchMetadata = useCallback(
		(query: string) => bookMetadataSearchService.search(query),
		[],
	);

	const handleFetchCover = useCallback(
		(result: BookMetadataSearchResult) =>
			bookMetadataSearchService.fetchCover(result),
		[],
	);

	if (
		loading ||
		authorsLoading ||
		seriesLoading ||
		tagsLoading ||
		publishersLoading
	) {
		return <EditBookPageSkeleton />;
	}

	if (error || !bookEditData) {
		return <BookNotFoundPage onBack={() => router.push("/dashboard")} />;
	}

	return (
		<EditBookPage
			book={bookEditData}
			coverUrl={coverUrl}
			coverLoading={coverLoading}
			originalCoverUrl={originalCoverUrl}
			hasCustomCover={book?.hasCustomCover ?? false}
			authorSuggestions={authorSuggestions}
			seriesSuggestions={seriesSuggestions}
			tagSuggestions={tagSuggestions}
			publisherNames={publisherSuggestions}
			onUpdateBook={handleUpdateBook}
			onDeleteBook={handleDeleteBook}
			onCancel={handleCancel}
			onSearchMetadata={handleSearchMetadata}
			onFetchCover={handleFetchCover}
		/>
	);
}
