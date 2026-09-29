import {useEffect,useState,type ComponentProps,type ComponentType} from 'react';
import {ComposerPrimitive,useAui} from '@assistant-ui/react-native';
import {hasRecognizedSecret,SENSITIVE_DRAFT_MARKER} from '@planner/privacy';

// The public input primitive spreads TextInput props last. Intercept the draft
// before it enters assistant-ui's ordinary composer state, keeping its submit
// and keyboard behavior intact.
const Input=ComposerPrimitive.Input as ComponentType<ComponentProps<typeof ComposerPrimitive.Input>&{onChangeText:(text:string)=>void}>;
function WebComposerInput(){
  const aui=useAui(),[hydrated,setHydrated]=useState(false);
  useEffect(()=>setHydrated(true),[]);
  return <Input
    placeholder="Tell atepdf what to do…"
    placeholderTextColorClassName={hydrated?'accent-muted-foreground':undefined}
    className="aui-composer-input text-foreground web:resize-none web:outline-none max-h-40 min-h-12 px-3 py-2 text-base leading-6"
    multiline accessibilityLabel="Tell atepdf what to do"
    onChangeText={text=>aui.composer.setText(hasRecognizedSecret(text)?SENSITIVE_DRAFT_MARKER:text)}
  />;
}
export const nativeComposerComponents={ComposerInput:WebComposerInput};
// The web input is controlled by composer state, so clearing that state is enough.
export function resetComposerInput(){}
