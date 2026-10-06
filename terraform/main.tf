terraform {
  required_version = ">= 1.5"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 7.36"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 7.36"
    }
    local = {
      source  = "hashicorp/local"
      version = "~> 2.5"
    }
  }

  # The state bucket is supplied at init, so each deployment keeps its own:
  #   terraform init -backend-config=backend.hcl
  # (copy backend.hcl.example). It must exist before init and stay
  # access-controlled: the state holds the Google Books API key.
  backend "gcs" {}
}

provider "google" {
  region                = var.region
  user_project_override = true
}

provider "google-beta" {
  region                = var.region
  user_project_override = true
}

# -----------------------------------------------------------------------------
# Environments
# -----------------------------------------------------------------------------
module "environment" {
  for_each = var.environments
  source   = "./modules/environment"

  environment = each.key
  project_id  = each.value.project_id
  region      = var.region
  github_repo = var.github_repo

  allow_localhost = each.value.allow_localhost
  test_user = each.value.test_user && var.test_user_password != "" ? {
    email    = var.test_user_email
    password = var.test_user_password
  } : null
}

# -----------------------------------------------------------------------------
# Write .env.<environment> files
# -----------------------------------------------------------------------------
resource "local_file" "dotenv" {
  for_each = var.environments

  filename        = "${path.root}/../web/.env.${each.key}"
  file_permission = "0644"
  content         = <<-EOT
    NODE_ENV=production
    NEXT_PUBLIC_FIREBASE_API_KEY=${module.environment[each.key].firebase_api_key}
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${module.environment[each.key].firebase_auth_domain}
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=${module.environment[each.key].project_id}
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=${module.environment[each.key].firebase_storage_bucket}
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=${module.environment[each.key].firebase_messaging_sender_id}
    NEXT_PUBLIC_FIREBASE_APP_ID=${module.environment[each.key].firebase_app_id}
    NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY=${module.environment[each.key].app_check_site_key}
  EOT
}
