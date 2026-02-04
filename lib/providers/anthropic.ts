import { Sha256 } from "@aws-crypto/sha256-js";
import { HttpRequest } from "@aws-sdk/protocol-http";
import { SignatureV4 } from "@aws-sdk/signature-v4";
import { getParameter, PARAMETER_PATHS } from "@/lib/utils/parameter-store";

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

  // Parameter Storeから認証情報を取得（環境変数フォールバック付き）
  const accessKeyId = await getParameter(
    PARAMETER_PATHS.BEDROCK_ACCESS_KEY_ID,
    "BEDROCK_ACCESS_KEY_ID"
  );
  const secretAccessKey = await getParameter(
    PARAMETER_PATHS.BEDROCK_SECRET_ACCESS_KEY,
    "BEDROCK_SECRET_ACCESS_KEY"
  );
  const sessionToken = await getParameter(
    PARAMETER_PATHS.BEDROCK_SESSION_TOKEN,
    "BEDROCK_SESSION_TOKEN"
  );

  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      "BEDROCK_ACCESS_KEY_ID and BEDROCK_SECRET_ACCESS_KEY must be set in Parameter Store or env vars"
    );
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
