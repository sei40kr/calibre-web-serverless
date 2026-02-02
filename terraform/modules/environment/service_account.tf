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
    "roles/firebaserules.admin",
    "roles/storage.admin",
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
