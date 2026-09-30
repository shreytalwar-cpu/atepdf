/** ADR 0012 / PRIV-1–7. One policy source, shared with the future consent UI. */
export const PRIVACY_POLICY = Object.freeze({
  version: 'adr0012/1', hostedDisclosureVersion: 'hosted/1', consentCopyVersion: 'consent/1',
  grantTtlMs: 300_000, standingPermissions: false,
  sizeBuckets: ['<1MB','1-10MB','10-50MB','>50MB'] as const,
  overlapWords: 5, longIdentifierDigits: 9,
  autoRetry: Object.freeze({hosted: 1, content: 0}),
  logRetentionDays: 7, analytics: false,
  approvedContentPurposes: Object.freeze([] as string[]),
});
export const CONTENT_CATEGORIES = ['pdf_bytes','page_raster','extracted_text','ocr_text','understanding_output','embedding_or_hash','document_metadata','exact_size_or_date','file_name','support_bundle'] as const;
export type ContentCategory = typeof CONTENT_CATEGORIES[number];
export function sizeBucket(bytes: number): typeof PRIVACY_POLICY.sizeBuckets[number] {
  if (!Number.isSafeInteger(bytes) || bytes < 0) throw new Error('unclassified_field');
  return bytes < 1_000_000 ? '<1MB' : bytes <= 10_000_000 ? '1-10MB' : bytes <= 50_000_000 ? '10-50MB' : '>50MB';
}
