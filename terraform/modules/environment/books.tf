# -----------------------------------------------------------------------------
# Google Books API key for the book-metadata search function.
#
# The Books API works without a key (public, IP-rate-limited); the key raises
# the quota to a per-project allowance. It's created here, stored in Secret
# Manager, and exposed to the searchBookMetadata function at runtime via the
# `secrets` binding in functions/src/searchBookMetadata/index.ts. The function
# reads it as process.env.GOOGLE_BOOKS_API_KEY.
#
# Note: the generated key lands in Terraform state (key_string is sensitive),
# so the state bucket must stay access-controlled.
# -----------------------------------------------------------------------------
resource "google_apikeys_key" "google_books" {
  name         = "google-books"
  display_name = "Google Books API (${var.environment})"
  project      = var.project_id

  restrictions {
    # Server-side calls have no fixed egress IP, so restrict by API surface
    # rather than by referrer/IP.
    api_targets {
      service = "books.googleapis.com"
    }
  }

  depends_on = [google_project_service.apis["apikeys.googleapis.com"]]
}

resource "google_secret_manager_secret" "google_books_api_key" {
  secret_id = "GOOGLE_BOOKS_API_KEY"
  project   = var.project_id

  replication {
    auto {}
  }

  depends_on = [google_project_service.apis["secretmanager.googleapis.com"]]
}

resource "google_secret_manager_secret_version" "google_books_api_key" {
  secret      = google_secret_manager_secret.google_books_api_key.id
  secret_data = google_apikeys_key.google_books.key_string
}

# The function runs as the default compute SA (see functions.tf); let it read
# the secret value at runtime.
resource "google_secret_manager_secret_iam_member" "google_books_api_key_accessor" {
  secret_id = google_secret_manager_secret.google_books_api_key.id
  role      = "roles/secretmanager.secretAccessor"
  member    = local.function_runtime_sa
}
