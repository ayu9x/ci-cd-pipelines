// ============================================================
// Jenkinsfile — Declarative CI/CD Pipeline
// ============================================================
// Trigger:  GitHub Webhook (push to main branch)
// Flow:     Checkout → Build Docker Image → Push to Registry → Deploy to EC2
// ============================================================

pipeline {
    agent any

    // ─── Trigger on GitHub push ─────────────────────────────
    triggers {
        githubPush()
    }

    // ─── Environment variables ──────────────────────────────
    // Update these values with your actual configuration.
    // Credentials are stored in Jenkins Credentials Store.
    environment {
        // Docker Hub
        DOCKER_HUB_CREDENTIALS = credentials('dockerhub-credentials')
        DOCKER_HUB_REPO        = 'yourdockerhubusername/cicd-pipeline-demo'

        // AWS EC2
        EC2_HOST               = '0.0.0.0'         // Replace with your EC2 Public IP
        EC2_USER               = 'ubuntu'           // Default for Ubuntu AMI
        EC2_SSH_CREDENTIALS    = 'ec2-ssh-key'      // Jenkins credential ID for SSH key

        // Application
        APP_NAME               = 'cicd-demo-app'
        APP_PORT               = '3000'
        IMAGE_TAG              = "${env.BUILD_NUMBER}-${env.GIT_COMMIT?.take(7) ?: 'unknown'}"
    }

    // ─── Pipeline Options ───────────────────────────────────
    options {
        timeout(time: 15, unit: 'MINUTES')
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timestamps()
    }

    // ─── Stages ─────────────────────────────────────────────
    stages {

        // ── 1. Checkout ─────────────────────────────────────
        stage('Checkout') {
            steps {
                echo '📥 Pulling latest code from GitHub...'
                checkout scm
                script {
                    env.GIT_COMMIT_SHORT = sh(
                        script: 'git rev-parse --short HEAD',
                        returnStdout: true
                    ).trim()
                    env.GIT_BRANCH_NAME = sh(
                        script: 'git rev-parse --abbrev-ref HEAD',
                        returnStdout: true
                    ).trim()
                    echo "Branch: ${env.GIT_BRANCH_NAME} | Commit: ${env.GIT_COMMIT_SHORT}"
                }
            }
        }

        // ── 2. Build Docker Image ───────────────────────────
        stage('Build Docker Image') {
            steps {
                echo "🐳 Building Docker image: ${DOCKER_HUB_REPO}:${IMAGE_TAG}"
                script {
                    dockerImage = docker.build(
                        "${DOCKER_HUB_REPO}:${IMAGE_TAG}",
                        "--build-arg BUILD_VERSION=${IMAGE_TAG} ."
                    )
                }
            }
        }

        // ── 3. Push to Docker Hub ───────────────────────────
        stage('Push to Docker Hub') {
            steps {
                echo "📦 Pushing image to Docker Hub..."
                script {
                    docker.withRegistry('https://index.docker.io/v1/', 'dockerhub-credentials') {
                        dockerImage.push("${IMAGE_TAG}")
                        dockerImage.push('latest')
                    }
                }
            }
        }

        // ── 4. Deploy to AWS EC2 ────────────────────────────
        stage('Deploy to EC2') {
            steps {
                echo "🚀 Deploying to EC2 (${EC2_HOST})..."
                sshagent(credentials: [EC2_SSH_CREDENTIALS]) {
                    sh """
                        # Copy deployment script to EC2
                        scp -o StrictHostKeyChecking=no \
                            scripts/deploy.sh \
                            ${EC2_USER}@${EC2_HOST}:/tmp/deploy.sh

                        # Execute deployment on EC2
                        ssh -o StrictHostKeyChecking=no ${EC2_USER}@${EC2_HOST} \
                            "chmod +x /tmp/deploy.sh && \
                             /tmp/deploy.sh \
                                ${DOCKER_HUB_REPO} \
                                ${IMAGE_TAG} \
                                ${APP_NAME} \
                                ${APP_PORT}"
                    """
                }
            }
        }
    }

    // ─── Post-build actions ─────────────────────────────────
    post {
        success {
            echo """
            ✅ ═══════════════════════════════════════════════
               DEPLOYMENT SUCCESSFUL!
               Image: ${DOCKER_HUB_REPO}:${IMAGE_TAG}
               Host:  http://${EC2_HOST}:${APP_PORT}
            ═══════════════════════════════════════════════
            """
        }
        failure {
            echo """
            ❌ ═══════════════════════════════════════════════
               DEPLOYMENT FAILED!
               Check the logs above for details.
            ═══════════════════════════════════════════════
            """
        }
        always {
            // Clean up local Docker images to save disk space
            sh "docker rmi ${DOCKER_HUB_REPO}:${IMAGE_TAG} || true"
            cleanWs()
        }
    }
}
