# -----------------------------------------------------------------------------
# Deploy Service Account
# -----------------------------------------------------------------------------
resource "google_service_account" "firebase_deploy" {
  project      = var.project_id
  account_id   = "firebase-deploy"
  display_name = "Firebase Deploy (GitHub Actions)"
}

# -----------------------------------------------------------------------------
# IAM Roles for the deploy service account
# -----------------------------------------------------------------------------
locals {
  deploy_roles = [
    "roles/firebasehosting.admin",
    "roles/datastore.user",
    "roles/datastore.indexAdmin",
    "roles/firebaserules.admin",
    "roles/storage.admin",
    # Deploying storage rules resolves the project's default bucket, which needs
    # firebasestorage.defaultBucket.get.
    "roles/firebasestorage.admin",
    # firebase deploy checks that required APIs are enabled before deploying
    # storage, which needs serviceusage.services.get.
    "roles/serviceusage.serviceUsageConsumer",
    # Deploying the 2nd-gen Cloud Function (build, Cloud Run service, Eventarc
    # storage trigger) and acting as its runtime service account.
    "roles/cloudfunctions.admin",
    "roles/run.admin",
    "roles/artifactregistry.admin",
    "roles/eventarc.admin",
    "roles/cloudbuild.builds.editor",
    "roles/pubsub.admin",
    "roles/iam.serviceAccountUser",
    "roles/secretmanager.admin",
    # Create the Cloud Scheduler job behind the scheduled
    # reconcileStaleProcessingBooks function.
    "roles/cloudscheduler.admin",
    # Invoke the IAM-private reconcileStaleProcessingBooksHttp function.
    "roles/run.invoker",
  ]
}

resource "google_project_iam_member" "firebase_deploy" {
  for_each = toset(local.deploy_roles)

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.firebase_deploy.email}"
}

# -----------------------------------------------------------------------------
# Allow WIF principals to impersonate the deploy service account
# -----------------------------------------------------------------------------
resource "google_service_account_iam_member" "wif_binding" {
  service_account_id = google_service_account.firebase_deploy.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github_actions.name}/attribute.repository/${var.github_repo}"
}

# The Reconcile stale processing books workflow mints a Google-signed ID token
# for the private function via `gcloud auth print-identity-token
# --impersonate-service-account`, which goes through the IAM signBlob API and so
# requires the deploy SA to be a token creator on its own identity.
resource "google_service_account_iam_member" "firebase_deploy_token_creator" {
  service_account_id = google_service_account.firebase_deploy.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = "serviceAccount:${google_service_account.firebase_deploy.email}"
}
