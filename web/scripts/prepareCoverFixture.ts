/**
 * Normalise a fixture's cover.jpg into the pre-sized cover.png that the dev
 * seed uploads as-is (mirroring what extractBookMetadata would produce).
 * Run after adding or changing a fixture cover:
 *
 *   bun scripts/prepareCoverFixture.ts <fixture-name>...
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { MAX_COVER_WIDTH } from "@calibre-web-serverless/domain/models/bookCover";
import sharp from "sharp";

const names = process.argv.slice(2);
if (names.length === 0) {
	console.error("Usage: bun scripts/prepareCoverFixture.ts <fixture-name>...");
	process.exit(1);
}

for (const name of names) {
	const dir = path.join(
		import.meta.dirname,
		"..",
		"..",
		"fixtures",
		"books",
		name,
	);
	const pngData = await sharp(path.join(dir, "cover.jpg"))
		.resize({ width: MAX_COVER_WIDTH, withoutEnlargement: true })
		.png()
		.toBuffer();
	fs.writeFileSync(path.join(dir, "cover.png"), pngData);
	console.log(`Wrote ${path.join(dir, "cover.png")}`);
}
