const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

export async function callAnthropic({
  apiKey,
  model,
  systemPrompt,
  userPrompt
}: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
}): Promise<string> {
  const response = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model,
      max_tokens: 300,
      temperature: 0.1,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }]
    })
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Anthropic API error: ${message}`);
  }

  const data = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };

  const text = data.content?.find((item) => item.type === "text")?.text;
  if (!text) {
    throw new Error("Anthropic response missing text.");
  }

  return text;
}
