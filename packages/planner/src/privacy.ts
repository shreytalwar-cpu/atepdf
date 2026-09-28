import type {Artifact} from '@core/local-file-store';
const escaped = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function assertInstructionSafe(text: string) {
  if (!text.trim() || text.length > 1000) throw new Error('Keep your instruction under 1,000 characters.');
  if (/sk-[a-z0-9_-]{12,}|\b(?:api[_ -]?key|password|passphrase|secret)\s*(?:[:=]|is\b)\s*\S+/i.test(text)) throw new Error('Keep keys and passwords out of chat. They stay in secure local controls.');
  if (/(?:[a-z][a-z0-9+.-]*:\/\/|data:|(?:[a-z]:[\\/])|(?:^|\s)[~.]?\.?\/\S+|\\\\)/i.test(text)) throw new Error('Use the attached file references instead of URLs or paths.');
  if (/[a-z0-9+/]{80,}={0,2}|[a-f0-9]{64}/i.test(text)) throw new Error('That looks like encoded file data or a checksum. Use a short instruction instead.');
  if (/\S+\.(?:pdf|png|jpe?g|docx?|xlsx?|csv|txt|json|zip|pptx?|odt|rtf|tiff?)\b/i.test(text)) throw new Error('Choose an attached file reference rather than typing an unknown filename.');
}
export function privateInstruction(raw: string, files: Artifact[]): string {
  let text = raw.normalize('NFC').trim();
  const names = new Map<string, Artifact[]>();
  for (const file of files) names.set(file.name.toLowerCase(), [...(names.get(file.name.toLowerCase()) ?? []), file]);
  for (const [name, matches] of [...names].sort((a, b) => b[0].length - a[0].length)) {
    if (!new RegExp(escaped(name), 'i').test(text)) continue;
    if (matches.length !== 1) throw new Error('More than one file has that name. Refer to its position or the current result.');
    text = text.replace(new RegExp(escaped(name), 'gi'), matches[0].ref);
  }
  for (const file of files) {
    if (text.includes(file.checksum)) throw new Error('Checksums stay on your device. Use the current result or file order instead.');
    // Detect copied snippets against known local text without sending that text anywhere.
    const words = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
    for (const page of file.inspection.pages) {
      const local = (page.text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).join(' ');
      if(local.length>=8&&words.join(' ').includes(local))throw new Error('This looks like text from your PDF. Describe the operation without quoting document content.');
      for (let i = 0; i <= words.length - 5; i++) if (local.includes(words.slice(i, i + 5).join(' '))) throw new Error('This looks like text from your PDF. Describe the operation without quoting document content.');
    }
  }
  assertInstructionSafe(text);
  return text;
}
