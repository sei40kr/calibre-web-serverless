output "wif_provider" {
  description = "Workload Identity Provider resource name for GitHub Actions"
  value       = google_iam_workload_identity_pool_provider.github_oidc.name
}

output "service_account_email" {
  description = "Service account email for GitHub Actions deploys"
  value       = google_service_account.firebase_deploy.email
}

output "project_id" {
  description = "GCP project ID"
  value       = var.project_id
}

output "firebase_api_key" {
  description = "Firebase API key"
  value       = data.google_firebase_web_app_config.this.api_key
  sensitive   = true
}

output "firebase_auth_domain" {
  description = "Firebase Auth domain"
  value       = data.google_firebase_web_app_config.this.auth_domain
}

output "firebase_storage_bucket" {
  description = "Firebase Storage default bucket"
  # New-format default bucket name; the resource ensures it exists.
  value      = "${var.project_id}.firebasestorage.app"
  depends_on = [google_firebase_storage_default_bucket.this]
}

output "firebase_messaging_sender_id" {
  description = "Firebase Cloud Messaging sender ID"
  value       = data.google_firebase_web_app_config.this.messaging_sender_id
}

output "firebase_app_id" {
  description = "Firebase App ID"
  value       = google_firebase_web_app.this.app_id
}

output "google_books_api_key" {
  description = "Google Books API key for the metadata search function"
  value       = google_apikeys_key.google_books.key_string
  sensitive   = true
}
