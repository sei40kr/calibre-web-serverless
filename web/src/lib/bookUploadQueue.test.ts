import { BookFileError } from "@calibre-web-serverless/domain/errors/bookFileError";
import { StorageError } from "@calibre-web-serverless/domain/errors/storageError";
import type { Book } from "@calibre-web-serverless/domain/models/book";
import type { BookRepository } from "@calibre-web-serverless/domain/repositories/bookRepository";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	type BookUploadQueueDeps,
	createBookUploadQueue,
} from "./bookUploadQueue";

type CreateBookParams = Parameters<BookRepository["createBook"]>[0];
type BookCallbacks = Parameters<BookRepository["subscribeToBook"]>[2];

interface Deferred<T> {
	promise: Promise<T>;
	resolve: (value: T) => void;
	reject: (error: unknown) => void;
}

const deferred = <T>(): Deferred<T> => {
	let resolve!: (value: T) => void;
	let reject!: (error: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
};

const makeBook = (overrides: Partial<Book>): Book => ({
	id: "book-1",
	userId: "user-1",
	title: "",
	sortTitle: null,
	authorIds: [],
	seriesId: null,
	seriesIndex: 1,
	tagIds: [],
	publisherId: null,
	pubDate: null,
	identifiers: [],
	languages: [],
	description: null,
	rating: null,
	files: [],
	hasCover: false,
	hasCustomCover: false,
	status: "processing",
	errorCode: null,
	createdAt: null,
	updatedAt: null,
	...overrides,
});

const file = (name: string, size = 1000) =>
	new File([new Uint8Array(size)], name, { type: "application/epub+zip" });

// Lets a test hold each createBook call open and settle it explicitly, and
// capture each subscribeToBook so it can push book states in.
const harness = (options: Partial<BookUploadQueueDeps> = {}) => {
	const createCalls: {
		params: CreateBookParams;
		result: Deferred<{ bookId: string; format: "epub" }>;
	}[] = [];
	const subscriptions: {
		bookId: string;
		callbacks: BookCallbacks;
		unsubscribe: ReturnType<typeof vi.fn>;
	}[] = [];
	let nextId = 0;

	const queue = createBookUploadQueue({
		createBook: (params) => {
			const result = deferred<{ bookId: string; format: "epub" }>();
			createCalls.push({ params, result });
			return result.promise;
		},
		subscribeToBook: (_userId, bookId, callbacks) => {
			const unsubscribe = vi.fn();
			subscriptions.push({ bookId, callbacks, unsubscribe });
			return unsubscribe;
		},
		generateId: () => `upload-${++nextId}`,
		...options,
	});

	return { queue, createCalls, subscriptions };
};

describe("createBookUploadQueue", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it("starts queued uploads up to the concurrency limit", async () => {
		const { queue, createCalls } = harness({ maxConcurrentUploads: 2 });

		queue.enqueue("user-1", [file("a.epub"), file("b.epub"), file("c.epub")]);

		expect(createCalls).toHaveLength(2);
		expect(queue.getSnapshot().map((u) => u.status)).toEqual([
			"uploading",
			"uploading",
			"queued",
		]);
	});

	it("reports transfer progress and moves on to processing", async () => {
		const { queue, createCalls, subscriptions } = harness();
		queue.enqueue("user-1", [file("a.epub", 1000)]);

		createCalls[0].params.onProgress?.(400, 1000);
		expect(queue.getSnapshot()[0].bytesTransferred).toBe(400);

		createCalls[0].result.resolve({ bookId: "book-1", format: "epub" });
		await vi.advanceTimersByTimeAsync(0);

		const [upload] = queue.getSnapshot();
		expect(upload.status).toBe("processing");
		expect(upload.bookId).toBe("book-1");
		expect(upload.bytesTransferred).toBe(1000);
		expect(subscriptions).toHaveLength(1);
		expect(subscriptions[0].bookId).toBe("book-1");
	});

	it("frees the transfer slot while processing so the next file starts", async () => {
		const { queue, createCalls } = harness({ maxConcurrentUploads: 1 });
		queue.enqueue("user-1", [file("a.epub"), file("b.epub")]);
		expect(createCalls).toHaveLength(1);

		createCalls[0].result.resolve({ bookId: "book-1", format: "epub" });
		await vi.advanceTimersByTimeAsync(0);

		expect(createCalls).toHaveLength(2);
		expect(queue.getSnapshot().map((u) => u.status)).toEqual([
			"processing",
			"uploading",
		]);
	});

	it("marks the upload ready with the extracted title and unsubscribes", async () => {
		const { queue, createCalls, subscriptions } = harness();
		queue.enqueue("user-1", [file("a.epub")]);
		createCalls[0].result.resolve({ bookId: "book-1", format: "epub" });
		await vi.advanceTimersByTimeAsync(0);

		subscriptions[0].callbacks.onData(
			makeBook({ status: "processing", title: "" }),
		);
		expect(queue.getSnapshot()[0].status).toBe("processing");

		subscriptions[0].callbacks.onData(
			makeBook({ status: "ready", title: "The Hobbit" }),
		);
		const [upload] = queue.getSnapshot();
		expect(upload.status).toBe("ready");
		expect(upload.title).toBe("The Hobbit");
		expect(subscriptions[0].unsubscribe).toHaveBeenCalledTimes(1);
	});

	it("surfaces a processing error code", async () => {
		const { queue, createCalls, subscriptions } = harness();
		queue.enqueue("user-1", [file("a.epub")]);
		createCalls[0].result.resolve({ bookId: "book-1", format: "epub" });
		await vi.advanceTimersByTimeAsync(0);

		subscriptions[0].callbacks.onData(
			makeBook({ status: "error", errorCode: "extraction-failed" }),
		);
		expect(queue.getSnapshot()[0]).toMatchObject({
			status: "error",
			failure: { kind: "processing", code: "extraction-failed" },
		});
	});

	it("times out processing that never settles", async () => {
		const { queue, createCalls, subscriptions } = harness({
			processingTimeoutMs: 5_000,
		});
		queue.enqueue("user-1", [file("a.epub")]);
		createCalls[0].result.resolve({ bookId: "book-1", format: "epub" });
		await vi.advanceTimersByTimeAsync(0);

		await vi.advanceTimersByTimeAsync(5_000);

		expect(queue.getSnapshot()[0]).toMatchObject({
			status: "error",
			failure: { kind: "processing-timeout" },
		});
		expect(subscriptions[0].unsubscribe).toHaveBeenCalledTimes(1);

		// A late snapshot must not resurrect the item.
		subscriptions[0].callbacks.onData(makeBook({ status: "ready" }));
		expect(queue.getSnapshot()[0].status).toBe("error");
	});

	it("handles a subscription that delivers synchronously", async () => {
		const unsubscribe = vi.fn();
		const { queue, createCalls } = harness({
			subscribeToBook: (_userId, _bookId, callbacks) => {
				callbacks.onData(makeBook({ status: "ready", title: "Sync" }));
				return unsubscribe;
			},
		});
		queue.enqueue("user-1", [file("a.epub")]);
		createCalls[0].result.resolve({ bookId: "book-1", format: "epub" });
		await vi.advanceTimersByTimeAsync(0);

		expect(queue.getSnapshot()[0]).toMatchObject({
			status: "ready",
			title: "Sync",
		});
		expect(unsubscribe).toHaveBeenCalledTimes(1);
	});

	it("maps upload failures to typed failures and keeps going", async () => {
		const { queue, createCalls } = harness({ maxConcurrentUploads: 1 });
		queue.enqueue("user-1", [file("a.epub"), file("b.epub"), file("c.epub")]);

		createCalls[0].result.reject(
			new BookFileError("unsupported-format", "nope"),
		);
		await vi.advanceTimersByTimeAsync(0);
		createCalls[1].result.reject(new StorageError("stalled", "stalled"));
		await vi.advanceTimersByTimeAsync(0);
		createCalls[2].result.reject(new Error("boom"));
		await vi.advanceTimersByTimeAsync(0);

		expect(queue.getSnapshot().map((u) => u.failure)).toEqual([
			{ kind: "file", code: "unsupported-format" },
			{ kind: "storage", code: "stalled" },
			{ kind: "unknown", message: "boom" },
		]);
		expect(queue.getSnapshot().every((u) => u.status === "error")).toBe(true);
	});

	it("notifies subscribers with a fresh snapshot on every change", () => {
		const { queue, createCalls } = harness();
		const listener = vi.fn();
		const before = queue.getSnapshot();
		queue.subscribe(listener);

		queue.enqueue("user-1", [file("a.epub")]);
		const afterEnqueue = queue.getSnapshot();
		expect(afterEnqueue).not.toBe(before);

		createCalls[0].params.onProgress?.(10, 1000);
		expect(queue.getSnapshot()).not.toBe(afterEnqueue);
		expect(listener).toHaveBeenCalled();
	});

	it("dismisses only finished uploads and clears them in bulk", async () => {
		const { queue, createCalls } = harness({ maxConcurrentUploads: 2 });
		queue.enqueue("user-1", [file("a.epub"), file("b.epub")]);
		createCalls[0].result.reject(new Error("boom"));
		await vi.advanceTimersByTimeAsync(0);

		queue.dismiss("upload-2"); // still uploading
		expect(queue.getSnapshot()).toHaveLength(2);

		queue.dismiss("upload-1");
		expect(queue.getSnapshot().map((u) => u.id)).toEqual(["upload-2"]);

		createCalls[1].result.reject(new Error("boom"));
		await vi.advanceTimersByTimeAsync(0);
		queue.clearFinished();
		expect(queue.getSnapshot()).toEqual([]);
	});

	it("ignores an empty enqueue", () => {
		const { queue } = harness();
		const listener = vi.fn();
		queue.subscribe(listener);
		queue.enqueue("user-1", []);
		expect(listener).not.toHaveBeenCalled();
	});
});
