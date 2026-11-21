import { initializeApp } from "firebase-admin/app";
import { setGlobalOptions } from "firebase-functions/v2";

initializeApp();

// Independent of the Terraform `region`, which places Firestore and the Storage
// bucket; only the Storage triggers must follow the bucket (STORAGE_REGION).
// Changing this moves every other deployed function, and the reconcile
// workflow looks the HTTP function up by region, so change both together.
setGlobalOptions({ region: "us-central1" });

export { deleteAccountFn as deleteAccount } from "./deleteAccount/index";
export { extractBookMetadataFn as extractBookMetadata } from "./extractBookMetadata/index";
export { opdsFn as opds } from "./opds/index";
export {
	reconcileStaleProcessingBooksFn as reconcileStaleProcessingBooks,
	reconcileStaleProcessingBooksHttpFn as reconcileStaleProcessingBooksHttp,
} from "./reconcileStaleProcessingBooks/index";
export { resizeBookCoverFn as resizeBookCover } from "./resizeBookCover/index";
export {
	fetchBookMetadataCoverFn as fetchBookMetadataCover,
	searchBookMetadataFn as searchBookMetadata,
} from "./searchBookMetadata/index";
