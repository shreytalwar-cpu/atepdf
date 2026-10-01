import {useEffect,useRef} from 'react';
import {Platform,TextInput} from 'react-native';
import {useAui,useAuiEvent} from '@assistant-ui/react-native';
import {hasRecognizedSecret,SENSITIVE_DRAFT_MARKER} from '@planner/privacy';
import {typeStyle,useTextSize,useTheme,TEXT_SIZES} from '../ui/theme';

/** Public assistant-ui input slot for this app's new-message native composer.
 * UIKit owns the draft/caret. Mirroring delayed store snapshots back through a
 * controlled value corrupted fast input in the real iOS UI regression.
 * No edit/retry/voice prefill is enabled in atePDF's current native interface.
 */
// Start over removes the unsent draft, and an example or quick action can fill it. The
// input is uncontrolled, so it is told explicitly rather than mirroring composer state.
const inputs=new Set<{clear:()=>void;fill:(text:string)=>void;focus:()=>void}>();
export function resetComposerInput(){inputs.forEach(input=>input.clear());}
export function fillComposerInput(text:string){inputs.forEach(input=>input.fill(text));}
export function focusComposerInput(){inputs.forEach(input=>input.focus());}
function NativeComposerInput({placeholder}:{placeholder:string}){
  const aui=useAui(),input=useRef<TextInput>(null);
  const {c}=useTheme(),size=useTextSize();
  const initial=useRef(aui.composer.getState().text);
  useAuiEvent('composer.send',()=>{input.current?.clear();});
  useEffect(()=>{
    const handle={clear:()=>input.current?.clear(),fill:(text:string)=>{input.current?.setNativeProps({text});aui.composer.setText(text);input.current?.focus();},focus:()=>input.current?.focus()};
    inputs.add(handle);return()=>{inputs.delete(handle);};
  },[aui]);
  return <TextInput ref={input} defaultValue={initial.current}
    onChangeText={text=>{
      if(hasRecognizedSecret(text)){
        input.current?.setNativeProps({text:SENSITIVE_DRAFT_MARKER});
        aui.composer.setText(SENSITIVE_DRAFT_MARKER);
      }else aui.composer.setText(text);
    }}
    // On the Mac, Return sends (as in the web composer); the hardware keyboard gives UIKit
    // no Shift distinction here, so multi-line text arrives by paste. Touch keyboards keep Return.
    {...(Platform.OS==='ios'&&Platform.isMacCatalyst?{submitBehavior:'submit' as const,onSubmitEditing:()=>{if(aui.composer.getState().canSend)aui.composer.send();}}:{})}
    placeholder={placeholder} placeholderTextColor={c.inkTertiary} selectionColor={c.accent} keyboardAppearance="default"
    className="aui-composer-input"
    style={[typeStyle('body',TEXT_SIZES[size]),{color:c.ink,minHeight:44,maxHeight:200,paddingHorizontal:12,paddingTop:10,paddingBottom:6}]}
    multiline accessibilityLabel="Tell atePDF what to do"/>;
}

export const ComposerInput=NativeComposerInput;
