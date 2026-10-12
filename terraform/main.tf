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

  # The state bucket is deployment-specific, so it is passed at init time:
  #   terraform init -backend-config="bucket=<your tfstate bucket>"
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

# One state describes one deployment target. A second target (e.g. staging
# next to production) is the same configuration applied again with its own
# var file in its own workspace.
module "environment" {
  source = "./modules/environment"

  environment = var.environment
  project_id  = var.project_id
  region      = var.region
  github_repo = var.github_repo
  test_user = var.test_user_password == "" ? null : {
    email    = var.test_user_email
    password = var.test_user_password
  }
}

# -----------------------------------------------------------------------------
# Write web/.env.<environment>
# -----------------------------------------------------------------------------
resource "local_file" "dotenv" {
  filename        = "${path.root}/../web/.env.${var.environment}"
  file_permission = "0644"
  content         = <<-EOT
    NODE_ENV=production
    NEXT_PUBLIC_FIREBASE_API_KEY=${module.environment.firebase_api_key}
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${module.environment.firebase_auth_domain}
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=${module.environment.project_id}
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=${module.environment.firebase_storage_bucket}
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=${module.environment.firebase_messaging_sender_id}
    NEXT_PUBLIC_FIREBASE_APP_ID=${module.environment.firebase_app_id}
    NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY=${module.environment.app_check_site_key}
  EOT

  lifecycle {
    # Applying a var file in the wrong workspace would overwrite another
    # target's state with this one's resources.
    precondition {
      condition     = terraform.workspace == "default" || terraform.workspace == var.environment
      error_message = "Workspace \"${terraform.workspace}\" does not match environment \"${var.environment}\"; select the matching workspace or var file."
    }
  }
}
