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
