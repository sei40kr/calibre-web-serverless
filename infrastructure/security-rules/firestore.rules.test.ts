import { readFileSync } from "node:fs";
import {
	assertFails,
	assertSucceeds,
	initializeTestEnvironment,
	type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
	collectionGroup,
	doc,
	getDoc,
	getDocs,
	setDoc,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

const OWNER = "owner-uid";
const OTHER = "other-uid";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
	testEnv = await initializeTestEnvironment({
		projectId: "demo-firestore-rules",
		firestore: {
			rules: readFileSync(
				new URL("../../firestore.rules", import.meta.url),
				"utf8",
			),
			host: "127.0.0.1",
			port: 8080,
		},
	});
});

beforeEach(() => testEnv.clearFirestore());

afterAll(() => testEnv.cleanup());

const bookPath = (userId: string) => `users/${userId}/books/book-1`;

describe("owner access", () => {
	it("reads and writes their own book", async () => {
		const db = testEnv.authenticatedContext(OWNER).firestore();

		await assertSucceeds(setDoc(doc(db, bookPath(OWNER)), { title: "Dune" }));
		await assertSucceeds(getDoc(doc(db, bookPath(OWNER))));
	});

	it("reads and writes their own user document", async () => {
		const db = testEnv.authenticatedContext(OWNER).firestore();

		await assertSucceeds(setDoc(doc(db, `users/${OWNER}`), { seen: true }));
		await assertSucceeds(getDoc(doc(db, `users/${OWNER}`)));
	});

	// The rules match the subtree recursively rather than listing collections,
	// so a collection added later is reachable without a rules change.
	it("reaches a collection the rules do not name", async () => {
		const db = testEnv.authenticatedContext(OWNER).firestore();

		await assertSucceeds(
			setDoc(doc(db, `users/${OWNER}/annotations/annotation-1`), { page: 12 }),
		);
		await assertSucceeds(
			setDoc(doc(db, `users/${OWNER}/books/book-1/notes/note-1`), { at: 3 }),
		);
	});
});

describe("other users", () => {
	beforeEach(async () => {
		await testEnv.withSecurityRulesDisabled(async (context) => {
			await setDoc(doc(context.firestore(), bookPath(OWNER)), {
				title: "Dune",
			});
		});
	});

	it("cannot read another user's book", async () => {
		const db = testEnv.authenticatedContext(OTHER).firestore();

		await assertFails(getDoc(doc(db, bookPath(OWNER))));
	});

	it("cannot write another user's book", async () => {
		const db = testEnv.authenticatedContext(OTHER).firestore();

		await assertFails(setDoc(doc(db, bookPath(OWNER)), { title: "Hijacked" }));
	});

	it("cannot reach another user's unnamed collections either", async () => {
		const db = testEnv.authenticatedContext(OTHER).firestore();

		await assertFails(
			setDoc(doc(db, `users/${OWNER}/annotations/annotation-1`), { page: 12 }),
		);
	});

	it("cannot read a book while signed out", async () => {
		const db = testEnv.unauthenticatedContext().firestore();

		await assertFails(getDoc(doc(db, bookPath(OWNER))));
	});
});

// The COLLECTION_GROUP indexes in firestore.indexes.json are for the admin SDK
// (reconcile, OPDS), which bypasses rules. No rule matches
// /{path=**}/books/{bookId}, so clients cannot use them.
describe("collection group queries", () => {
	it("are denied even to the owner of every matching book", async () => {
		const db = testEnv.authenticatedContext(OWNER).firestore();

		await assertFails(getDocs(collectionGroup(db, "books")));
	});
});
