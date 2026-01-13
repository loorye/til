import crypto from "crypto";

function sha256(message: string) {
  return crypto.createHash("sha256").update(message, "utf8").digest("hex");
}

function hmac(key: Buffer, message: string) {
  return crypto.createHmac("sha256", key).update(message, "utf8").digest();
}

function getSignatureKey({
  secretAccessKey,
  dateStamp,
  regionName,
  serviceName
}: {
  secretAccessKey: string;
  dateStamp: string;
  regionName: string;
  serviceName: string;
}) {
  const kDate = hmac(Buffer.from(`AWS4${secretAccessKey}`, "utf8"), dateStamp);
  const kRegion = hmac(kDate, regionName);
  const kService = hmac(kRegion, serviceName);
  const kSigning = hmac(kService, "aws4_request");
  return kSigning;
}

function toAmzDate(date = new Date()) {
  const yyyy = date.getUTCFullYear().toString();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const min = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}T${hh}${min}${ss}Z`;
}

function toDateStamp(date = new Date()) {
  const yyyy = date.getUTCFullYear().toString();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

export async function callAnthropic({
  accessKeyId,
  secretAccessKey,
  model,
  systemPrompt,
  userPrompt,
  region,
  sessionToken
}: {
  accessKeyId: string;
  secretAccessKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  region: string;
  sessionToken?: string;
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

  const amzDate = toAmzDate();
  const dateStamp = toDateStamp();
  const payloadHash = sha256(body);
  const canonicalHeaders = [
    `host:${host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`
  ];
  const signedHeaders = ["host", "x-amz-content-sha256", "x-amz-date"];

  if (sessionToken) {
    canonicalHeaders.push(`x-amz-security-token:${sessionToken}`);
    signedHeaders.push("x-amz-security-token");
  }

  const canonicalRequest = [
    "POST",
    path,
    "",
    `${canonicalHeaders.join("\n")}\n`,
    signedHeaders.join(";"),
    payloadHash
  ].join("\n");

  const algorithm = "AWS4-HMAC-SHA256";
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    sha256(canonicalRequest)
  ].join("\n");

  const signingKey = getSignatureKey({
    secretAccessKey,
    dateStamp,
    regionName: region,
    serviceName: service
  });

  const signature = crypto
    .createHmac("sha256", signingKey)
    .update(stringToSign, "utf8")
    .digest("hex");

  const authorization = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders.join(
    ";"
  )}, Signature=${signature}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Host: host,
    "X-Amz-Date": amzDate,
    "X-Amz-Content-Sha256": payloadHash,
    Authorization: authorization
  };

  if (sessionToken) {
    headers["X-Amz-Security-Token"] = sessionToken;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body
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
