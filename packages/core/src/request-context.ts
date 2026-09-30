import {PLANNER_REFERENCE_LIMIT,type ManifestFile,type PendingClarification} from '@contracts/protocol';

export const CONTEXT_RESOURCE_REFUSAL = `This request needs more than ${PLANNER_REFERENCE_LIMIT} active file references. Choose fewer files or a specific earlier result. Your existing files and results are still available.`;
type CatalogFile=ManifestFile&{original:boolean};
type Catalog={revision:number;files:CatalogFile[];originals:string[];history:string[];focus:string|null};
export type ActiveRequestContext={revision:number;files:ManifestFile[];selected:string[];focus:string|null;originals:string[];instruction:string};
const ordinalWords=['first','second','third','fourth','fifth','sixth','seventh','eighth','ninth','tenth','eleventh','twelfth','thirteenth','fourteenth','fifteenth','sixteenth','seventeenth','eighteenth','nineteenth','twentieth'];
const ordinalWordsPattern=`(?:${ordinalWords.join('|')}|last)`;
const ordinal=`(?:\\d+(?:st|nd|rd|th)?|${ordinalWords.join('|')}|last)`;
const ordinalIndex=(value:string,length:number)=>value.toLowerCase()==='last'?length-1:ordinalWords.includes(value.toLowerCase())?ordinalWords.indexOf(value.toLowerCase()):parseInt(value,10)-1;

/** Durable catalog order owns identity. Projection order must never renumber it. */
export function activeRequestContext(catalog:Catalog,rawInstruction:string,pending?:PendingClarification):ActiveRequestContext{
  if(rawInstruction.replace(/\b(?:file|out)_[a-f0-9]{32}\b/g,'ref').length>1000)throw new Error('Keep your instruction under 1,000 characters.');
  if(pending&&(pending.workspaceRevision!==catalog.revision||pending.focusedResultRef!==catalog.focus))throw new Error('Clarification is stale. Please ask again.');
  const byRef=new Map(catalog.files.map(file=>[file.ref,file]));
  const results=catalog.files.filter(file=>!file.original).map(file=>file.ref);
  let instruction=rawInstruction;
  const explicit:string[]=[];
  const mention=(ref:string)=>{if(!byRef.has(ref))throw new Error('That file or result is no longer available. Please choose an existing artifact.');if(!explicit.includes(ref))explicit.push(ref);return ref;};
  const resolve=(kind:string,value:string)=>{
    const isResult=/result/i.test(kind);
    const candidates=pending?[...new Set([...pending.selectionRefs,...pending.originalRefs])].filter(ref=>isResult?!byRef.get(ref)?.original:byRef.get(ref)?.original):[];
    const refs=pending&&ordinalWords.includes(value.toLowerCase())?candidates:isResult?results:catalog.originals;
    const ref=refs[ordinalIndex(value,refs.length)];
    if(!ref)throw new Error('That file or result number is not available. Please choose an existing artifact.');
    return ref;
  };
  if(/\b(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred)[ -]+\w+[ -]+(?:files?|documents?|originals?|results?)\b|\b\w+[ -]+to[ -]+last[ -]+(?:files?|documents?|originals?|results?)\b/i.test(rawInstruction))throw new Error('Use a numeric file or result number for that reference.');
  const range=new RegExp(`\\b(?:files?|documents?|originals?|results?)\\s+${ordinal}\\s*(?:-|–|to|through)\\s*${ordinal}\\b|\\b${ordinal}\\s*(?:-|–|to|through)\\s*${ordinal}\\s+(?:files?|documents?|originals?|results?)\\b`,'i');
  if(range.test(rawInstruction))throw new Error('List each file or result number explicitly instead of a range.');
  // Lists are expanded before single ordinals, so "files 1 and 2" cannot drop 2.
  const list=new RegExp(`\\b(files?|documents?|originals?|results?)\\s+(?:numbers?\\s+)?(\\d+(?:st|nd|rd|th)?(?:\\s*(?:,\\s*(?:and\\s+)?|and|&)\\s*${ordinal})+)\\b`,'gi');
  instruction=instruction.replace(list,(_match,kind:string,values:string)=>values.split(/\s*(?:,\s*(?:and\s+)?|and|&)\s*/i).map(value=>resolve(kind,value)).join(' and '));
  const beforeList=new RegExp(`\\b(${ordinalWordsPattern}(?:\\s*(?:,\\s*(?:and\\s+)?|and|&)\\s*${ordinal})+)\\s+(files?|documents?|originals?|results?)\\b`,'gi');
  instruction=instruction.replace(beforeList,(_match,values:string,kind:string)=>values.split(/\s*(?:,\s*(?:and\s+)?|and|&)\s*/i).map(value=>resolve(kind,value)).join(' and '));
  const numbered=new RegExp(`\\b(files?|documents?|originals?|results?)\\s+(?:number\\s+|#)?(\\d+(?:st|nd|rd|th)?)\\b|\\b(${ordinalWordsPattern}|\\d+(?:st|nd|rd|th))\\s+(files?|documents?|originals?|results?)\\b`,'gi');
  instruction=instruction.replace(/\b(?:last|latest|current) result\b/gi,()=>{return 'current result';});
  instruction=instruction.replace(numbered,(_match,kind:string,value:string,before:string,after:string)=>resolve(kind??after,value??before));
  instruction=instruction.replace(/\b(?:previous|preceding) result\b/gi,()=>{
    const ref=catalog.history.at(-2);if(!ref)throw new Error('There is no preceding committed result.');return ref;
  });
  if(/\b(?:files?|documents?|originals?|results?)\s*(?:number\s*)?[#(\[+-]*\s*\d/i.test(instruction))throw new Error('Use a reference such as file 2 or result 1. Your files are unchanged.');
  instruction=instruction.replace(/\b(?:file|out)_[a-f0-9]{32}\b/g,mention);

  let selected:string[],originals:string[],focus=catalog.focus;
  if(pending){
    // Imports, Undo, restoration and commits invalidate the captured candidates.
    // Never rebuild the pending task against a new catalog or widen its selection.
    if(pending.workspaceRevision!==catalog.revision||pending.focusedResultRef!==catalog.focus)throw new Error('Clarification is stale. Please ask again.');
    selected=[...pending.selectionRefs];originals=[...pending.originalRefs];focus=pending.focusedResultRef;
    const candidates=new Set([...selected,...originals,...(focus?[focus]:[])]);
    if(explicit.some(ref=>!candidates.has(ref)))throw new Error('That reference was not a candidate for this clarification. Please restate the full request.');
  }else{
    const allOriginals=/\b(?:all|both|these|the)\s+(?:originals?|files|documents|pdfs)\b|\boriginals\b/i.test(rawInstruction);
    if(/\bresult\s+(?:one|two|three|four|five|six|seven|eight|nine|ten)\b/i.test(rawInstruction))throw new Error('Which result should I use? Please repeat your request with its result number.');
    const allResults=/\b(?:all|earlier|historical|old|prior|another)\s+results?\b/i.test(rawInstruction);
    const needsOriginals=!explicit.length&&(/\b(?:merge|combine|files?|documents?|originals?|pdfs?|these|both|them)\b/i.test(rawInstruction)||/\b(?:a|another|one|which) (?:file|document|pdf)\b/i.test(rawInstruction)||!focus||rawInstruction==='Local quick action');
    selected=allOriginals||needsOriginals?[...catalog.originals]:[...explicit];
    if(allResults)for(const ref of results)if(!selected.includes(ref))selected.push(ref);
    for(const ref of explicit)if(!selected.includes(ref))selected.push(ref);
    originals=selected.filter(ref=>byRef.get(ref)?.original);
  }
  const required=new Set([...selected,...originals,...explicit,...(focus?[focus]:[])]);
  if(required.size>PLANNER_REFERENCE_LIMIT){
    if(!explicit.length&&/\b(?:an? earlier|another|old|the old|prior|historical) result\b/i.test(rawInstruction)&&!/\ball results\b/i.test(rawInstruction))throw new Error('Which earlier result should I use? Please repeat your request with its result number.');
    throw new Error(CONTEXT_RESOURCE_REFUSAL);
  }
  for(const ref of required)if(!byRef.has(ref))throw new Error('That file or result is no longer available. Please choose an existing artifact.');
  // This is a view, not an eviction: bytes, metadata, history and Undo stay local.
  return {revision:catalog.revision,instruction,files:[...required].map(ref=>byRef.get(ref)!),selected,originals,focus};
}
