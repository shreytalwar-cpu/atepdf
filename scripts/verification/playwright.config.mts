import {resolve} from 'node:path';
import {defineConfig} from '@playwright/test';
const url=process.env.ATEPDF_VERIFICATION_URL;
if(!url||!/^http:\/\/127\.0\.0\.1:\d+$/.test(url))throw new Error('Run through scripts/verification/browser.mjs');
export default defineConfig({
  testDir:'../../tests/e2e',
  // Bounded deterministic slice; OCR/large-file/UX and compatibility matrix remain manual.
  projects:[
    {name:'mocked-planner',testMatch:'planner.spec.ts'},
    {name:'saved-output',testMatch:'workflow.spec.ts',grep:/real merge → preview\/save → remove/},
  ],
  timeout:90_000,expect:{timeout:20_000},workers:1,retries:0,
  reporter:[['list'],['json',{outputFile:resolve('.build/browser-results.json')}]],
  outputDir:resolve('.build/browser-results'),
  use:{baseURL:url,headless:true,viewport:{width:1440,height:1086},screenshot:'only-on-failure'},
  // Server already owned by this run, freshly built in its committed-source snapshot.
  // No webServer/reuseExistingServer, installed Chrome channel or owner connection.
});
