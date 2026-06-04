# 🔧 Jenkins Setup Guide

Step-by-step guide to install and configure Jenkins for the CI/CD pipeline.

## Option A: Jenkins on AWS EC2 (Recommended)

### Step 1: Launch EC2 Instance for Jenkins

1. Go to **AWS Console → EC2 → Launch Instance**
2. Settings:
   - **Name**: `jenkins-server`
   - **AMI**: Ubuntu 22.04 LTS
   - **Instance type**: `t2.medium` (Jenkins needs at least 2 GB RAM)
   - **Key pair**: Create or select a key pair
   - **Security Group** — allow:
     | Port | Source | Purpose |
     |------|--------|---------|
     | 22 | Your IP | SSH access |
     | 8080 | Anywhere (0.0.0.0/0) | Jenkins web UI |
     | 443 | Anywhere | HTTPS (optional) |

3. Click **Launch Instance**

### Step 2: Install Jenkins

SSH into the instance and run:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Java 17 (required by Jenkins)
sudo apt install -y openjdk-17-jdk

# Add Jenkins repository
curl -fsSL https://pkg.jenkins.io/debian-stable/jenkins.io-2023.key | \
    sudo tee /usr/share/keyrings/jenkins-keyring.asc > /dev/null

echo "deb [signed-by=/usr/share/keyrings/jenkins-keyring.asc] \
    https://pkg.jenkins.io/debian-stable binary/" | \
    sudo tee /etc/apt/sources.list.d/jenkins.list > /dev/null

# Install Jenkins
sudo apt update
sudo apt install -y jenkins

# Start Jenkins
sudo systemctl enable jenkins
sudo systemctl start jenkins

# Get the initial admin password
sudo cat /var/lib/jenkins/secrets/initialAdminPassword
```

### Step 3: Install Docker on Jenkins Server

Jenkins needs Docker to build images:

```bash
# Install Docker
curl -fsSL https://get.docker.com | sudo sh

# Add Jenkins user to docker group
sudo usermod -aG docker jenkins

# Restart Jenkins to pick up group change
sudo systemctl restart jenkins
```

### Step 4: Initial Jenkins Configuration

1. Open `http://<jenkins-ec2-ip>:8080` in your browser
2. Enter the **initial admin password** from Step 2
3. Click **Install suggested plugins**
4. Create your admin user account
5. Set the Jenkins URL (use the EC2 public IP)

### Step 5: Install Required Plugins

Go to **Manage Jenkins → Plugins → Available plugins** and install:

| Plugin | Purpose |
|--------|---------|
| **GitHub Integration** | Webhook trigger support |
| **Docker Pipeline** | Docker build/push in pipelines |
| **SSH Agent** | SSH key management for EC2 deploy |
| **Pipeline** | Declarative pipeline support |
| **Git** | Git SCM integration |

Click **Install** and restart Jenkins when prompted.

### Step 6: Add Credentials

Go to **Manage Jenkins → Credentials → System → Global Credentials → Add Credentials**

#### Docker Hub Credentials
| Field | Value |
|-------|-------|
| Kind | Username with password |
| Scope | Global |
| Username | Your Docker Hub username |
| Password | Your Docker Hub password or access token |
| ID | `dockerhub-credentials` |
| Description | Docker Hub login |

#### EC2 SSH Key
| Field | Value |
|-------|-------|
| Kind | SSH Username with private key |
| Scope | Global |
| ID | `ec2-ssh-key` |
| Username | `ubuntu` |
| Private Key | Enter directly → paste your `.pem` file contents |
| Description | EC2 deployment SSH key |

### Step 7: Configure GitHub Server

Go to **Manage Jenkins → System → GitHub → Add GitHub Server**

| Field | Value |
|-------|-------|
| Name | `github` |
| API URL | `https://api.github.com` |
| Credentials | Add a "Secret text" credential with your GitHub Personal Access Token |

> **GitHub PAT Scopes needed**: `repo`, `admin:repo_hook`

### Step 8: Create the Pipeline Job

1. Click **New Item** on the Jenkins dashboard
2. Enter name: `cicd-pipeline-demo`
3. Select **Pipeline** → click **OK**
4. Configuration:
   - **Build Triggers**: ☑ GitHub hook trigger for GITScm polling
   - **Pipeline**:
     - Definition: **Pipeline script from SCM**
     - SCM: **Git**
     - Repository URL: `https://github.com/yourusername/your-repo.git`
     - Branch: `*/main`
     - Script Path: `Jenkinsfile`
5. Click **Save**

---

## Option B: Jenkins on Your Local Machine

If running Jenkins locally, you need **ngrok** to expose it to GitHub webhooks.

### Install ngrok

```bash
# Download from https://ngrok.com/download
# Expose Jenkins
ngrok http 8080
```

Copy the `https://*.ngrok.io` URL — use this as your Jenkins URL when configuring the GitHub webhook.

> ⚠️ The ngrok URL changes each time you restart it (free tier). For production, use a cloud-hosted Jenkins server.

---

## Verify Jenkins Setup

1. Go to `http://<jenkins-url>:8080`
2. Check all plugins are installed: **Manage Jenkins → Plugins → Installed**
3. Verify credentials: **Manage Jenkins → Credentials**
4. Run the pipeline manually: Open the job → click **Build Now**
5. Check the **Console Output** for any errors

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Permission denied" on Docker | Run `sudo usermod -aG docker jenkins` and restart Jenkins |
| Jenkins can't reach GitHub | Check security group allows outbound HTTPS (443) |
| Build hangs on `docker build` | Ensure EC2 has enough disk space (`df -h`) |
| "Host key verification failed" | The `StrictHostKeyChecking=no` flag in Jenkinsfile handles this |
