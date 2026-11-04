/** Optional provider evaluation only. This is not imported by the application. */
export type LongplayCustomerAccessClient = {
  checkEntitlement(input: {requirement: {internal_feature_id: string; quantity: string; properties: Record<string, never>}}): Promise<{
    requestId: string;
    check: {internal_feature_id: string; kind: string; allowed: boolean};
  }>;
};

/** A fresh observation, deliberately incompatible with VerifiedObservation/offline leases. */
export type OnlineLongplayAccess = Readonly<{
  source: 'longplay-online-access';
  allowed: boolean;
  requestRef: string;
}>;

/**
 * Accept an already identified Customer SDK client from the trusted account host.
 * No Customer selector, PDF, instruction, receipt or secret belongs in this call.
 * The SDK must validate scope/protocol. A successful check is not a workflow
 * reservation, purchase receipt, renewal status or permission to send documents.
 */
export async function probeLongplayAccess(
  customerClient: LongplayCustomerAccessClient,
  featureId: string,
): Promise<OnlineLongplayAccess> {
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(featureId)) {
    throw new Error('A configured access Feature is required.');
  }
  try {
    const result = await customerClient.checkEntitlement({requirement: {
      internal_feature_id: featureId, quantity: '1', properties: {},
    }});
    if (result.check.kind !== 'access' || result.check.internal_feature_id !== featureId ||
        typeof result.check.allowed !== 'boolean' ||
        !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(result.requestId)) {
      throw new Error('Unexpected billing response.');
    }
    return Object.freeze({source: 'longplay-online-access', allowed: result.check.allowed, requestRef: result.requestId});
  } catch {
    throw new Error('Could not verify online access.');
  }
}
