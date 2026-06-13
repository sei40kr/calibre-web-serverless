# -----------------------------------------------------------------------------
# Test user for manual verification
#
# Identity Platform has no Terraform resource for end-user accounts, so create
# the user idempotently via the Identity Toolkit signUp endpoint (email/password
# sign-in is enabled in identity_platform_config). Re-running is a no-op once the
# account exists.
# -----------------------------------------------------------------------------
resource "terraform_data" "test_user" {
  count = var.test_user == null ? 0 : 1

  triggers_replace = [var.test_user.email]

  provisioner "local-exec" {
    interpreter = ["/bin/sh", "-c"]
    command = <<-EOT
      resp=$(curl -sS -X POST \
        "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${data.google_firebase_web_app_config.this.api_key}" \
        -H "Content-Type: application/json" \
        -d '${jsonencode({
    email             = var.test_user.email
    password          = var.test_user.password
    returnSecureToken = true
})}')
      if echo "$resp" | grep -q '"idToken"'; then
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
