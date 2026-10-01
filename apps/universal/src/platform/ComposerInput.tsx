import {useEffect,useState,type ComponentProps,type ComponentType} from 'react';
import {ComposerPrimitive,useAui} from '@assistant-ui/react-native';
import {hasRecognizedSecret,SENSITIVE_DRAFT_MARKER} from '@planner/privacy';
import {typeStyle,useTextSize,useTheme,TEXT_SIZES} from '../ui/theme';

// The public input primitive spreads TextInput props last. Intercept the draft
// before it enters assistant-ui's ordinary composer state, keeping its submit
// and keyboard behavior intact (Return sends, Shift+Return adds a line).
const Input=ComposerPrimitive.Input as ComponentType<ComponentProps<typeof ComposerPrimitive.Input>&{onChangeText:(text:string)=>void}>;
const composers=new Set<ReturnType<typeof useAui>>();
function WebComposerInput({placeholder}:{placeholder:string}){
  const aui=useAui(),[hydrated,setHydrated]=useState(false);
  const {c}=useTheme(),size=useTextSize();
  useEffect(()=>setHydrated(true),[]);
  useEffect(()=>{composers.add(aui);return()=>{composers.delete(aui);};},[aui]);
  return <Input
    placeholder={placeholder}
    placeholderTextColor={hydrated?c.inkTertiary:undefined}
    className="aui-composer-input web:resize-none web:outline-none"
    style={[typeStyle('body',TEXT_SIZES[size]),{color:c.ink,minHeight:44,maxHeight:200,paddingHorizontal:12,paddingTop:10,paddingBottom:6}]}
    multiline accessibilityLabel="Tell atePDF what to do"
    onChangeText={text=>aui.composer.setText(hasRecognizedSecret(text)?SENSITIVE_DRAFT_MARKER:text)}
  />;
}
export const ComposerInput=WebComposerInput;
const field=()=>document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Tell atePDF what to do"]');
// The web input is controlled by composer state, so clearing or filling that state is enough.
export function resetComposerInput(){}
export function fillComposerInput(text:string){composers.forEach(aui=>aui.composer.setText(text));requestAnimationFrame(()=>{const input=field();input?.focus();input?.setSelectionRange(text.length,text.length);});}
export function focusComposerInput(){field()?.focus();}
