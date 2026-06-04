# 🔗 GitHub Webhook Setup Guide

Connect GitHub to Jenkins so every `git push` automatically triggers the CI/CD pipeline.

## Prerequisites

- ✅ Jenkins is running and accessible via a public URL
- ✅ GitHub Integration plugin is installed in Jenkins
- ✅ Pipeline job is configured (see [SETUP_JENKINS.md](SETUP_JENKINS.md))

## Step 1: Get Your Jenkins Webhook URL

Your webhook URL follows this pattern:

```
https://<your-jenkins-url>/github-webhook/
```

**Examples:**
| Jenkins Location | Webhook URL |
|-----------------|-------------|
| EC2 (public IP) | `http://54.123.45.67:8080/github-webhook/` |
| EC2 (domain) | `https://jenkins.yourdomain.com/github-webhook/` |
| Local (ngrok) | `https://abc123.ngrok.io/github-webhook/` |

> ⚠️ The trailing `/` in `/github-webhook/` is **required**!

## Step 2: Create the Webhook on GitHub

1. Go to your GitHub repository
2. Click **Settings** → **Webhooks** → **Add webhook**
3. Fill in the form:

| Field | Value |
|-------|-------|
| **Payload URL** | `http://<jenkins-url>:8080/github-webhook/` |
| **Content type** | `application/json` |
| **Secret** | *(leave empty, or add a shared secret)* |
| **SSL verification** | Enable (if using HTTPS) or Disable (if HTTP) |
| **Which events?** | ◉ Just the push event |
| **Active** | ☑ Checked |

4. Click **Add webhook**

## Step 3: Verify the Webhook

After saving, GitHub sends a **ping** event to test the connection.

1. On the **Webhooks** page, click on your webhook
2. Scroll to **Recent Deliveries**
3. You should see a delivery with:
   - ✅ **Green checkmark** — webhook delivered successfully
   - **Response code**: `200`

### If you see a ❌ red X:

| Error | Fix |
|-------|-----|
| **Could not connect** | Jenkins is not publicly accessible. Use ngrok or check security groups |
| **403 Forbidden** | Go to Jenkins → Manage Jenkins → Security → enable "Allow anonymous read access" for the webhook endpoint, OR configure CSRF exclusion |
| **404 Not Found** | Check the URL ends with `/github-webhook/` (with trailing slash) |
| **Connection timed out** | Security group doesn't allow inbound on port 8080 from GitHub IPs |

## Step 4: Test End-to-End

1. Make a small change to any file in your repository:
   ```bash
   echo "# test" >> README.md
   git add .
   git commit -m "Test webhook trigger"
   git push origin main
   ```

2. Go to Jenkins dashboard — you should see a new build started automatically!

3. Check GitHub **Recent Deliveries** — the push event should show `200 OK`

## How It Works

```
┌──────────┐                    ┌──────────┐
│  GitHub   │  POST /github-    │  Jenkins  │
│           │  webhook/         │           │
│  1. Push  ├──────────────────►│  2. Build │
│           │  Payload: {       │  Trigger  │
│           │    ref: main,     │           │
│           │    commits: [...] │  3. Run   │
│           │  }                │  Pipeline │
└──────────┘                    └──────────┘
```

1. Developer pushes code to GitHub
2. GitHub fires the webhook → sends POST request to Jenkins
3. Jenkins receives the webhook → matches it to the pipeline job
4. Pipeline starts: Checkout → Build → Push → Deploy

## Security Best Practices

### Add a Webhook Secret (Recommended)

1. Generate a random secret:
   ```bash
   openssl rand -hex 20
   ```

2. Add it to both:
   - **GitHub webhook** → Secret field
   - **Jenkins** → Manage Jenkins → System → GitHub → Advanced → Shared Secret

### Restrict GitHub IPs

GitHub webhooks come from specific IP ranges. You can restrict your Jenkins security group:

```
# GitHub webhook IP ranges (check https://api.github.com/meta for current list)
192.30.252.0/22
185.199.108.0/22
140.82.112.0/20
```

## CSRF Troubleshooting (403 Errors)

If Jenkins returns `403 Forbidden` for webhook requests:

### Option 1: Jenkins System Configuration
Go to **Manage Jenkins → Security** and ensure:
- "CSRF Protection" is enabled (it should be)
- Add the GitHub webhook path to the CSRF exclusion list

### Option 2: Via Groovy Script
Go to **Manage Jenkins → Script Console** and run:
```groovy
import hudson.security.csrf.DefaultCrumbIssuer
def instance = Jenkins.getInstance()
instance.setCrumbIssuer(new DefaultCrumbIssuer(true))
instance.save()
```

This enables the crumb issuer to accept forwarded headers.
