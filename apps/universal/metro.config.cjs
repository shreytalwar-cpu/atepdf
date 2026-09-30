const {getDefaultConfig}=require('expo/metro-config');
const {withUniwindConfig}=require('uniwind/metro');
const path=require('node:path');
const config=getDefaultConfig(__dirname);
config.watchFolders=[path.resolve(__dirname,'../..')];
config.resolver.assetExts.push('pdf');
// tslib 1.14's `import` entry default-imports its __esModule-marked CommonJS
// build, which has no default export. Metro then throws before React mounts.
// Assert only tslib's declared `module` condition to select its real ESM
// helpers on web and native; keep the locked dependency and all other resolution.
config.resolver.resolveRequest=(context,moduleName,platform)=>context.resolveRequest(
  moduleName==='tslib'?{...context,unstable_conditionNames:[...(context.unstable_conditionNames??[]),'module']}:context,
  moduleName,platform,
);
module.exports=withUniwindConfig(config,{cssEntryFile:'./global.css',dtsFile:'./uniwind-types.d.ts'});
