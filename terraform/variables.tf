variable "region" {
  type    = string
  default = "us-west1"
}

variable "github_repo" {
  type    = string
  default = "sei40kr/calibre-web-serverless"
}

# Email/password test user provisioned in staging for manual verification.
# Set these in a git-ignored terraform.tfvars (see terraform.tfvars.example);
# leave the password empty to skip creating the user.
variable "test_user_email" {
  type    = string
  default = ""
}

variable "test_user_password" {
  type      = string
  default   = ""
  sensitive = true
}
