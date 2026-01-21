import {
	addDoc,
	collection,
	deleteDoc,
	doc,
	serverTimestamp,
	type WithFieldValue,
} from "firebase/firestore";
import { ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import type { Book } from "@/types/book";

interface UploadBookParams {
	userId: string;
	title: string;
	file: File;
}

export async function uploadBook({ userId, title, file }: UploadBookParams) {
	const format = file.name.split(".").pop()?.toLowerCase() || "unknown";
	const booksCollection = collection(db, "users", userId, "books");

	const bookData: WithFieldValue<Book> = {
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
