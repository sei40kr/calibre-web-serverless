import type { ReactNode } from "react";

// The book pages are fully client-rendered (the real bookId is read from the
// URL at runtime). For `output: export` we still need at least one param, so we
// emit a single shell page and rewrite every /dashboard/books/<id>/... request
// to it in firebase.json.
export function generateStaticParams() {
	return [{ bookId: "__shell__" }];
}

export default function BookLayout({ children }: { children: ReactNode }) {
	return children;
}
