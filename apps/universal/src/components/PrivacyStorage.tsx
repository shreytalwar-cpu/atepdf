import React, {useEffect, useRef, useState} from 'react';
import {View, Text, Pressable, ScrollView, Modal, Platform} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import type {RetentionMode} from '@core/workspace-checkpoint';
import type {WorkspaceUsage} from '@core/workspace-vault';

// Privacy & storage (SHR-40): the approved retention options (ADR 0010), measured
// storage and Delete local data. Wording states what is removed and what is not;
// it never promises secure erasure or removal from other apps' backups.
export const RETENTION_OPTIONS:{mode:RetentionMode;label:string;detail:string}[]=[
  {mode:'keep',label:'Keep until I delete it',detail:'Your workspace is here when you reopen atePDF.'},
  {mode:'30d',label:'30 days',detail:'Deleted after 30 days without changes.'},
  {mode:'7d',label:'7 days',detail:'Deleted after 7 days without changes.'},
  {mode:'quit',label:'Delete when atePDF quits',detail:'Nothing is saved on this Mac. Closing the window doesn’t delete your work; quitting atePDF does.'},
];
export type RetentionImpact={kind:'quit'}|{kind:'expire';days:number;idleDays:number}|null;
export type StorageView={measuring:boolean;workspace:WorkspaceUsage|null;temporary:number|null};
type Confirmation={kind:'retention';mode:RetentionMode;impact:NonNullable<RetentionImpact>}|{kind:'delete'};

export const formatBytes=(n:number)=>n<1000?`${n} ${n===1?'byte':'bytes'}`:n<1_000_000?`${(n/1000).toFixed(1)} kB`:n<1_000_000_000?`${(n/1_000_000).toFixed(1)} MB`:`${(n/1_000_000_000).toFixed(2)} GB`;

// destructive: the confirming action (filled). caution: a control that only opens a confirmation.
type ActionProps={children:string;onPress:()=>void;disabled?:boolean;primary?:boolean;destructive?:boolean;caution?:boolean;focusOnMount?:boolean};
function Action({children,onPress,disabled=false,primary=false,destructive=false,caution=false,focusOnMount=false}:ActionProps){
  const ref=useRef<View>(null);
  // Move keyboard focus into a confirmation as it appears (web and keyboard access).
  useEffect(()=>{if(focusOnMount)(ref.current as unknown as {focus?:()=>void}|null)?.focus?.();},[focusOnMount]);
  const tone=primary?'atepdf-button-primary bg-primary':destructive?'bg-destructive':'border border-border bg-background';
  return <Pressable ref={ref} accessibilityRole="button" accessibilityLabel={children} disabled={disabled} aria-disabled={disabled} onPress={onPress} className={`atepdf-button min-h-11 items-center justify-center rounded-xl px-3 py-2 active:opacity-70 web:focus-visible:outline-2 web:focus-visible:outline-primary ${tone} ${disabled?'opacity-40':''}`}>
    <Text className={`text-sm font-medium ${primary||destructive?'text-primary-foreground':caution?'text-destructive':'text-foreground'}`}>{children}</Text>
  </Pressable>;
}
function Confirm({title,body,action,onConfirm,onCancel}:{title:string;body:string;action:string;onConfirm:()=>void;onCancel:()=>void}){
  return <View className="gap-3 rounded-2xl border border-border bg-muted p-4">
    <Text accessibilityRole="header" className="text-base font-semibold text-foreground">{title}</Text>
    <Text className="text-sm leading-5 text-muted-foreground">{body}</Text>
    {/* Mac order: Cancel, then the action that deletes. Focus starts on Cancel. */}
    <View className="flex-row flex-wrap gap-2"><Action focusOnMount onPress={onCancel}>Cancel</Action><Action destructive onPress={onConfirm}>{action}</Action></View>
  </View>;
}
function Row({label,value,strong=false}:{label:string;value:string;strong?:boolean}){
  return <View accessible accessibilityLabel={`${label}: ${value}`} className="flex-row items-baseline justify-between gap-3">
    <Text className={`flex-shrink text-sm ${strong?'font-semibold text-foreground':'text-muted-foreground'}`}>{label}</Text>
    <Text className={`text-sm ${strong?'font-semibold':''} text-foreground`}>{value}</Text>
  </View>;
}

type Props={
  visible:boolean;onClose:()=>void;motion:boolean;
  /** This build keeps a workspace on this Mac (the storage and retention sections apply). */
  capable:boolean;
  /** Privacy explanation, shared with the session-only dialog. */
  children:React.ReactNode;
  retention:RetentionMode|null;
  /** Why the setting can't be changed right now, when it can't. */
  retentionNote:string|null;
  /** Work is running: retention changes wait; deletion stops it first. */
  busy:boolean;
  /** A save to the user's own location is in progress: deletion waits for it. */
  exporting:boolean;
  /** The saved workspace has finished opening; deletion waits for that. */
  ready:boolean;
  storage:StorageView;
  impact:(mode:RetentionMode)=>RetentionImpact;
  onRetention:(mode:RetentionMode)=>void;
  onDelete:()=>void;
  deleting:boolean;
  status:string|null;
};
export function PrivacyStorage({visible,onClose,motion,capable,children,retention,retentionNote,busy,exporting,ready,storage,impact,onRetention,onDelete,deleting,status}:Props){
  const [confirm,setConfirm]=useState<Confirmation|null>(null);
  useEffect(()=>{if(!visible)setConfirm(null);},[visible]);
  const title=capable?'Privacy & storage':'Processed on your device';
  const locked=retention===null||busy||deleting;
  const choose=(mode:RetentionMode)=>{
    if(locked||mode===retention)return;
    const effect=impact(mode);
    if(effect)setConfirm({kind:'retention',mode,impact:effect});else onRetention(mode);
  };
  const usage=storage.workspace,unopened=usage?.unopened??0;
  const note=retentionNote??(busy?'You can change this when the current task finishes.':retention==='quit'?'This session isn’t saved on this Mac.':retention==='30d'||retention==='7d'?'atePDF checks when it opens, when you return to it and before new work. It can’t delete anything while it isn’t running.':null);
  const deleteBody=`This removes atePDF’s saved conversation, drafts, imported PDF copies, results, page text, previews and temporary files from this Mac, and sets Keep workspace back to Keep until I delete it.${busy?' The current task will be stopped first.':''}${unopened?' It includes the saved workspace atePDF couldn’t open.':''} Files you added from elsewhere and PDFs you saved aren’t touched. This isn’t secure erasure, and it doesn’t remove copies in backups made by other apps.`;
  return <Modal accessibilityLabel={Platform.OS==='web'?title:undefined} visible={visible} transparent animationType={motion?'fade':'none'} onRequestClose={()=>{if(confirm)setConfirm(null);else onClose();}}>
    <SafeAreaView style={{flex:1}} className="bg-black/25"><ScrollView contentContainerStyle={{flexGrow:1,justifyContent:'center',padding:20}}>
      <View accessibilityViewIsModal role={Platform.OS==='web'?undefined:'dialog'} className="w-full max-w-lg self-center gap-4 rounded-3xl bg-background p-6">
        <Text accessibilityRole="header" className="text-xl font-semibold text-foreground">{title}</Text>
        {children}
        {capable&&<>
          <View className="gap-2 border-t border-border pt-4">
            <Text accessibilityRole="header" nativeID="keep-workspace-label" className="text-base font-semibold text-foreground">Keep workspace</Text>
            <View accessibilityRole="radiogroup" aria-labelledby="keep-workspace-label" className="gap-1">
              {RETENTION_OPTIONS.map(option=>{
                const selected=option.mode===retention;
                // The web renderer only presses a radio with Enter; Space is the platform key for choosing one.
                const onKeyDown=Platform.OS==='web'?(event:{nativeEvent:{key?:string};preventDefault():void})=>{if(event.nativeEvent.key===' '){event.preventDefault();choose(option.mode);}}:undefined;
                return <Pressable key={option.mode} accessibilityRole="radio" accessibilityLabel={option.label} accessibilityHint={option.detail} accessibilityState={{checked:selected,disabled:locked}} aria-checked={selected} aria-disabled={locked} disabled={locked} onPress={()=>choose(option.mode)} {...(onKeyDown?{onKeyDown}:{})} className={`atepdf-button min-h-11 flex-row items-start gap-3 rounded-xl px-3 py-2 active:bg-muted web:focus-visible:outline-2 web:focus-visible:outline-primary ${locked&&!selected?'opacity-50':''}`}>
                  <View className={`mt-0.5 size-5 items-center justify-center rounded-full border-2 ${selected?'border-primary':'border-border'}`}>{selected&&<View className="size-2.5 rounded-full bg-primary"/>}</View>
                  <View className="min-w-0 flex-1"><Text className="text-sm font-medium text-foreground">{option.label}</Text><Text className="text-xs leading-5 text-muted-foreground">{option.detail}</Text></View>
                </Pressable>;
              })}
            </View>
            {!!note&&<Text className="text-xs leading-5 text-muted-foreground">{note}</Text>}
            {confirm?.kind==='retention'&&(confirm.impact.kind==='quit'
              ?<Confirm title="Stop saving this workspace?" body="atePDF will delete its saved copy of this workspace from this Mac now and won’t save new work. What’s open stays until you quit atePDF; closing the window doesn’t delete it. Files you added from elsewhere and PDFs you saved aren’t affected." action="Delete Saved Copy" onConfirm={()=>{setConfirm(null);onRetention(confirm.mode);}} onCancel={()=>setConfirm(null)}/>
              :<Confirm title="Delete this workspace now?" body={`It hasn’t changed for ${confirm.impact.idleDays} days, so the ${confirm.impact.days}-day setting deletes it now, including this conversation and its PDFs. Files you added from elsewhere and PDFs you saved aren’t affected.`} action="Delete Workspace" onConfirm={()=>{setConfirm(null);onRetention(confirm.mode);}} onCancel={()=>setConfirm(null)}/>)}
          </View>
          <View className="gap-2 border-t border-border pt-4">
            <Text accessibilityRole="header" className="text-base font-semibold text-foreground">Storage on this Mac</Text>
            {storage.measuring?<Text accessibilityLiveRegion="polite" className="text-sm text-muted-foreground">Measuring…</Text>:usage===null?<Text className="text-sm text-muted-foreground">atePDF couldn’t measure its saved workspace right now.</Text>:<View testID="storage-usage" className="gap-1.5">
              {unopened>0?<Row label="Saved workspace atePDF couldn’t open" value={formatBytes(unopened)}/>:<>
                <Row label="Imported PDF copies" value={formatBytes(usage.originals)}/>
                <Row label="Results" value={formatBytes(usage.results)}/>
                <Row label="Conversation, drafts and page text" value={formatBytes(usage.records)}/>
                {usage.pending>0&&<Row label="Waiting to be removed" value={formatBytes(usage.pending)}/>}
              </>}
              <Row label="Temporary files and previews" value={storage.temporary===null?'Couldn’t be measured':formatBytes(storage.temporary)}/>
              <Row strong label="Total" value={formatBytes(usage.total+(storage.temporary??0))}/>
            </View>}
            <Text className="text-xs leading-5 text-muted-foreground">Sizes of the files atePDF keeps in its own storage on this Mac. Files you added from elsewhere and PDFs you saved aren’t counted.</Text>
            {confirm?.kind==='delete'
              ?<Confirm title="Delete atePDF’s local data?" body={deleteBody} action="Delete" onConfirm={()=>{setConfirm(null);onDelete();}} onCancel={()=>setConfirm(null)}/>
              :<View className="items-start"><Action caution disabled={deleting||exporting||!ready} onPress={()=>setConfirm({kind:'delete'})}>{deleting?'Deleting…':'Delete Local Data…'}</Action></View>}
            {exporting&&!deleting&&<Text className="text-xs text-muted-foreground">Available after saving finishes.</Text>}
            {!!status&&<Text accessibilityLiveRegion="polite" testID="storage-status" className="text-sm leading-5 text-foreground">{status}</Text>}
          </View>
        </>}
        <Action primary onPress={onClose}>{capable?'Done':'Got it'}</Action>
      </View>
    </ScrollView></SafeAreaView>
  </Modal>;
}
