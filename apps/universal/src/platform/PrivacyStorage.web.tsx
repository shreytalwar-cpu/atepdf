import React,{useEffect,useState,type ComponentProps} from 'react';
import type {PrivacyStorage as StorageComponent} from '../components/PrivacyStorage';

// Storage enforcement remains in the workspace/controller from startup. Only
// the browser's optional settings presentation and Modal code load on opening.
export function PrivacyStorage(props:ComponentProps<typeof StorageComponent>){
  const [Storage,setStorage]=useState<typeof StorageComponent|null>(null),[failed,setFailed]=useState(false),[attempt,retry]=useState(0);
  useEffect(()=>{
    if(!props.visible||Storage)return;
    let current=true;setFailed(false);
    void import('../components/PrivacyStorage').then(module=>{if(current)setStorage(()=>module.PrivacyStorage);}).catch(()=>{if(current)setFailed(true);});
    return()=>{current=false;};
  },[props.visible,Storage,attempt]);
  if(!props.visible)return null;
  if(Storage)return <Storage {...props}/>;
  return failed?<div role="alert">Privacy &amp; storage could not open. Your workspace is unchanged. <button onClick={()=>retry(n=>n+1)}>Try again</button> <button onClick={props.onClose}>Close</button></div>:null;
}
