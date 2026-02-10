# Vival Infrastructure

Infrastructure, Kubernetes manifests, and deployment configuration for Vival - an AI-powered code review and oral examination system.

The application code lives in a separate repository.

## Infrastructure

- **Kubernetes:** Manifests for PostgreSQL, Redis, ID generator, app deployment, backups
- **Terraform:** GitHub environments and secrets (WireGuard VPN + kubectl)
- **CI/CD:** GitHub Actions for deployment via WireGuard + SSH tunnel
- **Docker Compose:** Local development (Postgres + Redis + ID generator)

## Structure

```
k8s/
├── base/               # Base Kubernetes manifests
│   ├── app.yaml        # Application deployment
│   ├── backup.yaml     # Daily PostgreSQL backup CronJob
│   ├── id-generator.yaml
│   ├── kustomization.yaml
│   ├── namespace.yaml
│   ├── postgres.yaml
│   ├── redis.yaml
│   └── secrets.yaml.template
└── overlays/
    └── prod/           # Production overrides

terraform/              # GitHub environments and secrets
├── main.tf
├── variables.tf
├── outputs.tf
└── terraform.tfvars.example

.github/workflows/
└── deploy.yml          # Deploy to production via WireGuard + k8s
```

## Local Development

```bash
# Start Postgres + Redis + ID generator
docker compose up -d
```

## Deployment

Deployment runs via GitHub Actions (`deploy.yml`):
1. Connects to production server via WireGuard VPN
2. Opens SSH tunnel for kubectl access
3. Applies Kubernetes manifests
4. Restarts app deployment and runs DB migrations

Manual deploy: trigger the "Deploy to Production" workflow via GitHub Actions.

## Production Storage (/data0)

```
/data0/vival/
├── postgres/     # PostgreSQL data directory
├── redis/        # Redis AOF persistence
└── backups/      # Daily PostgreSQL dumps (14 days retention)
```

## License

AGPL-3.0 License. See [LICENSE](LICENSE) for details.
