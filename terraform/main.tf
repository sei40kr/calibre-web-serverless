terraform {
  required_version = ">= 1.5"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 7.17.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 7.17.0"
    }
    local = {
      source  = "hashicorp/local"
      version = "~> 2.5"
    }
  }

  backend "gcs" {
    bucket = "calibre-web-serverless-tfstate"
  }
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
locals {
  environments = {
    staging = {
      project_id = "calibre-web-serverless-stg"
    }
    production = {
      project_id = "calibre-web-serverless-prd"
    }
  }
}

module "environment" {
  for_each = local.environments
  source   = "./modules/environment"

  environment = each.key
  project_id  = each.value.project_id
  region      = var.region
  github_repo = var.github_repo
}

# -----------------------------------------------------------------------------
# Write .env.<environment> files
# -----------------------------------------------------------------------------
resource "local_file" "dotenv" {
  for_each = local.environments

  filename        = "${path.root}/../.env.${each.key}"
  file_permission = "0644"
  content         = <<-EOT
    NODE_ENV=production
    NEXT_PUBLIC_FIREBASE_API_KEY=${module.environment[each.key].firebase_api_key}
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${module.environment[each.key].firebase_auth_domain}
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=${module.environment[each.key].project_id}
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=${module.environment[each.key].firebase_storage_bucket}
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=${module.environment[each.key].firebase_messaging_sender_id}
    NEXT_PUBLIC_FIREBASE_APP_ID=${module.environment[each.key].firebase_app_id}
  EOT
}
