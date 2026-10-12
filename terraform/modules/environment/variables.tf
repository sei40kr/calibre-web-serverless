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

# Extra domains (e.g. a custom Hosting domain) to allow for Firebase Auth and
# App Check, on top of the project's own Hosting domains.
variable "additional_domains" {
  type    = list(string)
  default = []
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
