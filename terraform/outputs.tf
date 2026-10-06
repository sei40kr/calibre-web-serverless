output "wif_providers" {
  description = "Workload Identity Provider for GitHub Actions (vars.WIF_PROVIDER), per environment"
  value       = { for name, env in module.environment : name => env.wif_provider }
}

output "service_account_emails" {
  description = "Service account for deploys (vars.FIREBASE_SERVICE_ACCOUNT), per environment"
  value       = { for name, env in module.environment : name => env.service_account_email }
}

output "project_ids" {
  description = "GCP project ID (vars.FIREBASE_PROJECT_ID), per environment"
  value       = { for name, env in module.environment : name => env.project_id }
}

output "google_books_api_keys" {
  description = "Google Books API key, per environment"
  value       = { for name, env in module.environment : name => env.google_books_api_key }
  sensitive   = true
}
