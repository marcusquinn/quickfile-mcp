const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const root = resolve(__dirname, '..');
const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const lockfile = JSON.parse(readFileSync(resolve(root, 'package-lock.json'), 'utf8'));
const pinnedNode = readFileSync(resolve(root, '.nvmrc'), 'utf8').trim();
const versionMatch = /^(\d+)\.(\d+)\.(\d+)$/.exec(pinnedNode);

if (!versionMatch) {
  throw new Error(`.nvmrc must contain an exact Node version, received: ${pinnedNode}`);
}

const major = Number(versionMatch[1]);
const expectedEngine = `>=${major}.0.0 <${major + 1}.0.0`;
const expectedTypes = `^${major}.0.0`;
const rootLockfile = lockfile.packages?.[''];
const failures = [];

if (packageJson.engines?.node !== expectedEngine) {
  failures.push(`package.json engines.node must be ${expectedEngine}`);
}

if (packageJson.devDependencies?.['@types/node'] !== expectedTypes) {
  failures.push(`package.json @types/node must be ${expectedTypes}`);
}

if (packageJson.packageManager !== 'npm@11.17.0') {
  failures.push('package.json packageManager must be npm@11.17.0');
}

if (rootLockfile?.engines?.node !== packageJson.engines?.node) {
  failures.push('package-lock.json engines.node must match package.json');
}

if (rootLockfile?.devDependencies?.['@types/node'] !== packageJson.devDependencies?.['@types/node']) {
  failures.push('package-lock.json @types/node must match package.json');
}

if (process.versions.node !== pinnedNode) {
  failures.push(`Node ${pinnedNode} is required; found ${process.versions.node}`);
}

const npmVersion = execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim();
if (npmVersion !== '11.17.0') {
  failures.push(`npm 11.17.0 is required; found ${npmVersion}`);
}

if (failures.length > 0) {
  throw new Error(`Runtime policy drift detected:\n- ${failures.join('\n- ')}`);
}

console.log(`Runtime policy verified: Node ${pinnedNode}, npm ${npmVersion}`);
