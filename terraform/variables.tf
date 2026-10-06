variable "region" {
  type    = string
  default = "us-west1"
}

# Deployments, keyed by name. Each key must match a GitHub Actions environment
# of the same name (the deploy workflow reads its vars from there) and gets a
# web/.env.<key> file. Every project must already exist and be linked to a
# billing account.
variable "environments" {
  type = map(object({
    project_id = string
    # Provision the test user below in this environment.
    test_user = optional(bool, false)
    # Let Firebase Auth accept sign-ins from pages served on localhost, for
    # running a local build against this project. Off by default.
    allow_localhost = optional(bool, false)
    # Custom domains the app is served from (e.g. ["books.example.com"]),
    # besides the project's own web.app/firebaseapp.com. Connect them to
    # Firebase Hosting in the console; this only lets Auth and App Check
    # accept them.
    custom_domains = optional(list(string), [])
    # Enforce App Check on Firestore and Storage. A new environment must
    # start with false: enforcement locks out every client build that does
    # not yet carry the site key, so apply once, deploy, then flip to true.
    app_check_enforced = optional(bool, true)
  }))
}

# The "owner/name" GitHub repository whose Actions may deploy.
variable "github_repo" {
  type = string
}

# Email/password test user, provisioned in the environments that set
# test_user = true, for manual verification.
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
