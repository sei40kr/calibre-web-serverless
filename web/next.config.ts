import type { NextConfig } from "next";

// `output: export` is only needed for the production static export shipped to
// Firebase Hosting. In that mode dynamic routes must be enumerated via
// generateStaticParams(), so book and bookshelf pages emit a single `__shell__`
// shell and Firebase rewrites every /dashboard/books/<id>/edit and
// /dashboard/bookshelves/<id> request to it (firebase.json).
//
// `next dev` does not apply those Hosting rewrites, and rewrites are ignored
// while `output: export` is active — so we keep export off in dev to get HMR and
// instead define the equivalent rewrite here, which `next dev` honors. This
// routes any real book/bookshelf id to the same `__shell__` pages production serves.
const isProduction = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
	...(isProduction
		? { output: "export" }
		: {
				async rewrites() {
					return [
						{
							source: "/dashboard/books/:bookId/edit",
							destination: "/dashboard/books/__shell__/edit",
						},
						{
							source: "/dashboard/bookshelves/:bookshelfId",
							destination: "/dashboard/bookshelves/__shell__",
						},
						{
							source: "/books/:bookId/pages/:pageNo",
							destination: "/books/__shell__/pages/__shell__",
						},
						// Hosting's /opds rewrite, so the catalog shares the consent
						// page's origin (the Authentication Document id depends on it).
						{
							source: "/opds/:path*",
							destination:
								"http://127.0.0.1:5001/demo-project/us-central1/opds/:path*",
						},
					];
				},
			}),
	images: { unoptimized: true },
	reactCompiler: true,
	transpilePackages: [
		"@calibre-web-serverless/domain",
		"@calibre-web-serverless/infrastructure",
	],
	experimental: {
		optimizePackageImports: ["@chakra-ui/react"],
	},
};

export default nextConfig;
