import { initializeApp } from "firebase-admin/app";

initializeApp();

export { extractBookMetadataFn as extractBookMetadata } from "./extractBookMetadata/index";
export { opdsFn as opds } from "./opds/index";
export { resizeBookCoverFn as resizeBookCover } from "./resizeBookCover/index";
