import React,{useEffect,useState,type ComponentProps} from 'react';
import {View} from 'react-native';
import type {PrivacyStorage as StorageComponent} from '../components/PrivacyStorage';
import {Button,Txt} from '../ui/primitives';

// Storage enforcement remains in the workspace/controller from startup. Only the
// browser's Privacy & Storage pane code loads, the first time the pane is shown.
export function PrivacyStorage(props:ComponentProps<typeof StorageComponent>&{onClose:()=>void}){
  const [Storage,setStorage]=useState<typeof StorageComponent|null>(null),[failed,setFailed]=useState(false),[attempt,retry]=useState(0);
  useEffect(()=>{
    if(!props.visible||Storage)return;
    let current=true;setFailed(false);
    void import('../components/PrivacyStorage').then(module=>{if(current)setStorage(()=>module.PrivacyStorage);}).catch(()=>{if(current)setFailed(true);});
    return()=>{current=false;};
  },[props.visible,Storage,attempt]);
  if(!props.visible)return null;
  if(Storage)return <Storage {...props}/>;
  return failed?<View accessibilityRole="alert" style={{gap:10}}>
    <Txt variant="ui">Privacy &amp; Storage could not open. Your workspace is unchanged.</Txt>
    <View style={{flexDirection:'row',gap:8}}><Button variant="secondary" label="Try Again" accessibilityLabel="Try again" onPress={()=>retry(n=>n+1)}/><Button variant="plain" label="Close" onPress={props.onClose}/></View>
  </View>:<Txt variant="ui" tone="secondary">Opening…</Txt>;
}
