# ☁️ AWS EC2 Setup Guide

Set up an EC2 instance as the deployment target for the CI/CD pipeline.

## Step 1: Launch an EC2 Instance

1. Go to **AWS Console → EC2 → Launch Instance**
2. Configure:

| Setting | Value |
|---------|-------|
| **Name** | `cicd-deploy-target` |
| **AMI** | Ubuntu Server 22.04 LTS (64-bit x86) |
| **Instance type** | `t2.micro` (free tier) or `t2.small` |
| **Key pair** | Create new → download the `.pem` file |
| **Network** | Default VPC |

### Security Group Rules

Create a new security group with these rules:

| Type | Port | Source | Purpose |
|------|------|--------|---------|
| SSH | 22 | Jenkins server IP `/32` | SSH from Jenkins only |
| HTTP | 80 | 0.0.0.0/0 | Web traffic |
| HTTPS | 443 | 0.0.0.0/0 | Secure web traffic |
| Custom TCP | 3000 | 0.0.0.0/0 | Application port |

> 🔒 **Security tip**: Restrict SSH (port 22) to only your Jenkins server's IP address. Never use `0.0.0.0/0` for SSH in production.

### Storage

- **Size**: 20 GB (default 8 GB fills up quickly with Docker images)
- **Type**: gp3

3. Click **Launch Instance**

## Step 2: Connect to Your Instance

```bash
# Make the key file read-only
chmod 400 your-key.pem

# SSH into the instance
ssh -i your-key.pem ubuntu@<ec2-public-ip>
```

## Step 3: Run the Setup Script

The project includes an automated setup script:

```bash
# Upload the script
scp -i your-key.pem scripts/setup-ec2.sh ubuntu@<ec2-public-ip>:~/

# SSH in and run it
ssh -i your-key.pem ubuntu@<ec2-public-ip>
sudo chmod +x setup-ec2.sh
sudo ./setup-ec2.sh
```

This script automatically:
- ✅ Updates system packages
- ✅ Installs Docker & Docker Compose
- ✅ Adds `ubuntu` user to docker group
- ✅ Configures Docker log rotation
- ✅ Sets up UFW firewall
- ✅ Installs utility tools (htop, jq, net-tools)

## Step 4: Verify Docker Installation

```bash
# Log out and back in (for docker group to take effect)
exit
ssh -i your-key.pem ubuntu@<ec2-public-ip>

# Test Docker (should run without sudo)
docker run hello-world

# Check versions
docker --version
docker compose version
```

Expected output:
```
Docker version 24.x.x, build xxxxxxx
Docker Compose version v2.x.x
```

## Step 5: (Optional) Login to Docker Hub

If you're using **private images** on Docker Hub:

```bash
docker login
# Enter your Docker Hub username and password/token
```

> For **public images**, Docker Hub login is not required on the deployment server.

## Step 6: Elastic IP (Recommended)

By default, EC2 public IPs change when you stop/start the instance.

1. Go to **EC2 → Elastic IPs → Allocate Elastic IP address**
2. Click **Allocate**
3. Select the new IP → **Actions → Associate Elastic IP address**
4. Select your `cicd-deploy-target` instance
5. Click **Associate**

Now update your `Jenkinsfile` with this permanent IP:
```groovy
EC2_HOST = '<your-elastic-ip>'
```

## Instance Architecture

```
EC2 Instance (cicd-deploy-target)
├── Ubuntu 22.04 LTS
├── Docker Engine
│   └── cicd-demo-app (container)
│       ├── Port 3000 → Node.js app
│       └── Health check: /health
├── UFW Firewall
│   ├── Allow 22  (SSH from Jenkins)
│   ├── Allow 80  (HTTP)
│   ├── Allow 443 (HTTPS)
│   └── Allow 3000 (App)
└── Docker logs → /var/lib/docker/containers/
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `Permission denied (publickey)` | Check `.pem` file permissions: `chmod 400 your-key.pem` |
| `Connection timed out` | Security group doesn't allow SSH from your IP |
| `docker: command not found` | Run `setup-ec2.sh` or install Docker manually |
| `Cannot connect to Docker daemon` | Log out and back in, or run `sudo usermod -aG docker ubuntu` |
| Disk full | Increase EBS volume size, or run `docker system prune -af` |
| App not accessible in browser | Check security group allows port 3000 from 0.0.0.0/0 |

## Cost Estimation

| Resource | Free Tier | After Free Tier |
|----------|-----------|-----------------|
| t2.micro | 750 hrs/month (12 months) | ~$8.50/month |
| EBS (20 GB gp3) | 30 GB free | ~$1.60/month |
| Elastic IP (in use) | Free | Free |
| Data Transfer | 100 GB/month | ~$0.09/GB |

> 💡 Remember to **stop** your instance when not in use to avoid charges!
