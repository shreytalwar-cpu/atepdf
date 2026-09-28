/** Preserved source data, never runtime pricing, entitlement authority or spending approval. */
export const commercialPolicySources = Object.freeze({
  runtimeEnabled:false,
  approvalStatus:'owner_approval_required',
  retainedTasks:['M6-01','M6-02','M6-03','G11','G12','G13','G14','G15','G16','G17'],
  handoffSources:[
    'atepdf_codex_build_pack/growth/MONETIZATION_HYPOTHESIS.md',
    'atepdf_codex_build_pack/growth/PAYWALL_AND_BILLING.md',
    'atepdf_codex_build_pack/growth/MODEL_RECONCILIATION.md',
    'atepdf_codex_build_pack/growth/models/',
  ],
  defaults:{mandatorySignup:false,launchPaywall:false,trialEnabled:false,documentSync:false,paidPrivacy:false,livePurchases:false,customerMigration:false},
} as const);
