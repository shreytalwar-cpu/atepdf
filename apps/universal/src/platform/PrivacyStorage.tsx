// Native loads the Privacy & Storage pane directly.
import React,{type ComponentProps} from 'react';
import {PrivacyStorage as Pane} from '../components/PrivacyStorage';
export function PrivacyStorage({onClose:_,...props}:ComponentProps<typeof Pane>&{onClose:()=>void}){return <Pane {...props}/>;}
