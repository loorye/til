const OPENAI_URL = "https://api.openai.com/v1/responses";

export async function callOpenAI({
  apiKey,
  model,
  systemPrompt,
  userPrompt,
  schema
}: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  schema: Record<string, unknown>;
}): Promise<string> {
  const response = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      input: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userPrompt
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "thought_experiment_result",
          schema,
          strict: true
        }
      }
    })
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`OpenAI API error: ${message}`);
  }

  const data = (await response.json()) as {
    output_text?: string;
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  };

  if (data.output_text) {
    return data.output_text;
  }

  const text = data.output
    ?.flatMap((item) => item.content ?? [])
    .find((item) => item.type === "output_text")?.text;

  if (!text) {
    throw new Error("OpenAI response missing output_text.");
  }

  return text;
}
