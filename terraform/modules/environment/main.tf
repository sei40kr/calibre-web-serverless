# -----------------------------------------------------------------------------
# Enable required APIs
# -----------------------------------------------------------------------------
locals {
  apis = [
    "firebase.googleapis.com",
    "firestore.googleapis.com",
    "storage.googleapis.com",
    "firebasestorage.googleapis.com",
    "firebasehosting.googleapis.com",
    "firebaserules.googleapis.com",
    "iam.googleapis.com",
    "sts.googleapis.com",
    "iamcredentials.googleapis.com",
    "identitytoolkit.googleapis.com",
    # Cloud Functions (2nd gen) for the book-metadata extraction trigger.
    "cloudfunctions.googleapis.com",
    "cloudbuild.googleapis.com",
    "artifactregistry.googleapis.com",
    "run.googleapis.com",
    "eventarc.googleapis.com",
    "pubsub.googleapis.com",
    # firebase deploy verifies the project is on a billing plan (2nd gen).
    "cloudbilling.googleapis.com",
    # Book-metadata search: the Google Books backend, an API key to raise its
    # quota, and Secret Manager to hold that key for the function at runtime.
    "books.googleapis.com",
    "apikeys.googleapis.com",
    "secretmanager.googleapis.com",
  ]
}

resource "google_project_service" "apis" {
  for_each = toset(local.apis)

  project                    = var.project_id
  service                    = each.value
  disable_on_destroy         = false
  disable_dependent_services = false
}
