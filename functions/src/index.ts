import { initializeApp } from "firebase-admin/app";

initializeApp();

export { extractBookMetadataFn as extractBookMetadata } from "./extractBookMetadata/index";
export { resizeBookCoverFn as resizeBookCover } from "./resizeBookCover/index";
