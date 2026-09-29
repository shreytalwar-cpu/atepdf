import {useRef} from 'react';
import {TextInput} from 'react-native';
import {useAui,useAuiEvent} from '@assistant-ui/react-native';
import {hasRecognizedSecret,SENSITIVE_DRAFT_MARKER} from '@planner/privacy';

/** Public assistant-ui input slot for this app's new-message native composer.
 * UIKit owns the draft/caret. Mirroring delayed store snapshots back through a
 * controlled value corrupted fast input in the real iOS UI regression.
 * No edit/retry/voice prefill is enabled in atepdf's current native interface.
 */
function NativeComposerInput(){
  const aui=useAui(),input=useRef<TextInput>(null);
  const initial=useRef(aui.composer.getState().text);
  useAuiEvent('composer.send',()=>{input.current?.clear();});
  return <TextInput ref={input} defaultValue={initial.current}
    onChangeText={text=>{
      if(hasRecognizedSecret(text)){
        input.current?.setNativeProps({text:SENSITIVE_DRAFT_MARKER});
        aui.composer.setText(SENSITIVE_DRAFT_MARKER);
      }else aui.composer.setText(text);
    }}
      placeholder="Tell atepdf what to do…" placeholderTextColor="#5d6980"
      className="aui-composer-input text-foreground max-h-40 min-h-12 px-3 py-2 text-base leading-6"
    multiline accessibilityLabel="Tell atepdf what to do"/>;
}

export const nativeComposerComponents={ComposerInput:NativeComposerInput};
