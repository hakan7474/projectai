pipeline {
  agent any
  environment {
    // --- AWS & ECR Configuration ---
    AWS_ACCOUNT_ID = "342894954293"
    AWS_DEFAULT_REGION = "eu-central-1"

    // --- Image Configuration ---
    IMAGE_REPO_NAME = "hipo-test"
    APP_NAME = "projectai-aydin-demo"
    DOCKERFILE_PATH = "Dockerfile"
    BUILD_CONTEXT = "."

    // --- Deployment Configuration ---
    DEPLOY_SERVER = "207.154.215.120"
    DEPLOY_PATH = "/www/wwwroot/aydin-demo/projectai"
    SSH_CREDENTIALS_ID = "207.154.215.120"
    HOST_PORT = "3006"
    CONTAINER_PORT = "3006"
   
    // --- Environment Variables from Jenkins Credentials ---
    MONGODB_URI = credentials('projectai-mongodb-uri')
    NEXTAUTH_URL="http://localhost:3006"
    NEXTAUTH_SECRET = credentials('projectai-nextauth-secret')
    GEMINI_API_KEY = credentials('projectai-gemini-api-key')
  }

  stages {

    stage('Checkout Code') {
      steps {
        echo "Checking out source that contains this Jenkinsfile..."
        checkout scm
      }
    }

    stage('Login to AWS ECR') {
      steps {
        echo "Logging into AWS ECR..."
        sh "aws ecr get-login-password --region ${AWS_DEFAULT_REGION} | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_DEFAULT_REGION}.amazonaws.com"
      }
    }

    stage('Build & Push to ECR') {
      steps {
        script {
          echo "Building and pushing Docker image..."
          def commitHash = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
          def imageTag = "${APP_NAME}-${commitHash}"
          env.IMAGE_URI = "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_DEFAULT_REGION}.amazonaws.com/${IMAGE_REPO_NAME}:${imageTag}"

          docker.withRegistry("https://${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_DEFAULT_REGION}.amazonaws.com") {
            def customImage = docker.build(
              env.IMAGE_URI,
              "--build-arg MONGODB_URI='${MONGODB_URI}' " +
              "--build-arg NEXTAUTH_URL='${NEXTAUTH_URL}' " +
              "--build-arg NEXTAUTH_SECRET='${NEXTAUTH_SECRET}' " +
              "--build-arg GEMINI_API_KEY='${GEMINI_API_KEY}' " +
              "-f ${DOCKERFILE_PATH} ${BUILD_CONTEXT}"
            )
            customImage.push()
            
          }          
        }
      }
    }

    stage('Deploy to Server') {
      environment {
        SERVER_CREDENTIALS = credentials('207.154.215.120')
      }
      steps {
        echo "Deploying frontend to production server..."
        script {
          // 1. Sunucuda gerekli klasörler
          sh '''
SSHPASS="$SERVER_CREDENTIALS_PSW" sshpass -e ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null "$SERVER_CREDENTIALS_USR@$DEPLOY_SERVER" "mkdir -p $DEPLOY_PATH $DEPLOY_PATH/data"
          '''

           // 2. docker-compose.yml dosyasını kopyala
          sh '''
SSHPASS="$SERVER_CREDENTIALS_PSW" sshpass -e scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null docker-compose.yml "$SERVER_CREDENTIALS_USR@$DEPLOY_SERVER:$DEPLOY_PATH/"
          '''

          // 3. .env içinden gerekli satırları çekip sunucudaki .env dosyasını oluştur/güncelle
          sh '''          
          SSHPASS="$SERVER_CREDENTIALS_PSW" sshpass -e ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null "$SERVER_CREDENTIALS_USR@$DEPLOY_SERVER" "cat > $DEPLOY_PATH/.env <<EOF
          MONGODB_URI=$MONGODB_URI
          NEXTAUTH_URL=$NEXTAUTH_URL
          NEXT_PUBLIC_API_URL=$BACKEND_PUBLIC_URL
          NEXTAUTH_SECRET=$NEXTAUTH_SECRET
          GEMINI_API_KEY=$GEMINI_API_KEY          
          PORT=3006
          EOF"
          
          '''


           // 4. Deploy sunucusunda AWS ECR'ye login ol, imajı çek ve compose'u ayağa kaldır
          sh '''
SSHPASS="$SERVER_CREDENTIALS_PSW" sshpass -e ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null "$SERVER_CREDENTIALS_USR@$DEPLOY_SERVER" "aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com && \
  cd $DEPLOY_PATH && \
  docker compose -f docker-compose.yml pull && \
  docker compose -f docker-compose.yml up -d --remove-orphans && \
  docker image prune -af"
          '''
        }
      }
    }   
  
  }

  post {
    always {
      echo 'Pipeline finished.'
      script {
        if (env.IMAGE_URI) {
          sh "docker rmi ${env.IMAGE_URI} || true"
        }
      }
    }
  }
}
