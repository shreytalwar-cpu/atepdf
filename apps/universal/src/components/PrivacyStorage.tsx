import React, {useEffect, useRef, useState} from 'react';
import {View, Pressable, Platform} from 'react-native';
import TriangleAlert from 'lucide-react-native/icons/triangle-alert';
import Trash from 'lucide-react-native/icons/trash';
import type {RetentionMode} from '@core/workspace-checkpoint';
import type {WorkspaceUsage} from '@core/workspace-vault';
import {Button, Glyph, Meter, Section, Separator, Txt} from '../ui/primitives';
import {radius, useTheme} from '../ui/theme';
import {PrivacySummary} from '../ui/shell';

// Settings ▸ Privacy & Storage (SHR-40 behaviour in the SHR-105 design): the approved retention
// options (ADR 0010), measured storage and Delete Local Data. Wording states what is removed
// and what is not; it never promises secure erasure or removal from other apps' backups.
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

/** E3 destructive confirmation, inline in the pane: Cancel first and focused; the action is explicit. */
function Confirm({title,body,action,onConfirm,onCancel}:{title:string;body:string;action:string;onConfirm:()=>void;onCancel:()=>void}){
  const {c}=useTheme();
  const cancel=useRef<View>(null);
  // Move keyboard focus into a confirmation as it appears (web and keyboard access).
  useEffect(()=>{(cancel.current as unknown as {focus?:()=>void}|null)?.focus?.();},[]);
  return <View style={{gap:10,padding:14,borderRadius:radius.lg,borderWidth:1,borderColor:c.hairline,backgroundColor:c.raised}}>
    <View style={{flexDirection:'row',gap:8,alignItems:'center'}}><Glyph icon={Trash} tone="danger"/><Txt variant="headline" accessibilityRole="header">{title}</Txt></View>
    <Txt variant="ui" tone="secondary">{body}</Txt>
    {/* Mac order: Cancel, then the action that deletes. Focus starts on Cancel. */}
    <View style={{flexDirection:'row',flexWrap:'wrap',justifyContent:'flex-end',gap:8}}>
      <Button ref={cancel} variant="secondary" label="Cancel" onPress={onCancel}/>
      <Button variant="destructive" label={action} onPress={onConfirm}/>
    </View>
  </View>;
}
function Row({label,value,strong=false}:{label:string;value:string;strong?:boolean}){
  return <View accessible accessibilityLabel={`${label}: ${value}`} style={{flexDirection:'row',alignItems:'baseline',justifyContent:'space-between',gap:12,paddingVertical:6,paddingHorizontal:14}}>
    <Txt variant={strong?'uiStrong':'ui'} tone={strong?'primary':'secondary'} style={{flexShrink:1}}>{label}</Txt>
    <Txt variant={strong?'uiStrong':'ui'} tabular>{value}</Txt>
  </View>;
}
type Props={
  visible:boolean;
  /** This build keeps a workspace on this Mac (the storage and retention sections apply). */
  capable:boolean;
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
  /** Start over: clears this workspace (a separate confirmation sheet); the setting stays. */
  onStartOver?:()=>void;
  canStartOver?:boolean;
};
export function PrivacyStorage({visible,capable,retention,retentionNote,busy,exporting,ready,storage,impact,onRetention,onDelete,deleting,status,onStartOver,canStartOver=false}:Props){
  const {c}=useTheme();
  const [confirm,setConfirm]=useState<Confirmation|null>(null);
  useEffect(()=>{if(!visible)setConfirm(null);},[visible]);
  const locked=retention===null||busy||deleting;
  const choose=(mode:RetentionMode)=>{
    if(locked||mode===retention)return;
    const effect=impact(mode);
    if(effect)setConfirm({kind:'retention',mode,impact:effect});else onRetention(mode);
  };
  const usage=storage.workspace,unopened=usage?.unopened??0;
  const note=retentionNote??(busy?'You can change this when the current task finishes.':retention==='quit'?'This session isn’t saved on this Mac.':retention==='30d'||retention==='7d'?'atePDF checks when it opens, when you return to it and before new work. It can’t delete anything while it isn’t running.':null);
  const deleteBody=`This removes atePDF’s saved conversation, drafts, imported PDF copies, results, page text, previews and temporary files from this Mac, and sets Keep workspace back to Keep until I delete it (Start Over keeps your setting).${busy?' The current task will be stopped first.':''}${unopened?' It includes the saved workspace atePDF couldn’t open.':''} Files you added from elsewhere and PDFs you saved aren’t touched. This isn’t secure erasure, and it doesn’t remove copies in backups made by other apps.`;
  if(!visible)return null;
  return <View style={{gap:20}}>
    <Section title="How atePDF handles your files"><PrivacySummary heading={false}/></Section>
    {capable&&<>
      <View style={{gap:8}}>
        <Section title="Keep workspace" labelId="keep-workspace-label">
          <View accessibilityRole="radiogroup" aria-labelledby="keep-workspace-label">
            {RETENTION_OPTIONS.map((option,index)=>{
              const selected=option.mode===retention;
              // The web renderer only presses a radio with Enter; Space is the platform key for choosing one.
              const onKeyDown=Platform.OS==='web'?(event:{nativeEvent:{key?:string};preventDefault():void})=>{if(event.nativeEvent.key===' '){event.preventDefault();choose(option.mode);}}:undefined;
              return <View key={option.mode}>
                {index>0&&<Separator inset={14}/>}
                <Pressable accessibilityRole="radio" accessibilityLabel={option.label} accessibilityHint={option.detail} accessibilityState={{checked:selected,disabled:locked}} aria-checked={selected} aria-disabled={locked} disabled={locked} onPress={()=>choose(option.mode)} {...(onKeyDown?{onKeyDown}:{})}
                  style={({pressed})=>({flexDirection:'row',alignItems:'flex-start',gap:10,paddingVertical:8,paddingHorizontal:14,minHeight:40,backgroundColor:pressed?c.pressed:'transparent',opacity:locked&&!selected?0.55:1})}>
                  <View style={{marginTop:2,width:16,height:16,borderRadius:8,borderWidth:selected?5:1,borderColor:selected?c.accent:c.strong,backgroundColor:c.raised}}/>
                  <View style={{flex:1,minWidth:0}}><Txt variant="ui">{option.label}</Txt><Txt variant="meta" tone="secondary">{option.detail}</Txt></View>
                </Pressable>
              </View>;
            })}
          </View>
        </Section>
        {!!note&&<Txt variant="meta" tone="secondary">{note}</Txt>}
        {confirm?.kind==='retention'&&(confirm.impact.kind==='quit'
          ?<Confirm title="Stop saving this workspace?" body="atePDF will delete its saved copy of this workspace from this Mac now and won’t save new work. What’s open stays until you quit atePDF; closing the window doesn’t delete it. Files you added from elsewhere and PDFs you saved aren’t affected." action="Delete Saved Copy" onConfirm={()=>{setConfirm(null);onRetention(confirm.mode);}} onCancel={()=>setConfirm(null)}/>
          :<Confirm title="Delete this workspace now?" body={`It hasn’t changed for ${confirm.impact.idleDays} days, so the ${confirm.impact.days}-day setting deletes it now, including this conversation and its PDFs. Files you added from elsewhere and PDFs you saved aren’t affected.`} action="Delete Workspace" onConfirm={()=>{setConfirm(null);onRetention(confirm.mode);}} onCancel={()=>setConfirm(null)}/>)}
      </View>
      <View style={{gap:8}}>
        <Section title="Storage on this Mac">
          {storage.measuring?<Txt variant="ui" tone="secondary" accessibilityLiveRegion="polite" style={{paddingVertical:6,paddingHorizontal:14}}>Measuring…</Txt>:usage===null?<Txt variant="ui" tone="secondary" style={{paddingVertical:6,paddingHorizontal:14}}>atePDF couldn’t measure its saved workspace right now.</Txt>:<View testID="storage-usage">
            {!unopened&&<View style={{paddingHorizontal:14,paddingTop:8,paddingBottom:4}}><Meter label="Storage by category" segments={[{value:usage.originals,color:c.accent},{value:usage.results,color:c.local},{value:usage.records,color:c.inkTertiary},{value:usage.pending+(storage.temporary??0),color:c.strong}]}/></View>}
            {unopened>0?<Row label="Saved workspace atePDF couldn’t open" value={formatBytes(unopened)}/>:<>
              <Row label="Imported PDF copies" value={formatBytes(usage.originals)}/>
              <Row label="Results" value={formatBytes(usage.results)}/>
              <Row label="Conversation, drafts and page text" value={formatBytes(usage.records)}/>
              {usage.pending>0&&<Row label="Waiting to be removed" value={formatBytes(usage.pending)}/>}
            </>}
            <Row label="Temporary files and previews" value={storage.temporary===null?'Couldn’t be measured':formatBytes(storage.temporary)}/>
            <Separator inset={14}/>
            {/* Never an exact-looking total when part of it could not be measured. */}
            <Row strong label="Total" value={storage.temporary===null?`At least ${formatBytes(usage.total)}`:formatBytes(usage.total+storage.temporary)}/>
          </View>}
        </Section>
        <Txt variant="meta" tone="secondary">Sizes of the files atePDF keeps in its own storage on this Mac. Files you added from elsewhere and PDFs you saved aren’t counted.</Txt>
      </View>
      <View style={{gap:8}}>
        <Section title="Remove atePDF’s data" destructive>
          {onStartOver&&<><View style={{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:6,paddingHorizontal:14}}>
            <View style={{flex:1}}><Txt variant="ui">Start over</Txt><Txt variant="meta" tone="secondary">Clears this conversation and its copies. Keeps your Keep workspace setting.</Txt></View>
            <Button variant="secondary" label="Start Over…" disabled={!canStartOver} onPress={onStartOver}/>
          </View><Separator inset={14}/></>}
          <View style={{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:6,paddingHorizontal:14}}>
            <View style={{flex:1}}><Txt variant="ui">Delete local data</Txt><Txt variant="meta" tone="secondary">Everything atePDF keeps on this Mac, and resets Keep workspace.</Txt></View>
            {confirm?.kind!=='delete'&&<Button variant="destructivePlain" label={deleting?'Deleting…':'Delete Local Data…'} disabled={deleting||exporting||!ready} onPress={()=>setConfirm({kind:'delete'})}/>}
          </View>
        </Section>
        {confirm?.kind==='delete'&&<Confirm title="Delete atePDF’s local data?" body={deleteBody} action="Delete" onConfirm={()=>{setConfirm(null);onDelete();}} onCancel={()=>setConfirm(null)}/>}
        {exporting&&!deleting&&<Txt variant="meta" tone="secondary">Available after saving finishes.</Txt>}
        {!!status&&<View style={{flexDirection:'row',gap:8,alignItems:'flex-start'}}>{/incomplete|couldn’t/i.test(status)&&<Glyph icon={TriangleAlert} tone="warning"/>}<Txt variant="ui" testID="storage-status" accessibilityLiveRegion="polite" style={{flex:1}}>{status}</Txt></View>}
        <Txt variant="meta" tone="secondary">Deleting removes atePDF’s copies. It doesn’t erase backups or files you saved elsewhere.</Txt>
      </View>
    </>}
    {!capable&&<Txt variant="ui" tone="secondary">Chat and files stay in this session only. Save before closing.</Txt>}
  </View>;
}
