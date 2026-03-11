import { SSMClient, GetParametersCommand } from "@aws-sdk/client-ssm";

const SSM_PREFIX = "/til/";
const SECRET_KEYS = [
  "OPENAI_API_KEY",
  "GOOGLE_API_KEY",
  "AUTH_USERNAME",
  "AUTH_PASSWORD",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_SESSION_TOKEN",
];

let cache: Record<string, string> | null = null;

export async function getSecret(key: string): Promise<string> {
  if (process.env[key]) return process.env[key]!;

  if (!cache) {
    try {
      const client = new SSMClient({});
      const { Parameters } = await client.send(
        new GetParametersCommand({
          Names: SECRET_KEYS.map((k) => SSM_PREFIX + k),
          WithDecryption: true,
        })
      );
      cache = {};
      for (const p of Parameters ?? []) {
        const k = p.Name?.replace(SSM_PREFIX, "") ?? "";
        cache[k] = p.Value ?? "";
      }
    } catch {
      cache = {};
    }
  }
  return cache[key] ?? "";
}
