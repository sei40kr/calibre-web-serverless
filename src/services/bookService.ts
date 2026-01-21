import {
	addDoc,
	collection,
	deleteDoc,
	doc,
	type FieldValue,
	onSnapshot,
	orderBy,
	query,
	serverTimestamp,
	type Timestamp,
} from "firebase/firestore";
import { ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import type { Book } from "@/types/book";

type BookDocument = Omit<Book, "id" | "pubDate" | "createdAt" | "updatedAt"> & {
	pubDate?: Timestamp;
	createdAt: Timestamp;
	updatedAt: Timestamp;
};

type NewBookDocument = Omit<BookDocument, "createdAt" | "updatedAt"> & {
	createdAt: FieldValue;
	updatedAt: FieldValue;
};

export interface SubscribeToBooksCallbacks {
	onData: (books: Book[]) => void;
	onError: (error: Error) => void;
}

export function subscribeToBooks(
	userId: string,
	{ onData, onError }: SubscribeToBooksCallbacks,
): () => void {
	const booksRef = collection(db, "users", userId, "books");
	const q = query(booksRef, orderBy("createdAt", "desc"));

	return onSnapshot(
		q,
		(snapshot) => {
			const books = snapshot.docs.map((doc) => {
				const data = doc.data();
				return {
					id: doc.id,
					title: data.title,
					sortTitle: data.sortTitle,
					authorIds: data.authorIds ?? [],
					seriesId: data.seriesId,
					seriesIndex: data.seriesIndex,
					tagIds: data.tagIds ?? [],
					publisher: data.publisher,
					pubDate: data.pubDate?.toDate(),
					identifiers: data.identifiers ?? [],
					language: data.language,
					description: data.description,
					rating: data.rating,
					format: data.format,
					fileSize: data.fileSize,
					coverFormat: data.coverFormat,
					createdAt: data.createdAt?.toDate(),
					updatedAt: data.updatedAt?.toDate(),
				} as Book;
			});
			onData(books);
		},
		onError,
	);
}

interface UploadBookParams {
	userId: string;
	title: string;
	file: File;
}

export async function uploadBook({ userId, title, file }: UploadBookParams) {
	const format = file.name.split(".").pop()?.toLowerCase() || "unknown";
	const booksCollection = collection(db, "users", userId, "books");

	const bookData: NewBookDocument = {
		title,
		sortTitle: title,
		authorIds: [],
		tagIds: [],
		identifiers: [],
		format,
		fileSize: file.size,
		createdAt: serverTimestamp(),
		updatedAt: serverTimestamp(),
	};

	const bookDocRef = await addDoc(booksCollection, bookData);

	const bookId = bookDocRef.id;

	try {
		const storageRef = ref(
			storage,
			`users/${userId}/books/${bookId}/book.${format}`,
		);
		await uploadBytes(storageRef, file);
	} catch (error) {
		await deleteDoc(doc(db, "users", userId, "books", bookId));
		throw error;
	}

	return { bookId, format };
}
