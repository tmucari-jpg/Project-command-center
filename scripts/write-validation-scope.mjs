import { readFile, writeFile } from 'node:fs/promises';
const files = {};
for (const name of ['validation-tests.json', 'validation-backend.json', 'validation-browser.json']) {
  try { files[name] = JSON.parse(await readFile(name, 'utf8')); } catch { files[name] = null; }
}
const unit = files['validation-tests.json'];
const backend = files['validation-backend.json'];
const browser = files['validation-browser.json'];
const browserControlsPassed = Boolean(browser?.stats?.expected > 0 && browser.stats.unexpected === 0 && browser.stats.skipped === 0 && browser.stats.flaky === 0);
const automatedChecksPassed = Boolean(unit?.success && backend?.checks?.length && backend.checks.every(check => check.status === 'passed') && browserControlsPassed);
await writeFile('validation-run.json', JSON.stringify({
  repository: process.env.GITHUB_REPOSITORY,
  branch: process.env.GITHUB_REF_NAME,
  commit: process.env.GITHUB_SHA,
  runId: process.env.GITHUB_RUN_ID,
  attempt: Number(process.env.GITHUB_RUN_ATTEMPT || 1),
  scope: 'disposable-backend-and-integrated-application',
  automatedChecksPassed,
  browserControlsPassed,
  fullyValidated: false,
  pending: [
    'Gemini/provider live generation with an authorized key and explicit data-processing consent',
    'Real browser WebGPU inference',
    'Physical Android and iOS PWA installation',
    'Signed Android APK installation',
    'Complete backup restore including private Storage objects',
    'Business and fiscal acceptance by responsible reviewers',
  ],
  note: 'The workflow conclusion includes static, dependency, migration and build checks; this JSON does not replace that conclusion. No production deployment is performed.',
}, null, 2));
