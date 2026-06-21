# -----------------------------------------------------------------------------
# Staging
# -----------------------------------------------------------------------------
output "staging_wif_provider" {
  description = "Staging: Workload Identity Provider for GitHub Actions"
  value       = module.environment["staging"].wif_provider
}

output "staging_service_account_email" {
  description = "Staging: Service account email for deploys"
  value       = module.environment["staging"].service_account_email
}

output "staging_google_books_api_key" {
  description = "Staging: Google Books API key"
  value       = module.environment["staging"].google_books_api_key
  sensitive   = true
}

# -----------------------------------------------------------------------------
# Production
# -----------------------------------------------------------------------------
output "production_wif_provider" {
  description = "Production: Workload Identity Provider for GitHub Actions"
  value       = module.environment["production"].wif_provider
}

output "production_service_account_email" {
  description = "Production: Service account email for deploys"
  value       = module.environment["production"].service_account_email
}

output "production_google_books_api_key" {
  description = "Production: Google Books API key"
  value       = module.environment["production"].google_books_api_key
  sensitive   = true
}
