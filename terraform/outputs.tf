output "wif_provider" {
  description = "Workload Identity Provider for GitHub Actions deploys"
  value       = module.environment.wif_provider
}

output "service_account_email" {
  description = "Service account email for GitHub Actions deploys"
  value       = module.environment.service_account_email
}

output "google_books_api_key" {
  description = "Google Books API key"
  value       = module.environment.google_books_api_key
  sensitive   = true
}
