const {getDefaultConfig}=require('expo/metro-config');
const {withUniwindConfig}=require('uniwind/metro');
const path=require('node:path');
const config=getDefaultConfig(__dirname);
config.watchFolders=[path.resolve(__dirname,'../..'),require('node:fs').realpathSync(path.resolve(__dirname,'../../node_modules'))];
config.resolver.assetExts.push('pdf');
module.exports=withUniwindConfig(config,{cssEntryFile:'./global.css',dtsFile:'./uniwind-types.d.ts'});
