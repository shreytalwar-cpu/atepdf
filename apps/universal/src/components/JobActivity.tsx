import {useState} from 'react';
import {Animated,Pressable,Text,View} from 'react-native';
import {Check,ChevronDown,ChevronUp,Circle,FileCheck2,Layers,ScanText,Shrink,Sparkles,X} from 'lucide-react-native';
import type {JobState,JobStepStatus} from '@core/job-controller';
import type {Operation} from '@contracts/protocol';
import {Icon} from './ui/icon';
import {useAnnounce,usePulse,webLiveRegion} from './assistant-ui/elements/surfaces';

export type JobActivityProps={state:JobState;planning?:boolean;loading?:boolean};

const operationTitles:Record<Operation,string>={merge_pdf:'Merging PDFs',select_pages:'Removing pages',ocr_pdf:'Making text searchable',compress_pdf:'Compressing your PDF'};
const operationIcons={merge_pdf:Layers,select_pages:FileCheck2,ocr_pdf:ScanText,compress_pdf:Shrink};
const stepStatus:Record<JobStepStatus,string>={pending:'Waiting',active:'Working',validating:'Checking',complete:'Checked',cancelled:'Cancelled',failed:'Couldn’t finish'};

/** Display-only: all work and completion facts come from the local controller. */
export function JobActivity({state,planning=false,loading=false}:JobActivityProps){
  const [expanded,setExpanded]=useState(false);
  const active=state.busy||planning||loading;
  // The template pulse already honors reduced motion. Animate decoration only,
  // keeping the actual processing facts at full text contrast.
  const opacity=usePulse(active&&!(state.busy&&state.stage==='complete'));
  const progress=state.busy?state.progress:undefined;
  const current=progress?.currentStep==null?undefined:progress.steps[progress.currentStep];
  const multiple=(progress?.steps.length??0)>1;
  const count=multiple&&progress?.currentStep!=null?`${progress.kind==='import'?'PDF':'Step'} ${progress.currentStep+1} of ${progress.steps.length}`:undefined;
  const title=state.busy
    ?state.stage==='complete'?'Your PDF is ready':state.stage==='validating'?'Checking your result':progress?.kind==='import'?'Checking your PDFs':current?.operation?operationTitles[current.operation]:'Working on your device'
    :planning?'Planning your request':'Preparing local tools';
  const detail=state.busy?state.message:planning?'Preparing a plan before local processing.':'Getting ready to work on your device.';
  // Announce real phase/step transitions, not every page-level engine message.
  const announcement=active?`${title}${count?`. ${count}`:''}`:undefined;
  useAnnounce(announcement);
  if(!active)return null;
  const ActivityIcon=planning&&!state.busy?Sparkles:current?.operation?operationIcons[current.operation]:FileCheck2;

  return <View testID="progress-message" className="gap-2 py-1">
    <View className="flex-row items-start gap-3">
      <Animated.View testID="activity-pulse" style={{opacity}} className="mt-0.5 size-8 items-center justify-center rounded-full bg-muted" accessible={false} importantForAccessibility="no-hide-descendants">
        <Icon as={ActivityIcon} size={16} className="text-muted-foreground"/>
      </Animated.View>
      <View className="min-w-0 flex-1 gap-1">
        <Text className="text-[15px] font-medium leading-6 text-foreground" accessibilityLabel={announcement} aria-live={webLiveRegion}>{title}</Text>
        {!!detail&&<Text className="text-sm leading-5 text-muted-foreground">{detail}</Text>}
        <Text className="text-xs leading-5 text-muted-foreground">{count?`${count} · `:''}{state.busy?'On your device':planning?'Planning only · files stay on your device':'Local processing'}</Text>
      </View>
    </View>
    {multiple&&<View className="pl-11">
      <Pressable onPress={()=>setExpanded(value=>!value)} accessibilityRole="button" accessibilityLabel={expanded?'Hide local steps':'Show local steps'} accessibilityState={{expanded}} className="min-h-11 flex-row items-center gap-1.5 self-start rounded-lg pr-3">
        <Text className="text-xs font-medium text-muted-foreground">{expanded?'Hide steps':'Show steps'}</Text>
        <Icon as={expanded?ChevronUp:ChevronDown} size={14} className="text-muted-foreground"/>
      </Pressable>
      {expanded&&<View className="gap-3 border-l border-border pl-3 pb-2">
        {progress!.steps.map((step,index)=><View key={index} className="flex-row items-center gap-2" accessible accessibilityLabel={`${step.label}. ${stepStatus[step.status]}`}>
          <Icon as={step.status==='complete'?Check:step.status==='cancelled'||step.status==='failed'?X:Circle} size={13} className={step.status==='active'||step.status==='validating'?'text-primary':'text-muted-foreground'}/>
          <Text className="flex-1 text-sm leading-5 text-foreground">{step.label}</Text>
          <Text className="text-xs text-muted-foreground">{stepStatus[step.status]}</Text>
        </View>)}
      </View>}
    </View>}
  </View>;
}
