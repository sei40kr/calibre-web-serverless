# -----------------------------------------------------------------------------
# Firebase Project
# -----------------------------------------------------------------------------
resource "google_firebase_project" "this" {
  provider = google-beta
  project  = var.project_id

  depends_on = [google_project_service.apis["firebase.googleapis.com"]]
}

# -----------------------------------------------------------------------------
# Firebase Web App
# -----------------------------------------------------------------------------
resource "google_firebase_web_app" "this" {
  provider     = google-beta
  project      = google_firebase_project.this.project
  display_name = "${var.environment} web app"
}

data "google_firebase_web_app_config" "this" {
  provider   = google-beta
  project    = google_firebase_project.this.project
  web_app_id = google_firebase_web_app.this.app_id
}

# -----------------------------------------------------------------------------
# Firestore Database
# -----------------------------------------------------------------------------
resource "google_firestore_database" "this" {
  project     = var.project_id
  name        = "(default)"
  location_id = var.region
  type        = "FIRESTORE_NATIVE"

  depends_on = [google_project_service.apis["firestore.googleapis.com"]]
}

# -----------------------------------------------------------------------------
# Firebase Authentication (Identity Platform)
# -----------------------------------------------------------------------------
resource "google_identity_platform_config" "this" {
  project = google_firebase_project.this.project

  sign_in {
    email {
      enabled           = true
      password_required = true
    }
  }

  authorized_domains = [
    "localhost",
    "${var.project_id}.firebaseapp.com",
    "${var.project_id}.web.app",
  ]

  depends_on = [google_project_service.apis["identitytoolkit.googleapis.com"]]
}

# -----------------------------------------------------------------------------
# Cloud Storage for Firebase
#
# Provision the project's default bucket (<project>.firebasestorage.app). Using
# the default bucket lets `firebase deploy --only storage` and the function's
# storage trigger work without per-bucket workarounds.
# -----------------------------------------------------------------------------
resource "google_firebase_storage_default_bucket" "this" {
  provider = google-beta
  project  = google_firebase_project.this.project
  location = var.region

  depends_on = [google_project_service.apis["firebasestorage.googleapis.com"]]
}
