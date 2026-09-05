import type { ReactNode } from "react";

// Bookshelf pages are fully client-rendered (the real bookshelfId is read from the URL
// at runtime). For `output: export` we still need at least one param, so we
// emit a single shell page and rewrite every /dashboard/bookshelves/<id> request
// to it in firebase.json.
export function generateStaticParams() {
	return [{ bookshelfId: "__shell__" }];
}

export default function BookshelfLayout({ children }: { children: ReactNode }) {
	return children;
}
