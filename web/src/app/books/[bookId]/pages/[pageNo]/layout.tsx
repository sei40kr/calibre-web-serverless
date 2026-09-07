import type { ReactNode } from "react";

// Same static-shell trick as the parent book segment: the page number is read
// from the URL at runtime, so the export only needs a single shell param.
export function generateStaticParams() {
	return [{ pageNo: "__shell__" }];
}

export default function BookPageLayout({ children }: { children: ReactNode }) {
	return children;
}
