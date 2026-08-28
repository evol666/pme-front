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

  // Politique de scan explicitee dans chaque module (defauts lib : gitleaks/trivy bloquants,
  // hadolint non bloquant). Toute valeur a false doit rester temporaire et justifiee.
  gitleaksBlocking: true,
  trivyFsBlocking: true,
  hadolintBlocking: false,

  plainEnvVars: [
    DOCKER_REGISTRY: '$DOCKER_REGISTRY',
    DOCKER_USERNAME: '$DOCKER_USERNAME',
    IMAGE_TAG: 'v$COMMIT_ID'
  ],

  secretEnvVars: [:]
)
