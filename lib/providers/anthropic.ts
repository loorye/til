import { Sha256 } from "@aws-crypto/sha256-js";
import { HttpRequest } from "@aws-sdk/protocol-http";
import { SignatureV4 } from "@aws-sdk/signature-v4";

export async function callAnthropic({
  model,
  systemPrompt,
  userPrompt,
  region
}: {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  region: string;
}): Promise<string> {
  const service = "bedrock";
  const host = `bedrock-runtime.${region}.amazonaws.com`;
  const encodedModel = encodeURIComponent(model);
  const path = `/model/${encodedModel}/invoke`;
  const endpoint = `https://${host}${path}`;

  const body = JSON.stringify({
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 300,
    temperature: 0.1,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: userPrompt }]
      }
    ]
  });

  // カスタム環境変数から認証情報を取得
  const accessKeyId = process.env.BEDROCK_ACCESS_KEY_ID;
  const secretAccessKey = process.env.BEDROCK_SECRET_ACCESS_KEY;
  const sessionToken = process.env.BEDROCK_SESSION_TOKEN;

  if (!accessKeyId || !secretAccessKey) {
    throw new Error("BEDROCK_ACCESS_KEY_ID and BEDROCK_SECRET_ACCESS_KEY must be set");
  }

  const credentials = {
    accessKeyId,
    secretAccessKey,
    ...(sessionToken && { sessionToken })
  };

  const signer = new SignatureV4({
    credentials,
    region,
    service,
    sha256: Sha256
  });

  const unsignedRequest = new HttpRequest({
    method: "POST",
    protocol: "https:",
    hostname: host,
    path,
    headers: {
      "Content-Type": "application/json",
      Host: host
    },
    body
  });

  const signedRequest = await signer.sign(unsignedRequest);

  const response = await fetch(endpoint, {
    method: signedRequest.method,
    headers: signedRequest.headers as Record<string, string>,
    body: signedRequest.body
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Bedrock Claude error: ${message}`);
  }

  const data = (await response.json()) as {
    content?: Array<{ text?: string }>;
  };

  const text = data.content?.[0]?.text;
  if (!text) {
    throw new Error("Bedrock response missing text.");
  }

  return text;
}
