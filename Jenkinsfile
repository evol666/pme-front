// Jenkinsfile pme-front — migré vers la shared library athanor-shared-library.
// Voir Commun/jenkins-shared-library/README.md pour le détail des stages et les limites connues.

@Library('athanor-shared-library') _

athanorPipeline(
  qualityGate: false,
  type: 'node-frontend',
  appName: 'pme-front',
  network: 'app-network',
  githubPatCredentialId: 'github-pat',
  sonarDockerTarget: 'sonar',

  plainEnvVars: [
    DOCKER_REGISTRY: '$DOCKER_REGISTRY',
    DOCKER_USERNAME: '$DOCKER_USERNAME',
    IMAGE_TAG: 'v$COMMIT_ID'
  ],
  secretEnvVars: [ : ]
)
