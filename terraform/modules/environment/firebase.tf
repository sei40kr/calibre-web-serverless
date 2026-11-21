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

  # The web API key ships in the client bundle, so without this anyone could
  # POST accounts:signUp and hand themselves an authenticated session — and
  # "authenticated" is the only gate the Firestore/Storage rules have. Accounts
  # are provisioned out of band instead (see test_user.tf, which uses the
  # project-scoped admin endpoint that this flag does not block).
  client {
    permissions {
      disabled_user_signup = true
    }
  }

  authorized_domains = concat([
    "localhost",
    "${var.project_id}.firebaseapp.com",
    "${var.project_id}.web.app",
  ], var.additional_domains)

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

# Browsers download objects directly, and a successful download carries only
# the bucket's own CORS headers, so without this the browser blocks it. The
# Firebase bucket resource has no cors field and a google_storage_bucket would
# fight it over the same bucket, so set it over the GCS JSON API instead.
locals {
  storage_cors = [{
    origin = concat([
      "https://${var.project_id}.firebaseapp.com",
      "https://${var.project_id}.web.app",
    ], [for d in var.additional_domains : "https://${d}"])
    method         = ["GET"]
    maxAgeSeconds  = 3600
    responseHeader = ["Content-Type", "Content-Range"]
  }]
}

resource "terraform_data" "storage_cors" {
  triggers_replace = [jsonencode(local.storage_cors)]

  provisioner "local-exec" {
    interpreter = ["/bin/sh", "-c"]

    environment = {
      ACCESS_TOKEN = data.google_client_config.default.access_token
    }

    command = <<-EOT
      curl -sSf -o /dev/null -X PATCH \
        "https://storage.googleapis.com/storage/v1/b/${var.project_id}.firebasestorage.app?fields=cors" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -H "X-Goog-User-Project: ${var.project_id}" \
        -H "Content-Type: application/json" \
        -d '${jsonencode({ cors = local.storage_cors })}'
    EOT
  }

  depends_on = [google_firebase_storage_default_bucket.this]
}
