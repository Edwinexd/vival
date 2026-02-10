# Vival Infrastructure

Infrastructure, Kubernetes manifests, and deployment configuration for the Vival AI-powered code review and oral examination system.

Application code: https://github.com/isaksamsten/voice-grader (symlinked as `voice-grader/`)

## Tech Stack

- **Application:** Next.js (voice-grader) with web + worker + migrate images
- **Database:** PostgreSQL 16
- **Cache/Queue:** Redis 7 (BullMQ job queue)
- **IDs:** Snowflake IDs via id-generator service
- **Container Registry:** ghcr.io/isaksamsten/voice-grader (private, requires PAT)
- **Deployment:** Kubernetes + Docker
- **CI/CD:** GitHub Actions (WireGuard VPN + SSH tunnel + kubectl)
- **IaC:** Terraform (GitHub environments/secrets)

## Container Images

From the voice-grader repo (pushed to ghcr.io on push to `main`):
- `ghcr.io/isaksamsten/voice-grader/web:main` - Next.js web server
- `ghcr.io/isaksamsten/voice-grader/worker:main` - Background worker (analysis jobs)
- `ghcr.io/isaksamsten/voice-grader/migrate:main` - Database migrations (drizzle-kit)

## Commands

```bash
# Local Development
docker-compose up -d    # Start Postgres + Redis + ID generator

# Kubernetes
kubectl apply -k k8s/overlays/prod

# Terraform (GitHub environments/secrets)
cd terraform && terraform init
terraform plan -var-file=terraform.tfvars
terraform apply -var-file=terraform.tfvars

# Local Database (Docker)
docker exec vival-postgres psql -U vival -d vival -c "SQL"

# Production Access
ssh prog2review        # SSH to production server
sudo su                # Switch to root (required for full access)
```

## GitHub Actions Secrets Required

- `WIREGUARD_CONFIG` - WireGuard VPN config
- `WIREGUARD_PRIVATE_KEY` - WireGuard private key
- `SSH_PRIVATE_KEY` - SSH key for tunnel to prod server
- `KUBECONFIG` - Base64-encoded kubeconfig
- `K8S_SECRETS` - Base64-encoded k8s secrets YAML
- `GHCR_PAT` - GitHub PAT with `read:packages` scope for pulling private images

## Production Storage (/data0)

All persistent data in production is stored on the `/data0` mount:

```
/data0/vival/
├── postgres/     # PostgreSQL data directory
├── redis/        # Redis AOF persistence
├── data/         # Application data (assignments, exams)
└── backups/      # Daily PostgreSQL dumps (14 days retention)
```

**Backup CronJob:**
- Runs daily at 03:00 UTC via k8s CronJob (`k8s/base/backup.yaml`)
- Creates gzipped pg_dump: `vival-YYYY-MM-DD_HHMMSS.sql.gz`
- Retains last 14 backups automatically

**Restore from backup:**
```bash
# List available backups
ls -la /data0/vival/backups/

# Restore (replace DATE with actual backup date)
gunzip -c /data0/vival/backups/vival-DATE.sql.gz | kubectl exec -i -n vival deploy/postgres -- psql -U vival -d vival
```

## File Structure

```
k8s/
├── base/               # Base Kubernetes manifests
│   ├── app.yaml        # Web deployment + migrate init container
│   ├── worker.yaml     # Background worker deployment
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

## Deployment Flow

1. voice-grader repo pushes to `main` -> builds and pushes images to ghcr.io
2. Trigger `Deploy to Production` workflow (manual via workflow_dispatch)
3. Workflow connects via WireGuard VPN + SSH tunnel
4. Creates `ghcr-secret` for pulling private images (from `GHCR_PAT`)
5. Applies k8s manifests, restarts web + worker deployments
6. Migrations run automatically via init container on the web pod
