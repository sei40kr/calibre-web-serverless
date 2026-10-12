# Name of this deployment target. It names the generated web/.env.<environment>
# file and the Firebase resources, and must match the workspace when one is
# used.
variable "environment" {
  type    = string
  default = "production"
}

# ID of the existing GCP project to deploy into. Terraform does not create the
# project itself; see the README for the prerequisites.
variable "project_id" {
  type = string
}

variable "region" {
  type    = string
  default = "us-west1"
}

# The GitHub repository ("owner/name") whose Actions may deploy; only its
# workflows can federate into the deploy service account.
variable "github_repo" {
  type = string
}

# Email/password test user for manual verification, meant for a staging
# target. Leave the password empty to skip creating the user.
variable "test_user_email" {
  type    = string
  default = ""
}

variable "test_user_password" {
  type      = string
  default   = ""
  sensitive = true
}
