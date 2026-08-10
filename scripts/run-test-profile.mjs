import { createVitest } from 'vitest/node';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildTestProfileEnvironment,
  formatTestProfileIdentity,
  resolveTestProfile,
} from './test-profile-contract.mjs';

const requestedProfile = process.argv[2];
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const profile = resolveTestProfile(requestedProfile);
const forwarded = process.argv.slice(3).filter((arg, index) => !(index === 0 && arg === '--'));

const cliOptions = {
  run: true,
  watch: false,
  // The suite contains several intentional 50x CPU/module-reset stress tests.
  // An unbounded core-count default oversubscribed them and turned the 5 s
  // assertion timeout into a host-load lottery. Four workers retain real file
  // concurrency while making the release profile reproducible across hosts.
  maxWorkers: profile.maxWorkers,
};
const filters = profile.files ? [...profile.files] : [];
for (let index = 0; index < forwarded.length; index += 1) {
  const arg = forwarded[index];
  const [flag, inlineValue] = arg.startsWith('--') ? arg.split('=', 2) : ['', ''];
  const takeValue = () => inlineValue || forwarded[++index];
  if (!flag) {
    if (profile.files) {
      throw new Error('The Internal Summary V2 profile accepts only its explicit allowlist.');
    }
    filters.push(arg);
  } else if (flag === '--maxWorkers') {
    cliOptions.maxWorkers = Number(takeValue());
  } else if (flag === '--minWorkers') {
    cliOptions.minWorkers = Number(takeValue());
  } else if (flag === '--reporter') {
    cliOptions.reporters = [takeValue()];
  } else if (flag === '--outputFile') {
    cliOptions.outputFile = takeValue();
  } else if (flag === '--testTimeout') {
    cliOptions.testTimeout = Number(takeValue());
  } else if (flag === '--pool') {
    cliOptions.pool = takeValue();
  } else if (flag === '--no-file-parallelism') {
    cliOptions.fileParallelism = false;
  } else if (flag === '--passWithNoTests') {
    cliOptions.passWithNoTests = true;
  } else {
    throw new Error(`Unsupported profile-runner option: ${arg}`);
  }
}

console.log(formatTestProfileIdentity(profile.id));

const environment = buildTestProfileEnvironment(profile.id, process.env);
process.env.CVPRO_TEST_PROFILE = environment.CVPRO_TEST_PROFILE;
process.env.NEXT_PUBLIC_ENABLE_SUMMARY_V2 = environment.NEXT_PUBLIC_ENABLE_SUMMARY_V2;

const vitest = await createVitest('test', {
  ...cliOptions,
  root: projectRoot,
  config: false,
  // Keep this aligned with vitest.config.ts. Testing Library reads the global
  // afterEach hook at import time to register automatic DOM cleanup.
  globals: true,
  include: filters.length ? filters : ['src/**/*.test.ts', 'src/**/*.test.tsx'],
}, {
  resolve: {
    alias: {
      '@': path.resolve(projectRoot, 'src'),
    },
  },
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
});
await vitest.start();
await vitest.close();
if (vitest.state.getCountOfFailedTests() > 0 || vitest.state.getUnhandledErrors().length > 0) {
  process.exitCode = 1;
}
