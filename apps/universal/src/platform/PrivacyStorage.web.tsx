import React,{lazy,Suspense,type ComponentProps} from 'react';
import type {PrivacyStorage as StorageComponent} from '../components/PrivacyStorage';

// Storage enforcement remains in the workspace/controller from startup. Only
// the browser's optional settings presentation and Modal code load on opening.
const Storage=lazy(()=>import('../components/PrivacyStorage').then(module=>({default:module.PrivacyStorage})));
export function PrivacyStorage(props:ComponentProps<typeof StorageComponent>){
  return props.visible?<Suspense fallback={null}><Storage {...props}/></Suspense>:null;
}
