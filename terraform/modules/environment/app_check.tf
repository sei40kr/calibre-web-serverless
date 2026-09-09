# -----------------------------------------------------------------------------
# Firebase App Check
#
# Auth answers "which account is this", not "which app is this". Without App
# Check, anything holding an ID token — a script, a copied session, a stolen
# refresh token — talks to Firestore, Storage and the metadata-search callables
# exactly like the web app does. App Check adds the second question: requests
# must also carry a token proving they came from this web app in a real browser.
#
# Not enforced on identitytoolkit.googleapis.com: the OPDS function verifies
# Basic-auth credentials against it server-side and has no App Check token to
# send, so enforcing there would break every OPDS client.
# -----------------------------------------------------------------------------
resource "google_recaptcha_enterprise_key" "app_check" {
  project      = var.project_id
  display_name = "${var.environment} app check"

  web_settings {
    # Score-based: no interaction, the browser is judged on signals. App Check
    # exchanges the reCAPTCHA token for an App Check token.
    integration_type  = "SCORE"
    allow_all_domains = false
    allowed_domains = [
      "${var.project_id}.web.app",
      "${var.project_id}.firebaseapp.com",
    ]
  }

  depends_on = [google_project_service.apis["recaptchaenterprise.googleapis.com"]]
}

resource "google_firebase_app_check_recaptcha_enterprise_config" "this" {
  provider = google-beta
  project  = var.project_id
  app_id   = google_firebase_web_app.this.app_id
  # The key's resource id is the site key itself.
  site_key = google_recaptcha_enterprise_key.app_check.name

  depends_on = [google_project_service.apis["firebaseappcheck.googleapis.com"]]
}

# Enforcement is all-or-nothing per service and takes effect immediately, so a
# client build that does not yet carry the site key stops working the moment
# this is applied. Deploy the web app first, apply second.
resource "google_firebase_app_check_service_config" "enforced" {
  for_each = toset([
    "firestore.googleapis.com",
    "firebasestorage.googleapis.com",
  ])

  provider         = google-beta
  project          = var.project_id
  service_id       = each.value
  enforcement_mode = "ENFORCED"

  depends_on = [google_firebase_app_check_recaptcha_enterprise_config.this]
}
