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

data "github_repository" "repo" {
  full_name = "${var.github_owner}/${var.github_repo}"
}

# Production Environment
resource "github_repository_environment" "prod" {
  repository  = data.github_repository.repo.name
  environment = "prod"
}

# =============================================================================
# Prod Environment Secrets
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
