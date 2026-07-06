/* groovylint-disable NoDef, VariableTypeRequired */
pipeline {
  agent any

  options {
      skipDefaultCheckout true
      timestamps()
      disableConcurrentBuilds()
      timeout(time: 1, unit: 'HOURS')
  }

  environment {
    DOCKER_REGISTRY_HTTP = 'http://10.0.0.102:5000'
    DOCKER_REGISTRY = '10.0.0.102:5000'
    DOCKER_USERNAME = 'ged'

    APP_NAME             = 'pme-front'
    APP_NETWORK          = 'app-network'

    // Configuration Git
    GIT                  = 'Default'

    // Cible de Déploiement (Proxmox)
    REMOTE_USER          = 'jenkins-deploy'
    REMOTE_HOST          = '10.0.0.101'
    SSH_ID               = 'proxmox-ssh-key'

    // SonarQube
    SONAR_HOST_URL       = 'http://10.0.0.102:9100/sonarq'
  }

  tools {
    git "${GIT}"
  }

  stages {
      stage('Prepare & Clone') {
        steps {
          checkout scm

          script {
            env.COMMIT_ID = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
          }
        }
      }

      stage('Compile & Test') {
        steps {
          echo 'Exécution des tests dans Docker...'
          withCredentials([string(credentialsId: 'github-pat', variable: 'GITHUB_TOKEN')]) {
            sh """
              DOCKER_BUILDKIT=1 docker build \
                --target tester \
                --build-arg GITHUB_TOKEN=${GITHUB_TOKEN} \
                .
            """
          }
        }
      }

      stage('SonarQube Analysis') {
        steps {
          echo 'Exécution de l\'analyse SonarQube dans Docker...'
          withCredentials([
            string(credentialsId: 'github-pat', variable: 'GITHUB_TOKEN'),
            string(credentialsId: 'sonar-token', variable: 'SONAR_TOKEN')
          ]) {
            sh """
              DOCKER_BUILDKIT=1 docker build \
                --target sonar \
                --build-arg GITHUB_TOKEN=${GITHUB_TOKEN} \
                --build-arg SONAR_HOST_URL=${SONAR_HOST_URL} \
                --secret id=SONAR_TOKEN,env=SONAR_TOKEN \
                .
            """
          }
        }
      }

    stage('Docker Build') {
      steps {
        script {
          def appImage = "${DOCKER_USERNAME}/${APP_NAME}:latest"
          withCredentials([string(credentialsId: 'github-pat', variable: 'GITHUB_TOKEN')]) {
            sh """
                            DOCKER_BUILDKIT=1 docker build \\
                                --cache-from ${DOCKER_REGISTRY}/${appImage} \\
                                --build-arg GITHUB_TOKEN=${GITHUB_TOKEN} \\
                                --secret id=GITHUB_TOKEN,env=GITHUB_TOKEN \\
                                -t ${appImage} \\
                                -f Dockerfile .
                        """
          }
        }
      }
        }

    stage('Trivy — Security Scan') {
      steps {
        script {
          def appImage = "${DOCKER_USERNAME}/${APP_NAME}:latest"
          sh """
            docker run --rm \\
              -v /var/run/docker.sock:/var/run/docker.sock \\
              -v \$HOME/.trivy-cache:/root/.cache/trivy \\
              aquasec/trivy:latest image \\
              --severity CRITICAL,HIGH \\
              --ignore-unfixed \\
              --format table \\
              ${appImage} || true
          """
          sh """
            docker run --rm \\
              -v /var/run/docker.sock:/var/run/docker.sock \\
              -v \$HOME/.trivy-cache:/root/.cache/trivy \\
              -v ${WORKSPACE}:/workspace \\
              aquasec/trivy:latest image \\
              --severity CRITICAL \\
              --ignore-unfixed \\
              --exit-code 1 \\
              --format json \\
              --output /workspace/trivy-report.json \\
              ${appImage}
          """
        }
      }
      post {
        always {
          archiveArtifacts artifacts: 'trivy-report.json', allowEmptyArchive: true
        }
      }
    }
    stage('Docker Push') {
      steps {
        script {
          def appImage = "${DOCKER_USERNAME}/${APP_NAME}:latest"
          withCredentials([string(credentialsId: 'github-pat', variable: 'GITHUB_TOKEN')]) {
            docker.withRegistry(DOCKER_REGISTRY_HTTP) {
              def img = docker.image(appImage)
              img.push('latest')
              img.push("v${COMMIT_ID}")
            }
          }
        }
      }
        }

    stage('Deploy to Proxmox') {
            steps {
              sshagent([SSH_ID]) {
                script {
                  def remote = "${REMOTE_USER}@${REMOTE_HOST}"
                  def composeFile = "/opt/athanor/docker-compose.deploy.yml"

                  // 1. Ensure network and compose file exist
                  sh "ssh -o StrictHostKeyChecking=no ${remote} 'docker network create ${APP_NETWORK} || true'"

                  // 2. Stop and remove existing container to prevent naming conflicts
                  sh "ssh ${remote} 'docker stop ${APP_NAME} || true && docker rm ${APP_NAME} || true'"

                  // 3. Pull latest image and deploy via docker compose (idempotent)
                  sh """
                    ssh ${remote} 'DOCKER_REGISTRY=${DOCKER_REGISTRY} \
                      DOCKER_USERNAME=${DOCKER_USERNAME} \
                      IMAGE_TAG=v${COMMIT_ID} \
                      docker compose -f ${composeFile} pull ${APP_NAME} && \
                    DOCKER_REGISTRY=${DOCKER_REGISTRY} \
                      DOCKER_USERNAME=${DOCKER_USERNAME} \
                      IMAGE_TAG=v${COMMIT_ID} \
                      docker compose -f ${composeFile} up -d --no-deps --force-recreate ${APP_NAME}'
                  """

                  // 3. Health check
                  sh """
                    ssh ${remote} 'for i in 1 2 3 4 5 6; do \
                      docker inspect --format="{.State.Health.Status}" ${APP_NAME} 2>/dev/null | grep -q healthy && echo "Health check passed" && exit 0; \
                      echo "Waiting for ${APP_NAME} to become healthy... (attempt \$i/6)"; \
                      sleep 10; \
                      done; echo "WARNING: Health check timeout, container may still be starting"; exit 0'
                  """
                }
              }
            }
      }
    }

    post {
      always {
        script {
            cleanWs()
        }
      }
      failure {
        echo 'Pipeline failed!'
      }
    }
  }
}
