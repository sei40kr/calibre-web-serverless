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
