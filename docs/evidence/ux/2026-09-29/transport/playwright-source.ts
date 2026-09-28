import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'/Users/shrey/Documents/ChatGPT/atepdf/tests/e2e',
  timeout:180_000,expect:{timeout:20_000},workers:1,
  reporter:[['list'],['json',{outputFile:'/Users/shrey/Documents/ChatGPT/atepdf/docs/evidence/ux/2026-09-29/transport/workflow-results.json'}]],
  outputDir:'/private/tmp/atepdf-ux-tDVWpF/transport-test-results',
  use:{baseURL:'http://localhost:3213',headless:true,viewport:{width:1440,height:1086},screenshot:'only-on-failure',launchOptions:{channel:'chrome'}},
});
