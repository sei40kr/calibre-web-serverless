variable "environment" {
  type = string
}

variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "github_repo" {
  type = string
}

# Custom domains the app is served from, besides the project's default ones.
variable "custom_domains" {
  type    = list(string)
  default = []
}

# Enforce App Check on Firestore and Storage, or only collect metrics.
variable "app_check_enforced" {
  type    = bool
  default = true
}

# Add localhost to Firebase Auth's authorized domains.
variable "allow_localhost" {
  type    = bool
  default = false
}

# When set, an email/password test user is provisioned in the environment's
# Identity Platform (used to sign in for manual verification). Leave null to
# skip (e.g. production).
variable "test_user" {
  type = object({
    email    = string
    password = string
  })
  default   = null
  sensitive = true
}
