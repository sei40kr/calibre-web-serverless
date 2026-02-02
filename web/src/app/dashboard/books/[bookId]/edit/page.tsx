"use client";

import type { Book } from "@calibre-web-serverless/domain/models/book";
import { createAuthor } from "@calibre-web-serverless/infrastructure/services/authorService";
import { updateBook } from "@calibre-web-serverless/infrastructure/services/bookService";
import { createPublisher } from "@calibre-web-serverless/infrastructure/services/publisherService";
import { createSeries } from "@calibre-web-serverless/infrastructure/services/seriesService";
import { createTag } from "@calibre-web-serverless/infrastructure/services/tagService";
import { useParams, useRouter } from "next/navigation";
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
import { usePublishers } from "@/hooks/usePublishers";
import { useSeries } from "@/hooks/useSeries";
import { useTags } from "@/hooks/useTags";

export default function EditBookRoute() {
	const params = useParams();
	const bookId = params.bookId as string;

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
				params.authorNames.map(
					async (name) =>
						authors.find((a) => a.name.toLowerCase() === name.toLowerCase())
							?.id ?? (await createAuthor(userId, name)).id,
				),
			);

			const seriesName = params.seriesName;
			const seriesId = seriesName
				? (series.find((s) => s.name.toLowerCase() === seriesName.toLowerCase())
						?.id ?? (await createSeries(userId, seriesName)).id)
				: null;

			const tagIds = await Promise.all(
				params.tagNames.map(
					async (name) =>
						tags.find((t) => t.name.toLowerCase() === name.toLowerCase())?.id ??
						(await createTag(userId, name)).id,
				),
			);

			const publisherName = params.publisherName;
			const publisherId = publisherName
				? (publishers.find(
						(p) => p.name.toLowerCase() === publisherName.toLowerCase(),
					)?.id ?? (await createPublisher(userId, publisherName)).id)
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

			await updateBook(userId, updatedBook);

			toaster.success({
				title: "Book updated",
				description: `"${params.title}" has been updated.`,
			});
			router.push("/dashboard");
		},
		[book, userId, authors, series, tags, publishers, router],
	);

	const handleCancel = useCallback(() => {
		router.push("/dashboard");
	}, [router]);

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
			authorSuggestions={authorSuggestions}
			seriesSuggestions={seriesSuggestions}
			tagSuggestions={tagSuggestions}
			publisherNames={publisherSuggestions}
			onUpdateBook={handleUpdateBook}
			onCancel={handleCancel}
		/>
	);
}
