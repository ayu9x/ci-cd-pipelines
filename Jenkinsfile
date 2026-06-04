pipeline {
agent any

```
stages {

    stage('Checkout') {
        steps {
            git 'https://github.com/ayu9x/ci-cd-pipelines.git'
        }
    }

    stage('Build Docker Image') {
        steps {
            sh 'docker build -t ci-cd-pipelines-app .'
        }
    }

    stage('Remove Old Container') {
        steps {
            sh '''
            docker rm -f cicd-demo-app || true
            '''
        }
    }

    stage('Run New Container') {
        steps {
            sh '''
            docker run -d \
              --name cicd-demo-app \
              -p 3000:3000 \
              ci-cd-pipelines-app
            '''
        }
    }
}

post {
    success {
        echo '✅ Deployment Successful!'
    }

    failure {
        echo '❌ Deployment Failed!'
    }
}
```

}
