import {PRIVACY_POLICY} from './constants';
export type SensitiveSignal='payment_card_luhn'|'iban_checksum'|'long_identifier_run';
function luhn(s:string){let sum=0;for(let i=s.length-1,j=0;i>=0;i--,j++){let n=Number(s[i]);if(j%2){n*=2;if(n>9)n-=9;}sum+=n;}return sum%10===0;}
export function hasPaymentCard(text:string){return [...text.matchAll(/\b\d(?:[ -]?\d){12,18}\b/g)].some(match=>luhn(match[0].replace(/[ -]/g,'')));}
function iban(s:string){const value=s.slice(4)+s.slice(0,4);let rem=0;for(const c of value){const digits=/[A-Z]/.test(c)?String(c.charCodeAt(0)-55):c;for(const d of digits)rem=(rem*10+Number(d))%97;}return rem===1;}
export function sensitiveInstruction(text:string):SensitiveSignal|null {
  for(const match of text.toUpperCase().matchAll(/\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]){11,30}\b/g)){const s=match[0].replaceAll(' ','');if(s.length>=15&&s.length<=34&&iban(s))return 'iban_checksum';}
  for(const match of text.matchAll(/\b\d(?:[ -]?\d){8,18}\b/g)){
    const s=match[0].replace(/[ -]/g,'');
    if(s.length>=13&&s.length<=19&&luhn(s))return 'payment_card_luhn';
    const before=text.slice(Math.max(0,match.index!-25),match.index),after=text.slice(match.index!+match[0].length);
    if(s.length>=PRIVACY_POLICY.longIdentifierDigits&&!/\b(?:page|pages|range)\s*$/i.test(before)&&!/^\s*(?:bytes?|[KMGT]?B|megabytes?|gigabytes?)\b/i.test(after)&&!/^\d{4}-\d{2}-\d{2}$/.test(match[0]))return 'long_identifier_run';
  }
  return null;
}
