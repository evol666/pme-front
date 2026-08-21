import { scan } from "@sonar/scan";
import 'dotenv/config';

await scan(
  {
    serverUrl: process.env.SONAR_HOST_URL || 'http://localhost:9210',
    token: process.env.SONAR_TOKEN,
    options: {
      'sonar.projectKey': 'pme_front',
      'sonar.projectName': 'pme front',
      'sonar.projectVersion': '1.0.0',
      'sonar.sources': 'src',
      'sonar.tests': 'src',
      'sonar.test.inclusions': '**/*.test.js,**/*.test.jsx,**/*.test.ts,**/*.test.tsx',
      'sonar.javascript.lcov.reportPaths': 'coverage/lcov.info',
      // Sans cette ligne, SonarQube affiche 0 test pour ce module : lcov ne
      // porte que la couverture, pas le nombre de tests ni leur duree.
      'sonar.testExecutionReportPaths': 'coverage/test-report.xml',
      'sonar.sourceEncoding': 'UTF-8',
      'sonar.project.creation': 'true',
      'sonar.exclusions': 'src/components/ui/**/*,src/test/**/*',
    },
  },
);
