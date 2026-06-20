# -----------------------------------------------------------------------------
# IAM for the Cloud Functions (2nd gen, Storage/Eventarc triggers).
#
# Covers every Storage-triggered function in functions/src/index.ts
# (extractBookMetadata, resizeBookCover, ...). All grants below are
# project-level and the trigger plumbing (GCS -> Pub/Sub -> Eventarc) is
# shared, so adding another onObjectFinalized function needs no Terraform
# changes; firebase deploy --only functions ships it from the bundled source.
# -----------------------------------------------------------------------------
data "google_project" "this" {
  project_id = var.project_id
}

# The Cloud Storage service agent publishes object-finalized events to Eventarc
# (the function's trigger), which requires pubsub.publisher.
data "google_storage_project_service_account" "this" {
  project = var.project_id

  depends_on = [google_project_service.apis["storage.googleapis.com"]]
}

resource "google_project_iam_member" "gcs_pubsub_publisher" {
  project = var.project_id
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${data.google_storage_project_service_account.this.email_address}"

  depends_on = [google_project_service.apis["pubsub.googleapis.com"]]
}

# Eventarc storage triggers use Pub/Sub push; the Pub/Sub service agent needs to
# mint tokens for the push subscription's service account.
resource "google_project_service_identity" "pubsub" {
  provider = google-beta
  project  = var.project_id
  service  = "pubsub.googleapis.com"

  depends_on = [google_project_service.apis["pubsub.googleapis.com"]]
}

resource "google_project_iam_member" "pubsub_token_creator" {
  project = var.project_id
  role    = "roles/iam.serviceAccountTokenCreator"
  member  = "serviceAccount:${google_project_service_identity.pubsub.email}"
}

# The function runs as the default compute service account. Grant it the access
# the extractor needs: read the uploaded file, write Firestore, and receive
# Eventarc events / be invoked by the trigger.
locals {
  function_runtime_sa = "serviceAccount:${data.google_project.this.number}-compute@developer.gserviceaccount.com"
}

resource "google_project_iam_member" "function_runtime" {
  for_each = toset([
    "roles/datastore.user",
    "roles/storage.objectAdmin",
    "roles/eventarc.eventReceiver",
    "roles/run.invoker",
  ])

  project = var.project_id
  role    = each.value
  member  = local.function_runtime_sa

  depends_on = [
    google_project_service.apis["cloudfunctions.googleapis.com"],
    google_project_service.apis["run.googleapis.com"],
    google_project_service.apis["eventarc.googleapis.com"],
  ]
}

# The OPDS function hands clients V4 signed URLs for book/cover downloads. Cloud
# Functions has no private key, so signing goes through the IAM signBlob API,
# which requires the runtime SA to be a token creator on its own identity.
resource "google_service_account_iam_member" "function_runtime_sign_blob" {
  service_account_id = "projects/${var.project_id}/serviceAccounts/${data.google_project.this.number}-compute@developer.gserviceaccount.com"
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = local.function_runtime_sa
}
