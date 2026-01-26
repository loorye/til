import { NextResponse } from "next/server";

import { ScenarioSchema } from "@/lib/schema";
import { callAnthropic } from "@/lib/providers/anthropic";

const DEFAULT_SCENARIOS = [
  {
    scenarioText:
      "救助ドローンが2人の要救助者のどちらか一方だけを救える。Aは高齢者でBは若者。時間は限られている。",
    options: ["高齢者を優先する", "若者を優先する"]
  },
  {
    scenarioText:
      "災害時の物資配給をAIが決定する。Aは公平に全員へ少量配る、Bは生存率が高い地域に集中配給する。",
    options: ["公平に配る", "生存率重視で配る"]
  }
];

function buildSystemPrompt() {
  return [
    "あなたは二択の思考実験を日本語で生成する。",
    "出力は必ず指定JSONのみ。余計な文章は禁止。",
    "scenarioTextは1〜2文で簡潔に。",
    "optionsは短いフレーズの配列。",
    "A/Bのラベルは含めない。"
  ].join("\n");
}

function buildUserPrompt() {
  return [
    "二択の思考実験を1件生成してください。",
    "道徳・公平・リスク・ケアなどのテーマをバランスよく。",
    "出力JSONの形式:",
    JSON.stringify({
      scenarioText: "例: ...",
      options: ["例: ...", "例: ..."]
    })
  ].join("\n");
}

export async function POST() {
  const mockMode = process.env.MOCK_MODE === "true";

  if (mockMode) {
    const scenario =
      DEFAULT_SCENARIOS[Math.floor(Math.random() * DEFAULT_SCENARIOS.length)];
    return NextResponse.json(scenario);
  }

  const bedrockRegion = process.env.BEDROCK_REGION ?? "us-east-1";
  const bedrockModel =
    process.env.BEDROCK_MODEL_ID ?? "anthropic.claude-3-5-sonnet-20240620-v1:0";

  try {
    const responseText = await callAnthropic({
      model: bedrockModel,
      systemPrompt: buildSystemPrompt(),
      userPrompt: buildUserPrompt(),
      region: bedrockRegion
    });

    const parsed = JSON.parse(responseText) as unknown;
    const result = ScenarioSchema.safeParse(parsed);
    if (!result.success) {
      return NextResponse.json({ error: result.error.flatten() }, { status: 500 });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    const fallback =
      DEFAULT_SCENARIOS[Math.floor(Math.random() * DEFAULT_SCENARIOS.length)];
    return NextResponse.json(
      {
        ...fallback,
        error: (error as Error).message
      },
      { status: 200 }
    );
  }
}
