import { jsonSchema } from 'ai';
import responseSchema from '../../../../packages/contracts/schemas/planner-response.schema.json';
// AI SDK boundary only. No provider is configured and no request bodies are logged.
// Enabling hosted inference requires approved credentials, budget, consent and gateway abuse controls.
export const hostedPlannerSchema = jsonSchema(responseSchema);
export const hostedPlannerEnabled = false;
