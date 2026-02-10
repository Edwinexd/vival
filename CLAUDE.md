# Vival Infrastructure

Infrastructure, Kubernetes manifests, and deployment configuration for the Vival AI-powered code review and oral examination system. The application code lives in a separate repository.

## Tech Stack

- **Database:** PostgreSQL (all storage including code and audio)
- **Cache:** Redis (semaphores, job queues, email queue)
- **IDs:** Snowflake IDs via id-generator service
- **Deployment:** Kubernetes + Docker
- **CI/CD:** GitHub Actions (WireGuard VPN + SSH tunnel + kubectl)
- **IaC:** Terraform (GitHub environments/secrets)

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

## Environment Variables

See `.env.example` for required variables:
- `DATABASE_URL` - PostgreSQL connection
- `REDIS_URL` - Redis connection
- `OPENAI_API_KEY` - GPT-5 access
- `ELEVENLABS_API_KEY` - Voice agent access
- `JWT_SECRET` - Secret for JWT signing
- `ADMIN_USERNAMES` - Comma-separated admin usernames

## Production Storage (/data0)

All persistent data in production is stored on the `/data0` mount:

```
/data0/vival/
├── postgres/     # PostgreSQL data directory
├── redis/        # Redis AOF persistence
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

## Conventions

- Store all timestamps in UTC
- Use BIGINT for all primary keys (from external Snowflake generator)
- Submission statuses: 'pending', 'reviewing', 'reviewed', 'seminar_pending', 'seminar_completed', 'approved', 'rejected'
- Seminar statuses: 'booked', 'waiting', 'in_progress', 'completed', 'failed', 'no_show'
- AI grade statuses: 'pending', 'in_progress', 'completed', 'failed'
