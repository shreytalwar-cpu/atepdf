const {getDefaultConfig}=require('expo/metro-config');
const path=require('node:path');
const config=getDefaultConfig(__dirname);
config.watchFolders=[path.resolve(__dirname,'../..')];
config.resolver.assetExts.push('pdf');
module.exports=config;
