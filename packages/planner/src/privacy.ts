import type {Artifact} from '@core/local-file-store';
import {hasPaymentCard} from './outbound/sensitive';
import {PRIVACY_POLICY} from './outbound/constants';
const escaped = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Token prefixes and field labels are scanned separately: adjacent unbounded
// whitespace alternatives allowed quadratic backtracking on hostile instructions.
const recognizedSecret = /sk-[a-z0-9_-]{12,}|\bAKIA[A-Z0-9]{16}\b|\b(?:ghp_|github_pat_)[a-z0-9_]{12,}|\beyJ[a-z0-9_-]+\.[a-z0-9_-]+\.[a-z0-9_-]+|\bmy\s+(?:password|passphrase|passcode|secret)\s+\S+|\bbearer\s+[a-z0-9._-]{12,}/i;
function secretField(text:string):boolean {
  for(const match of text.matchAll(/\b(?:api[_ -]?key|password|passphrase|passcode|secret|access[_ -]?token|refresh[_ -]?token|csrf[_ -]?token|pairing[_ -]?token)\b/gi)){
    let tail=text.slice(match.index+match[0].length).trimStart();
    if(tail.startsWith('"')||tail.startsWith("'"))tail=tail.slice(1).trimStart();
    if(tail.startsWith(':')||tail.startsWith('='))tail=tail.slice(1);
    else if(/^is\b/i.test(tail))tail=tail.slice(2);
    else continue;
    if(tail.trim().length)return true;
  }
  return false;
}
export const SENSITIVE_DRAFT_MARKER = '[Sensitive value removed]';
export const SECRET_CHAT_WARNING = 'Keep keys and passwords out of chat. Use a dedicated secure field when requested.';
export const hasRecognizedSecret = (text: string) => recognizedSecret.test(text)||secretField(text)||hasPaymentCard(text);
export const hasRejectedSecretDraft = (text: string) => text.includes(SENSITIVE_DRAFT_MARKER) || hasRecognizedSecret(text);
export const safeOrdinaryText = (text: string) => hasRejectedSecretDraft(text) ? 'Sensitive value removed from chat.' : text;
export function assertInstructionSafe(text: string, expanded=false) {
  if (!text.trim() || (expanded?text.replace(/\b(?:file|out)_[a-f0-9]{32}\b/g,'ref'):text).length > 1000) throw new Error('Keep your instruction under 1,000 characters.');
  if (hasRejectedSecretDraft(text)) throw new Error(SECRET_CHAT_WARNING);
  if (/(?::\/\/|(?:data|file|blob|content|asset|ph):|(?:[a-z]:[\\/])|(?:^|[\s"'([{=:])[~.]?\.?\/\S+|\\\\)/i.test(text)) throw new Error('Use the attached file references instead of URLs or paths.');
  if (/%[a-f0-9]{2}|\\(?:u[a-f0-9]{4}|x[a-f0-9]{2})|[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060-\u206f]/i.test(text)) throw new Error('Use a plain-text PDF instruction without encoded data or hidden characters.');
  if (/[a-z0-9+/]{80,}={0,2}|[a-f0-9]{64}/i.test(text)) throw new Error('That looks like encoded file data or a checksum. Use a short instruction instead.');
  if (/\.(?:pdf|png|jpe?g|docx?|xlsx?|csv|txt|json|zip|pptx?|odt|rtf|tiff?)\b/i.test(text)) throw new Error('Choose an attached file reference rather than typing an unknown filename.');
}
export function privateInstruction(raw: string, files: Artifact[]): string {
  if(raw.trim().length>1000)throw new Error('Keep your instruction under 1,000 characters.');
  let text = raw.normalize('NFC').trim();
  const names = new Map<string, Artifact[]>();
  for (const file of files) {
    const name = file.name.normalize('NFC').toLowerCase();
    const stem=name.replace(/\.[^.]+$/,'');
    // Ordinary grammar (page 1, first file, scanned pages) is not a title mention.
    // Quoted titles and full filename tokens remain available for these names.
    const grammatical=/^\d+$/.test(stem)||new Set(['page','pages','file','files','pdf','pdfs','document','documents','result','results','scan','scanned','original','originals','current','last','latest','first','second','third','merge','remove','compress','ocr']).has(stem);
    const aliases=[name,`"${stem}"`,`'${stem}'`,...(grammatical?[]:[stem])];
    for(const alias of new Set(aliases))if(alias)names.set(alias,[...(names.get(alias)??[]),file]);
  }
  for (const [name, matches] of [...names].sort((a, b) => b[0].length - a[0].length)) {
    const pattern=`(?<![\\p{L}\\p{N}_])${escaped(name)}(?![\\p{L}\\p{N}_])`;
    if (!new RegExp(pattern, 'iu').test(text)) continue;
    if (matches.length !== 1) throw new Error('More than one file has that name. Refer to its position or the current result.');
    text = text.replace(new RegExp(pattern, 'giu'), matches[0].ref);
  }
  for (const file of files) {
    if (file.checksum && text.toLowerCase().includes(file.checksum.toLowerCase())) throw new Error('Checksums stay on your device. Use the current result or file order instead.');
    // Detect copied snippets against known local text without sending that text anywhere.
    const words = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
    for (const page of file.inspection.pages) {
      const local = (page.text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).join(' ');
      if(local.length>=8&&words.join(' ').includes(local))throw new Error('This looks like text from your PDF. Describe the operation without quoting document content.');
      for (let i = 0; i <= words.length - PRIVACY_POLICY.overlapWords; i++) if (local.includes(words.slice(i, i + PRIVACY_POLICY.overlapWords).join(' '))) throw new Error('This looks like text from your PDF. Describe the operation without quoting document content.');
    }
  }
  assertInstructionSafe(text,true);
  return text;
}
