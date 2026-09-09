# -----------------------------------------------------------------------------
# Test user for manual verification
#
# Identity Platform has no Terraform resource for end-user accounts, so create
# the user idempotently over the REST API. Self-signup is disabled
# (identity_platform_config.client.permissions), so this uses the
# project-scoped admin endpoint — authenticated with the provider's own
# credentials — rather than the public accounts:signUp one. Re-running is a
# no-op once the account exists.
# -----------------------------------------------------------------------------
data "google_client_config" "default" {}

resource "terraform_data" "test_user" {
  count = var.test_user == null ? 0 : 1

  triggers_replace = [var.test_user.email]

  provisioner "local-exec" {
    interpreter = ["/bin/sh", "-c"]

    # Kept out of the command string so the token never lands in a rendered
    # plan or the provisioner's echoed command line.
    environment = {
      ACCESS_TOKEN = data.google_client_config.default.access_token
    }

    command = <<-EOT
      resp=$(curl -sS -X POST \
        "https://identitytoolkit.googleapis.com/v1/projects/${var.project_id}/accounts" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -H "X-Goog-User-Project: ${var.project_id}" \
        -H "Content-Type: application/json" \
        -d '${jsonencode({
    email         = var.test_user.email
    password      = var.test_user.password
    emailVerified = true
})}')
      if echo "$resp" | grep -q '"localId"'; then
        echo "Created test user ${var.test_user.email}"
      elif echo "$resp" | grep -q "EMAIL_EXISTS"; then
        echo "Test user ${var.test_user.email} already exists"
      else
        echo "Failed to create test user: $resp" >&2
        exit 1
      fi
    EOT
}

depends_on = [google_identity_platform_config.this]
}
