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
# Secrets
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

variable "k8s_secrets" {
  description = "Base64-encoded k8s secrets.yaml content"
  type        = string
  sensitive   = true
}
