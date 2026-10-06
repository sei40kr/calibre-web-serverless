# Self-hosting

This guide takes a fork of this repository to a running deployment of your
own: Terraform provisions the Google Cloud / Firebase projects, and GitHub
Actions builds and deploys to them.

A deployment is made of one or more **environments** (for example `staging`
and `production`, or just `production`). Each environment is one Google Cloud
project, one GitHub Actions environment of the same name, and one
`web/.env.<name>` file.

## Prerequisites

- A Google Cloud account with a billing account. Cloud Functions (2nd gen)
  require the Blaze (pay-as-you-go) plan; a personal library normally stays
  within the free tiers, but see [Cost controls](#cost-controls).
- One Google Cloud project per environment, **already created and linked to
  the billing account**. Terraform configures projects; it does not create
  them.
- [Terraform](https://developer.hashicorp.com/terraform) ≥ 1.5 and the
  [gcloud CLI](https://cloud.google.com/sdk/docs/install), signed in with an
  account that owns the projects:

  ```sh
  gcloud auth application-default login
  ```

- A fork of this repository on GitHub.

## 1. Create the Terraform state bucket

Terraform keeps its state in a Cloud Storage bucket you create once. The state
holds the Google Books API key, so keep the bucket private.

```sh
gcloud storage buckets create gs://<your-tfstate-bucket> \
  --project <any-of-your-projects> --location <region> \
  --uniform-bucket-level-access
gcloud storage buckets update gs://<your-tfstate-bucket> --versioning
```

## 2. Configure Terraform

```sh
cd terraform
cp backend.hcl.example backend.hcl            # set bucket
cp terraform.tfvars.example terraform.tfvars  # set github_repo, environments
```

Both files are git-ignored. In `terraform.tfvars`, give every environment
`app_check_enforced = false` for now (see step 5):

```hcl
github_repo = "your-name/calibre-web-serverless"

environments = {
  production = {
    project_id         = "your-project-prd"
    app_check_enforced = false
  }
}
```

The other per-environment settings are documented in
[`terraform/variables.tf`](../terraform/variables.tf): `custom_domains`,
`allow_localhost` and `test_user`.

`region` (default `us-west1`) sets where Firestore and Storage live. If you
change it, change `firestore.location` in [`firebase.json`](../firebase.json)
to match.

## 3. Provision

```sh
terraform init -backend-config=backend.hcl
terraform apply
terraform output
```

Besides the cloud resources, `apply` writes `web/.env.<environment>` with the
project's web config. These values are public (they ship in the client
bundle), and the deploy workflow builds from them, so **commit them**. Delete
the `.env` files of environments you do not have.

## 4. Configure GitHub Actions

In your fork, under **Settings → Environments**, create one environment per
Terraform environment, with the same name, and set these environment
variables from `terraform output`:

| Variable | Value |
|---|---|
| `WIF_PROVIDER` | `wif_providers[<environment>]` |
| `FIREBASE_SERVICE_ACCOUNT` | `service_account_emails[<environment>]` |
| `FIREBASE_PROJECT_ID` | `project_ids[<environment>]` |
| `GOOGLE_BOOKS_COUNTRY` | Optional. Store country for metadata search, e.g. `JP`. Defaults to `US`. |

The Workload Identity binding trusts **every workflow run in the repository**,
whatever the branch. Restrict who can deploy with the environment's own
protection rules: allow only the `master` branch under **Deployment branches**,
and add required reviewers to production.

CI deploys to the `staging` environment on every push to `master`. If you run
production only, delete the `deploy-staging` job from
[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) and deploy with the
**Deploy** workflow instead.

## 5. Deploy, then enforce App Check

1. Run the **Deploy** workflow (Actions → Deploy → Run workflow) for each
   environment, or push to `master` for staging.
2. Open the app at `https://<project-id>.web.app` and check that it loads.
3. Set `app_check_enforced = true` (or remove the line: it defaults to
   `true`) and run `terraform apply` again.

The order matters: enforcement rejects every client that does not send an App
Check token, and only a build carrying the site key from step 3 sends one. See
[App Check](security.md#app-check).

## 6. Create user accounts

Self sign-up is disabled: the web API key is public, so open sign-up would let
anyone create an account. Add users in the Firebase console under
**Authentication → Users → Add user**. Each user has a separate, private
library.

Users can reset their password from the sign-in page.

## 7. Connect an e-reader over OPDS

The OPDS catalog lives at `https://<your-domain>/opds`. Sign in with the
account's email and password. Read [the OPDS security
notes](security.md#opds-endpoint-http-basic-authentication-deprecated) first:
the client has to store your real password.

## Custom domain

1. Connect the domain to Firebase Hosting in the Firebase console (**Hosting →
   Add custom domain**) and create the DNS records it asks for.
2. Add it to the environment's `custom_domains` and run `terraform apply`, so
   Firebase Auth and App Check accept the new origin.

## Cost controls

- Every Cloud Function is capped at 10 instances.
- Create a budget with email alerts in the Cloud console (**Billing → Budgets
  & alerts**), scoped to your projects. Budgets alert; they do not stop
  spending.

## Operations

- Books stuck in processing are reconciled automatically; see
  [stale-processing-books.md](stale-processing-books.md) for the manual path.
- Cloud Functions deploy to `us-central1`, the Firebase default.
