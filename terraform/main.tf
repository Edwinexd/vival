terraform {
  required_version = ">= 1.0"

  required_providers {
    github = {
      source  = "integrations/github"
      version = "~> 6.0"
    }
  }
}

provider "github" {
  owner = var.github_owner
}

provider "github" {
  alias = "voice_grader"
  owner = var.voice_grader_owner
}

data "github_repository" "repo" {
  full_name = "${var.github_owner}/${var.github_repo}"
}

data "github_repository" "voice_grader" {
  provider  = github.voice_grader
  full_name = "${var.voice_grader_owner}/${var.voice_grader_repo}"
}

# Production Environment
resource "github_repository_environment" "prod" {
  repository  = data.github_repository.repo.name
  environment = "prod"
}

# =============================================================================
# Generated k8s secrets
# =============================================================================

locals {
  k8s_secrets_yaml = <<-YAML
    apiVersion: v1
    kind: Secret
    metadata:
      name: vival-secrets
      namespace: vival
    type: Opaque
    stringData:
      POSTGRES_USER: "${var.postgres_user}"
      POSTGRES_PASSWORD: "${var.postgres_password}"
      DATABASE_URL: "postgresql://${var.postgres_user}:${var.postgres_password}@postgres:5432/vival"
      BETTER_AUTH_SECRET: "${var.better_auth_secret}"
      BETTER_AUTH_URL: "${var.better_auth_url}"
      ADMIN_USERNAMES: "${var.admin_usernames}"
      OPENAI_API_KEY: "${var.openai_api_key}"
  YAML
}

# =============================================================================
# Prod Environment Secrets (infra repo)
# =============================================================================

resource "github_actions_environment_secret" "prod_kubeconfig" {
  repository      = data.github_repository.repo.name
  environment     = github_repository_environment.prod.environment
  secret_name     = "KUBECONFIG"
  plaintext_value = var.kubeconfig
}

resource "github_actions_environment_secret" "prod_wireguard_private_key" {
  repository      = data.github_repository.repo.name
  environment     = github_repository_environment.prod.environment
  secret_name     = "WIREGUARD_PRIVATE_KEY"
  plaintext_value = var.wireguard_private_key
}

resource "github_actions_environment_secret" "prod_wireguard_config" {
  repository      = data.github_repository.repo.name
  environment     = github_repository_environment.prod.environment
  secret_name     = "WIREGUARD_CONFIG"
  plaintext_value = var.wireguard_config
}

resource "github_actions_environment_secret" "prod_ssh_private_key" {
  repository      = data.github_repository.repo.name
  environment     = github_repository_environment.prod.environment
  secret_name     = "SSH_PRIVATE_KEY"
  plaintext_value = var.ssh_private_key
}

resource "github_actions_environment_secret" "prod_k8s_secrets" {
  repository      = data.github_repository.repo.name
  environment     = github_repository_environment.prod.environment
  secret_name     = "K8S_SECRETS"
  plaintext_value = base64encode(local.k8s_secrets_yaml)
}

resource "github_actions_environment_secret" "prod_ghcr_pat" {
  repository      = data.github_repository.repo.name
  environment     = github_repository_environment.prod.environment
  secret_name     = "GHCR_PAT"
  plaintext_value = var.ghcr_pat
}

# =============================================================================
# Voice-grader repo secret (deploy dispatch PAT)
# =============================================================================

resource "github_actions_secret" "voice_grader_deploy_pat" {
  provider        = github.voice_grader
  repository      = data.github_repository.voice_grader.name
  secret_name     = "INFRA_DEPLOY_PAT"
  plaintext_value = var.deploy_pat
}

resource "github_actions_variable" "voice_grader_better_auth_url" {
  provider      = github.voice_grader
  repository    = data.github_repository.voice_grader.name
  variable_name = "BETTER_AUTH_URL"
  value         = var.better_auth_url
}
