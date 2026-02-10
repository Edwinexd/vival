variable "github_owner" {
  description = "GitHub repository owner"
  type        = string
  default     = "Edwinexd"
}

variable "github_repo" {
  description = "GitHub repository name"
  type        = string
  default     = "dsv-prog2review"
}

# =============================================================================
# Infrastructure Secrets
# =============================================================================

variable "kubeconfig" {
  description = "Base64-encoded kubeconfig for cluster"
  type        = string
  sensitive   = true
}

variable "wireguard_private_key" {
  description = "WireGuard private key for VPN"
  type        = string
  sensitive   = true
}

variable "wireguard_config" {
  description = "WireGuard configuration file content (without PrivateKey)"
  type        = string
  sensitive   = true
}

variable "ssh_private_key" {
  description = "SSH private key for CI user to tunnel to k3s"
  type        = string
  sensitive   = true
}

variable "ghcr_pat" {
  description = "GitHub PAT with read:packages scope for pulling private images from ghcr.io"
  type        = string
  sensitive   = true
}

# =============================================================================
# Application Secrets (used to generate k8s secrets.yaml)
# =============================================================================

variable "postgres_user" {
  description = "PostgreSQL username"
  type        = string
  default     = "vival"
}

variable "postgres_password" {
  description = "PostgreSQL password"
  type        = string
  sensitive   = true
}

variable "auth_secret" {
  description = "NextAuth secret (generate with: openssl rand -base64 32)"
  type        = string
  sensitive   = true
}

variable "admin_usernames" {
  description = "Comma-separated admin usernames"
  type        = string
}

variable "openai_api_key" {
  description = "OpenAI API key"
  type        = string
  sensitive   = true
}
