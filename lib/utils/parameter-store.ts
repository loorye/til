import {
  SSMClient,
  GetParametersCommand,
  GetParametersCommandInput
} from "@aws-sdk/client-ssm";

interface ParameterCache {
  value: string;
  timestamp: number;
}

// メモリキャッシュ（TTL: 5分）
const cache = new Map<string, ParameterCache>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5分

// SSMクライアントのシングルトン
let ssmClient: SSMClient | null = null;

function getSSMClient(): SSMClient {
  if (!ssmClient) {
    const region = process.env.AWS_REGION || process.env.BEDROCK_REGION || "us-east-1";
    ssmClient = new SSMClient({ region });
  }
  return ssmClient;
}

/**
 * Parameter Storeから値を取得（キャッシング機能付き）
 *
 * @param parameterName - Parameter Storeのパラメータ名（例: "/ai-workshop/openai-api-key"）
 * @param fallbackEnvKey - フォールバック用の環境変数名（オプション）
 * @returns パラメータの値
 */
export async function getParameter(
  parameterName: string,
  fallbackEnvKey?: string
): Promise<string | undefined> {
  // 1. 環境変数からのフォールバック（ローカル開発用）
  if (fallbackEnvKey && process.env[fallbackEnvKey]) {
    console.log(`[parameter-store] Using env var: ${fallbackEnvKey}`);
    return process.env[fallbackEnvKey];
  }

  // 2. キャッシュチェック
  const cached = cache.get(parameterName);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    console.log(`[parameter-store] Cache hit: ${parameterName}`);
    return cached.value;
  }

  // 3. Parameter Storeから取得
  try {
    const client = getSSMClient();
    const input: GetParametersCommandInput = {
      Names: [parameterName],
      WithDecryption: true // SecureStringの場合は復号化
    };

    const command = new GetParametersCommand(input);
    const response = await client.send(command);

    const parameter = response.Parameters?.[0];
    if (!parameter?.Value) {
      console.warn(`[parameter-store] Parameter not found: ${parameterName}`);
      return undefined;
    }

    // キャッシュに保存
    cache.set(parameterName, {
      value: parameter.Value,
      timestamp: Date.now()
    });

    console.log(`[parameter-store] Retrieved: ${parameterName}`);
    return parameter.Value;
  } catch (error) {
    console.error(`[parameter-store] Error fetching ${parameterName}:`, error);
    return undefined;
  }
}

/**
 * 複数のパラメータを一括取得（効率的）
 *
 * @param parameterNames - Parameter Storeのパラメータ名の配列
 * @returns パラメータ名をキーとした値のマップ
 */
export async function getParameters(
  parameterNames: string[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const uncachedNames: string[] = [];

  // キャッシュをチェック
  for (const name of parameterNames) {
    const cached = cache.get(name);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      result.set(name, cached.value);
    } else {
      uncachedNames.push(name);
    }
  }

  if (uncachedNames.length === 0) {
    console.log("[parameter-store] All parameters from cache");
    return result;
  }

  // Parameter Storeから一括取得（最大10個まで）
  try {
    const client = getSSMClient();

    // 10個ずつのバッチに分割
    for (let i = 0; i < uncachedNames.length; i += 10) {
      const batch = uncachedNames.slice(i, i + 10);
      const input: GetParametersCommandInput = {
        Names: batch,
        WithDecryption: true
      };

      const command = new GetParametersCommand(input);
      const response = await client.send(command);

      for (const param of response.Parameters || []) {
        if (param.Name && param.Value) {
          result.set(param.Name, param.Value);
          cache.set(param.Name, {
            value: param.Value,
            timestamp: Date.now()
          });
        }
      }
    }

    console.log(`[parameter-store] Retrieved ${result.size} parameters`);
  } catch (error) {
    console.error("[parameter-store] Error fetching parameters:", error);
  }

  return result;
}

/**
 * キャッシュをクリア（テスト用）
 */
export function clearCache(): void {
  cache.clear();
  console.log("[parameter-store] Cache cleared");
}

/**
 * Parameter Storeの設定パス（プロジェクト全体で統一）
 */
export const PARAMETER_PATHS = {
  // 機密情報（SecureString）
  OPENAI_API_KEY: "/ai-workshop/openai-api-key",
  GOOGLE_API_KEY: "/ai-workshop/google-api-key",
  BEDROCK_ACCESS_KEY_ID: "/ai-workshop/bedrock-access-key-id",
  BEDROCK_SECRET_ACCESS_KEY: "/ai-workshop/bedrock-secret-access-key",
  BEDROCK_SESSION_TOKEN: "/ai-workshop/bedrock-session-token",
  AUTH_USERNAME: "/ai-workshop/auth-username",
  AUTH_PASSWORD: "/ai-workshop/auth-password",

  // 設定値（String）
  OPENAI_MODEL: "/ai-workshop/openai-model",
  GEMINI_MODEL: "/ai-workshop/gemini-model",
  BEDROCK_MODEL_ID: "/ai-workshop/bedrock-model-id",
  BEDROCK_REGION: "/ai-workshop/bedrock-region",
  MOCK_MODE: "/ai-workshop/mock-mode",
  DISABLE_AUTH: "/ai-workshop/disable-auth"
} as const;
