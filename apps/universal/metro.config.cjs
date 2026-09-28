const {getDefaultConfig}=require('expo/metro-config');
const {withUniwindConfig}=require('uniwind/metro');
const path=require('node:path');
const config=getDefaultConfig(__dirname);
config.watchFolders=[path.resolve(__dirname,'../..')];
config.resolver.assetExts.push('pdf');
module.exports=withUniwindConfig(config,{cssEntryFile:'./global.css',dtsFile:'./uniwind-types.d.ts'});
