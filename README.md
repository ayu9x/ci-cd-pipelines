# 🚀 CI/CD Pipeline — Auto Deploy on GitHub Push

Fully automated CI/CD pipeline that deploys your app every time you push to GitHub.

```
GitHub Push  →  Jenkins  →  Docker Build  →  Docker Hub  →  AWS EC2
```

## Architecture

```
┌──────────────┐     Webhook     ┌──────────────┐
│   GitHub     │ ──────────────► │   Jenkins    │
│   (Push)     │                 │   (CI/CD)    │
└──────────────┘                 └──────┬───────┘
                                        │
                                        ▼
                                 ┌──────────────┐
                                 │   Docker     │
                                 │   Build      │
                                 └──────┬───────┘
                                        │
                                        ▼
                                 ┌──────────────┐
                                 │  Docker Hub  │
                                 │  (Registry)  │
                                 └──────┬───────┘
                                        │
                                        ▼
                                 ┌──────────────┐
                                 │   AWS EC2    │
                                 │   (Deploy)   │
                                 └──────────────┘
```

## Tech Stack

| Tool | Purpose |
|------|---------|
| **GitHub** | Source code repository + webhooks |
| **Jenkins** | CI/CD orchestration |
| **Docker** | Containerize the application |
| **Docker Hub** | Container image registry |
| **AWS EC2** | Production deployment target |

## Project Structure

```
├── app/
│   ├── server.js              # Express application
│   └── package.json           # Dependencies
├── scripts/
│   ├── deploy.sh              # Deployment script (runs on EC2)
│   └── setup-ec2.sh           # EC2 provisioning (one-time)
├── docs/
│   ├── SETUP_JENKINS.md       # Jenkins setup guide
│   ├── SETUP_GITHUB_WEBHOOK.md # Webhook configuration
│   ├── SETUP_EC2.md           # EC2 setup guide
│   └── ARCHITECTURE.md        # Detailed architecture docs
├── Dockerfile                  # Multi-stage Docker build
├── docker-compose.yml          # Local development
├── Jenkinsfile                 # CI/CD pipeline definition
└── README.md                   # This file
```

## Quick Start

### 1. Set Up Infrastructure
Follow the setup guides in order:
1. [EC2 Setup](docs/SETUP_EC2.md) — Provision your deployment server
2. [Jenkins Setup](docs/SETUP_JENKINS.md) — Install and configure Jenkins
3. [GitHub Webhook](docs/SETUP_GITHUB_WEBHOOK.md) — Connect GitHub to Jenkins

### 2. Configure Jenkins Credentials
Add these credentials in Jenkins (**Manage Jenkins → Credentials**):

| ID | Type | Description |
|----|------|-------------|
| `dockerhub-credentials` | Username/Password | Docker Hub login |
| `ec2-ssh-key` | SSH Username with Private Key | EC2 `.pem` key |

### 3. Update Jenkinsfile
Edit the `environment` block in `Jenkinsfile`:
```groovy
DOCKER_HUB_REPO = 'yourdockerhubusername/cicd-pipeline-demo'
EC2_HOST         = 'your-ec2-public-ip'
```

### 4. Push and Deploy!
```bash
git add .
git commit -m "Initial CI/CD pipeline"
git push origin main
```
Jenkins will automatically build, push, and deploy your app. 🎉

### 5. Verify
```bash
curl http://your-ec2-ip:3000          # App info
curl http://your-ec2-ip:3000/health   # Health check
```

## Local Development

```bash
# Run with Docker Compose
docker compose up --build

# Or run directly
cd app
npm install
npm run dev
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | App status, version, deploy time |
| `/health` | GET | Health check |
| `/info` | GET | System info (Node version, memory, etc.) |

## Pipeline Stages

| # | Stage | What Happens |
|---|-------|-------------|
| 1 | **Checkout** | Pulls latest code from GitHub |
| 2 | **Build** | Builds Docker image with commit-tagged version |
| 3 | **Push** | Pushes image to Docker Hub |
| 4 | **Deploy** | SSHs into EC2, pulls image, restarts container |

The deploy stage includes **automatic health checks** and **rollback** if the new version fails to start.

## License

MIT
