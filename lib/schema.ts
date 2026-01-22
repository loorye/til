import { z } from "zod";

export const InputSchema = z.object({
  caseId: z.enum(["trolley", "theseus"]),
  principleId: z.string(),
  ifConditions: z.array(z.string().min(1)).max(2),
  targetConfidence: z.number().int().min(51).max(100),
  scenarioText: z.string().min(1),
  optionA: z.string().min(1),
  optionB: z.string().min(1)
});

export const ModelResultSchema = z.object({
  decision: z.enum(["A", "B"]),
  confidence: z.number().int().min(51).max(100),
  key_assumptions: z.array(z.string()).max(3),
  reasoning_summary: z.string().min(1),
  what_changed_by_if: z.string().min(1)
});

export const ApiResponseSchema = z.object({
  inputEcho: InputSchema,
  results: z.object({
    gpt: ModelResultSchema,
    gemini: ModelResultSchema,
    claude: ModelResultSchema
  }),
  errors: z.record(z.string()).optional()
});

export type InputPayload = z.infer<typeof InputSchema>;
export type ModelResult = z.infer<typeof ModelResultSchema>;
export type ApiResponse = z.infer<typeof ApiResponseSchema>;
