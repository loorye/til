import { NextResponse } from "next/server";

import { CASE_MAP } from "@/lib/cases";
import { PRINCIPLES, PRINCIPLE_MAP, type PrincipleId } from "@/lib/principles";
import {
  ApiResponseSchema,
  InputSchema,
  ModelResult,
  ModelResultSchema
} from "@/lib/schema";
import { callOpenAI } from "@/lib/providers/openai";
import { callAnthropic } from "@/lib/providers/anthropic";
import { callGemini } from "@/lib/providers/gemini";

const MODEL_RESULT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "decision",
    "confidence",
    "key_assumptions",
    "reasoning_summary",
    "what_changed_by_if"
  ],
  properties: {
    decision: {
      type: "string",
      enum: ["A", "B"]
    },
    confidence: {
      type: "integer",
      minimum: 51,
      maximum: 100
    },
    key_assumptions: {
      type: "array",
      items: {
        type: "string"
      },
      maxItems: 3
    },
    reasoning_summary: {
      type: "string"
    },
    what_changed_by_if: {
      type: "string"
    }
  }
};

const FALLBACK_RESULT: ModelResult = {
  decision: "A",
  confidence: 51,
  key_assumptions: [],
  reasoning_summary: "エラーが発生しました。",
  what_changed_by_if: "初回"
};

function buildSystemPrompt() {
  return [
    "あなたは思考実験に対して二択(A/B)を選び、確信度(51-100整数)を返す。",
    "確信度は正解率ではなく、その選択の妥当性に対する迷いの少なさ。",
    "出力は必ず指定JSONのみ。余計な文章は禁止。",
    "日本語で簡潔に。reasoning_summaryは1文、key_assumptionsは最大3つ。",
    "if条件が無い場合は what_changed_by_if を『初回』とする。"
  ].join("\n");
}

function buildUserPrompt({
  caseTitle,
  scenarioText,
  optionA,
  optionB,
  principleId,
  ifConditions,
  targetConfidence,
  retryNote
}: {
  caseTitle: string;
  scenarioText: string;
  optionA: string;
  optionB: string;
  principleId: string;
  ifConditions: string[];
  targetConfidence: number;
  retryNote?: string;
}) {
  const principleLines = PRINCIPLES.map(
    (item) => `- ${item.label}: ${item.description} (id: ${item.id})`
  ).join("\n");

  const selected = PRINCIPLE_MAP.get(principleId as PrincipleId);
  const ifArray = JSON.stringify(ifConditions ?? []);

  return [
    `ケース名: ${caseTitle}`,
    `シナリオ: ${scenarioText}`,
    `選択肢A: ${optionA}`,
    `選択肢B: ${optionB}`,
    "判断原理一覧:",
    principleLines,
    `選択した判断原理: ${selected?.label ?? principleId}`,
    `if条件(配列): ${ifArray}`,
    `目標確信度: ${targetConfidence}`,
    "出力JSONの形式は以下。余計な文は不要:",
    JSON.stringify({
      decision: "A",
      confidence: 80,
      key_assumptions: ["例"],
      reasoning_summary: "1文で要約。",
      what_changed_by_if: "初回"
    }),
    retryNote ?? ""
  ]
    .filter(Boolean)
    .join("\n");
}

function parseModelResult(text: string): ModelResult {
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  const candidate = jsonMatch ? jsonMatch[0] : trimmed;
  const parsed = JSON.parse(candidate);
  const result = ModelResultSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(result.error.message);
  }
  return result.data;
}

function clampConfidence(value: number) {
  return Math.min(100, Math.max(51, Math.round(value)));
}

function makeMockResult({
  model,
  caseId,
  principleId,
  ifConditions,
  targetConfidence
}: {
  model: "gpt" | "gemini" | "claude";
  caseId: string;
  principleId: string;
  ifConditions: string[];
  targetConfidence: number;
}): ModelResult {
  const baseDecisionMap: Record<string, { A: "A"; B: "B" }> = {
    trolley: { A: "A", B: "B" },
    theseus: { A: "A", B: "B" }
  };

  const decisionByPrinciple: Record<string, "A" | "B"> = {
    utilitarian: "A",
    deontology: "B",
    care: "A",
    risk: caseId === "trolley" ? "A" : "B",
    fairness: "A",
    self_determination: "B"
  };

  const baseDecision = decisionByPrinciple[principleId] ?? "A";
  const bias = model === "gemini" ? 3 : model === "claude" ? -2 : 0;
  const careBias = model === "claude" && principleId === "care" ? 3 : 0;
  const ifBoost = ifConditions.length * 2;
  const confidence = clampConfidence(targetConfidence + bias + careBias + ifBoost);

  return {
    decision: baseDecisionMap[caseId]?.[baseDecision] ?? "A",
    confidence,
    key_assumptions: ifConditions.length
      ? ifConditions.slice(0, 3)
      : ["前提条件は特になし"],
    reasoning_summary: `${principleId}の観点から${baseDecision}を選ぶ。`,
    what_changed_by_if:
      ifConditions.length === 0 ? "初回" : "if条件により前提を調整"
  };
}

async function runWithRetry({
  run,
  parser,
  retryNote
}: {
  run: (note?: string) => Promise<string>;
  parser: (text: string) => ModelResult;
  retryNote: string;
}) {
  try {
    const text = await run();
    return { result: parser(text), error: null };
  } catch (error) {
    const text = await run(retryNote);
    return { result: parser(text), error: error as Error };
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = InputSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const input = parsed.data;
  const selectedCase = CASE_MAP.get(input.caseId);

  if (!selectedCase) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  const systemPrompt = buildSystemPrompt();
  const retryNote = "JSON以外の出力は禁止です。指定JSONのみ返してください。";

  const userPrompt = buildUserPrompt({
    caseTitle: selectedCase.title,
    scenarioText: selectedCase.scenarioText,
    optionA: selectedCase.optionA,
    optionB: selectedCase.optionB,
    principleId: input.principleId,
    ifConditions: input.ifConditions,
    targetConfidence: input.targetConfidence
  });

  const mockMode = process.env.MOCK_MODE === "true";

  if (mockMode) {
    const responseBody = {
      inputEcho: input,
      results: {
        gpt: makeMockResult({
          model: "gpt",
          caseId: input.caseId,
          principleId: input.principleId,
          ifConditions: input.ifConditions,
          targetConfidence: input.targetConfidence
        }),
        gemini: makeMockResult({
          model: "gemini",
          caseId: input.caseId,
          principleId: input.principleId,
          ifConditions: input.ifConditions,
          targetConfidence: input.targetConfidence
        }),
        claude: makeMockResult({
          model: "claude",
          caseId: input.caseId,
          principleId: input.principleId,
          ifConditions: input.ifConditions,
          targetConfidence: input.targetConfidence
        })
      }
    };

    return NextResponse.json(responseBody);
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  const bedrockRegion = process.env.BEDROCK_REGION ?? "us-east-1";
  const geminiKey = process.env.GOOGLE_API_KEY;

  const openaiModel = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const bedrockModel =
    process.env.BEDROCK_MODEL_ID ?? "anthropic.claude-3-5-sonnet-20240620-v1:0";
  const geminiModel = process.env.GEMINI_MODEL ?? "gemini-1.5-flash";

  const errors: Record<string, string> = {};

  const [gptResult, geminiResult, claudeResult] = await Promise.all([
    openaiKey
      ? runWithRetry({
          run: (note) =>
            callOpenAI({
              apiKey: openaiKey,
              model: openaiModel,
              systemPrompt,
              userPrompt: buildUserPrompt({
                caseTitle: selectedCase.title,
                scenarioText: selectedCase.scenarioText,
                optionA: selectedCase.optionA,
                optionB: selectedCase.optionB,
                principleId: input.principleId,
                ifConditions: input.ifConditions,
                targetConfidence: input.targetConfidence,
                retryNote: note
              }),
              schema: MODEL_RESULT_JSON_SCHEMA
            }),
          parser: parseModelResult,
          retryNote
        })
      : Promise.resolve({
          result: {
            ...FALLBACK_RESULT,
            reasoning_summary: "OpenAI APIキーが設定されていません。"
          },
          error: new Error("Missing OpenAI API key")
        }),
    geminiKey
      ? runWithRetry({
          run: (note) =>
            callGemini({
              apiKey: geminiKey,
              model: geminiModel,
              systemPrompt,
              userPrompt: buildUserPrompt({
                caseTitle: selectedCase.title,
                scenarioText: selectedCase.scenarioText,
                optionA: selectedCase.optionA,
                optionB: selectedCase.optionB,
                principleId: input.principleId,
                ifConditions: input.ifConditions,
                targetConfidence: input.targetConfidence,
                retryNote: note
              })
            }),
          parser: parseModelResult,
          retryNote
        })
      : Promise.resolve({
          result: {
            ...FALLBACK_RESULT,
            reasoning_summary: "Gemini APIキーが設定されていません。"
          },
          error: new Error("Missing Gemini API key")
        }),
    bedrockRegion
      ? runWithRetry({
          run: (note) =>
            callAnthropic({
              model: bedrockModel,
              systemPrompt,
              userPrompt: buildUserPrompt({
                caseTitle: selectedCase.title,
                scenarioText: selectedCase.scenarioText,
                optionA: selectedCase.optionA,
                optionB: selectedCase.optionB,
                principleId: input.principleId,
                ifConditions: input.ifConditions,
                targetConfidence: input.targetConfidence,
                retryNote: note
              }),
              region: bedrockRegion
            }),
          parser: parseModelResult,
          retryNote
        })
      : Promise.resolve({
          result: {
            ...FALLBACK_RESULT,
            reasoning_summary: "Bedrockリージョンが設定されていません。"
          },
          error: new Error("Missing Bedrock region")
        })
  ]);

  if (gptResult.error) {
    errors.gpt = gptResult.error.message;
  }
  if (geminiResult.error) {
    errors.gemini = geminiResult.error.message;
  }
  if (claudeResult.error) {
    errors.claude = claudeResult.error.message;
  }

  const responseBody = {
    inputEcho: input,
    results: {
      gpt: gptResult.result,
      gemini: geminiResult.result,
      claude: claudeResult.result
    },
    errors: Object.keys(errors).length ? errors : undefined
  };

  const responseValidation = ApiResponseSchema.safeParse(responseBody);
  if (!responseValidation.success) {
    return NextResponse.json(
      { error: responseValidation.error.flatten() },
      { status: 500 }
    );
  }

  return NextResponse.json(responseBody);
}
