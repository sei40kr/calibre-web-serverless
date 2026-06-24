/**
 * Web-facing barrel for the book filter/sort model. The types and pure helpers
 * live in the domain package so the infrastructure layer can translate them
 * into Firestore queries; filtering and sorting are performed server-side, not
 * in the browser.
 */
export * from "@calibre-web-serverless/domain/models/bookQuery";
