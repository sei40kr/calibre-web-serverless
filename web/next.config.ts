import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	/* config options here */
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
