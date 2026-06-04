# 🏗️ Pipeline Architecture

Detailed technical documentation of the CI/CD pipeline architecture.

## High-Level Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        CI/CD Pipeline                           │
│                                                                 │
│  ┌──────────┐   Webhook   ┌──────────┐   SSH    ┌──────────┐  │
│  │  GitHub   ├────────────►│ Jenkins  ├─────────►│  AWS EC2  │  │
│  │          │             │          │          │           │  │
│  │  Source   │             │  Build   │   Push   │  Deploy   │  │
│  │  Code     │             │  Test    ├────┐     │  Run      │  │
│  └──────────┘             │  Package │    │     └──────────┘  │
│                            └──────────┘    │                    │
│                                            ▼                    │
│                                     ┌──────────┐               │
│                                     │ Docker   │               │
│                                     │ Hub      │               │
│                                     │ Registry │               │
│                                     └──────────┘               │
└─────────────────────────────────────────────────────────────────┘
```

## Pipeline Stages in Detail

### Stage 1: Checkout

```
Jenkins ──git clone──► Local Workspace
```

- Pulls the latest code from the GitHub repository
- Extracts the **short commit hash** for image tagging
- Logs the branch name and commit for audit trail

### Stage 2: Build Docker Image

```
Dockerfile ──docker build──► Image (tagged: BUILD_NUMBER-COMMIT_SHORT)
```

- Uses **multi-stage build** for minimal image size
  - Stage 1 (`builder`): Installs Node.js dependencies
  - Stage 2 (`production`): Copies only production artifacts
- Injects `BUILD_VERSION` as a build argument
- Image tagged with `<build-number>-<commit-hash>` (e.g., `42-abc1234`)

### Stage 3: Push to Docker Hub

```
Local Image ──docker push──► Docker Hub Registry
```

- Authenticates using Jenkins credentials store
- Pushes two tags:
  - `42-abc1234` — specific version for rollbacks
  - `latest` — convenience tag for manual pulls

### Stage 4: Deploy to EC2

```
Jenkins ──SSH──► EC2 ──docker pull/run──► Running Container
```

- Copies `deploy.sh` to the EC2 instance
- Executes the deployment script which:
  1. Pulls the new image
  2. Saves the current container for rollback
  3. Stops the old container
  4. Starts the new container
  5. Runs health checks (10 attempts, 3s apart)
  6. Auto-rolls back if health check fails

## Credential Flow

```
┌─────────────────────────────────────────────────────┐
│                Jenkins Credentials Store              │
│                                                       │
│  ┌─────────────────────────┐  ┌────────────────────┐ │
│  │  dockerhub-credentials   │  │  ec2-ssh-key       │ │
│  │  (Username/Password)     │  │  (SSH Private Key)  │ │
│  └────────────┬────────────┘  └─────────┬──────────┘ │
│               │                          │             │
└───────────────┼──────────────────────────┼─────────────┘
                │                          │
                ▼                          ▼
        ┌──────────────┐          ┌──────────────┐
        │  Docker Hub   │          │   AWS EC2     │
        │  Push Image   │          │   SSH Deploy  │
        └──────────────┘          └──────────────┘
```

**Security principles:**
- ❌ No credentials hardcoded in code or Jenkinsfile
- ✅ All secrets stored in Jenkins Credentials Store
- ✅ SSH keys managed via `sshagent` plugin
- ✅ Docker Hub auth via `withRegistry` wrapper
- ✅ EC2 security group restricts SSH to Jenkins IP only

## Network Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                         Internet                              │
│                                                               │
│  ┌────────────────┐                    ┌────────────────────┐ │
│  │  Jenkins EC2    │                    │  Deploy EC2         │ │
│  │  (t2.medium)    │                    │  (t2.micro)         │ │
│  │                 │                    │                     │ │
│  │  Inbound:       │──── SSH:22 ───────►│  Inbound:           │ │
│  │  • 8080 (UI)    │                    │  • 22 (Jenkins IP)  │ │
│  │  • 22 (admin)   │                    │  • 80 (HTTP)        │ │
│  │                 │                    │  • 443 (HTTPS)      │ │
│  │  Outbound:      │                    │  • 3000 (App)       │ │
│  │  • 443 (GitHub) │                    │                     │ │
│  │  • 443 (Docker) │                    │  Outbound:          │ │
│  │  • 22 (EC2)     │                    │  • 443 (Docker Hub) │ │
│  └────────────────┘                    └────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

## Image Tagging Strategy

| Tag | Format | Example | Purpose |
|-----|--------|---------|---------|
| Version | `BUILD_NUMBER-COMMIT_SHORT` | `42-abc1234` | Unique, traceable, rollback-friendly |
| Latest | `latest` | `latest` | Convenience for manual pulls only |

**Why not just `latest`?**
- `latest` is mutable — you can't tell which version is running
- Commit-based tags are **immutable** — each tag maps to exact code
- Makes rollback trivial: just re-deploy a previous tag

## Rollback Procedure

### Automatic (built into deploy.sh)
If the health check fails after deployment, the script automatically:
1. Stops the failed container
2. Restarts the previous container image
3. Exits with error code (marks Jenkins build as failed)

### Manual Rollback
```bash
# SSH into EC2
ssh -i your-key.pem ubuntu@<ec2-ip>

# List available images
docker images

# Stop current container
docker stop cicd-demo-app
docker rm cicd-demo-app

# Run a previous version
docker run -d --name cicd-demo-app \
    --restart unless-stopped \
    -p 3000:3000 \
    yourusername/cicd-pipeline-demo:<previous-tag>
```

### Rollback via Jenkins
Re-run a previous successful build:
1. Go to Jenkins → your pipeline job
2. Click on a previous successful build number
3. Click **Replay** → **Run**

## Monitoring & Logs

### View Container Logs on EC2
```bash
# Follow live logs
docker logs -f cicd-demo-app

# Last 100 lines
docker logs --tail 100 cicd-demo-app

# Logs since a time
docker logs --since 1h cicd-demo-app
```

### Check Container Status
```bash
# Running containers
docker ps

# Container health
docker inspect --format='{{.State.Health.Status}}' cicd-demo-app

# Resource usage
docker stats cicd-demo-app --no-stream
```

### Jenkins Build History
- Dashboard → Pipeline Job → Build History
- Each build shows: trigger source, duration, logs, and status

## Future Enhancements

| Enhancement | Benefit |
|-------------|---------|
| **AWS ECR** instead of Docker Hub | Faster pulls, IAM auth, no rate limits |
| **Nginx reverse proxy** | SSL termination, domain routing |
| **Slack/Email notifications** | Team alerts on build/deploy status |
| **Blue-Green deployment** | Zero-downtime deployments |
| **Terraform** for infrastructure | Reproducible, version-controlled infra |
| **Automated tests** stage | Catch bugs before deployment |
| **Multi-environment** (dev/staging/prod) | Safe promotion workflow |
