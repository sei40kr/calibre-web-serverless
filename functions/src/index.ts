import { initializeApp } from "firebase-admin/app";

initializeApp();

export { extractBookMetadataFn as extractBookMetadata } from "./extractBookMetadata/index";
export { opdsFn as opds } from "./opds/index";
export {
	deletePasskeyFn as deletePasskey,
	finishPasskeyRegistrationFn as finishPasskeyRegistration,
	finishPasskeySignInFn as finishPasskeySignIn,
	listPasskeysFn as listPasskeys,
	startPasskeyRegistrationFn as startPasskeyRegistration,
	startPasskeySignInFn as startPasskeySignIn,
} from "./passkeys/index";
export {
	reconcileStaleProcessingBooksFn as reconcileStaleProcessingBooks,
	reconcileStaleProcessingBooksHttpFn as reconcileStaleProcessingBooksHttp,
} from "./reconcileStaleProcessingBooks/index";
export { resizeBookCoverFn as resizeBookCover } from "./resizeBookCover/index";
export {
	fetchBookMetadataCoverFn as fetchBookMetadataCover,
	searchBookMetadataFn as searchBookMetadata,
} from "./searchBookMetadata/index";
