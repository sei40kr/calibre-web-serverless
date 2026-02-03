"use client";

import type { Book } from "@calibre-web-serverless/domain/models/book";
import { authorRepository } from "@calibre-web-serverless/infrastructure/repositories/authorRepository";
import { bookRepository } from "@calibre-web-serverless/infrastructure/repositories/bookRepository";
import { publisherRepository } from "@calibre-web-serverless/infrastructure/repositories/publisherRepository";
import { seriesRepository } from "@calibre-web-serverless/infrastructure/repositories/seriesRepository";
import { tagRepository } from "@calibre-web-serverless/infrastructure/repositories/tagRepository";
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

			toaster.success({
				title: "Book updated",
				description: `"${params.title}" has been updated.`,
			});
			router.push("/dashboard");
		},
		[book, userId, router],
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
