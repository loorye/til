#!/bin/bash

# AWS Parameter Store セットアップスクリプト
# 使用方法: ./scripts/setup-parameter-store.sh

set -e

# カラー定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 設定
REGION="${AWS_REGION:-ap-northeast-1}"
PARAMETER_PREFIX="/ai-workshop"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}AWS Parameter Store セットアップ${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "リージョン: ${YELLOW}${REGION}${NC}"
echo -e "パラメータプレフィックス: ${YELLOW}${PARAMETER_PREFIX}${NC}"
echo ""

# AWS CLIの確認
if ! command -v aws &> /dev/null; then
    echo -e "${RED}エラー: AWS CLI がインストールされていません${NC}"
    echo "インストール: https://aws.amazon.com/cli/"
    exit 1
fi

# AWS認証情報の確認
echo -e "${YELLOW}AWS認証情報を確認中...${NC}"
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}エラー: AWS認証情報が設定されていません${NC}"
    echo "設定方法: aws configure"
    exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
USER_ARN=$(aws sts get-caller-identity --query Arn --output text)
echo -e "${GREEN}✓ 認証成功${NC}"
echo -e "  アカウント ID: ${ACCOUNT_ID}"
echo -e "  ユーザー: ${USER_ARN}"
echo ""

# パラメータの入力
echo -e "${YELLOW}=== 機密情報（SecureString） ===${NC}"
echo -e "${YELLOW}APIキーと認証情報を入力してください（空の場合はスキップ）:${NC}"
echo ""

read -p "OpenAI API Key (sk-...): " OPENAI_API_KEY
read -p "Google API Key (AIza...): " GOOGLE_API_KEY
read -p "Bedrock Access Key ID (AKIA...): " BEDROCK_ACCESS_KEY_ID
read -s -p "Bedrock Secret Access Key: " BEDROCK_SECRET_ACCESS_KEY
echo ""
read -s -p "Bedrock Session Token（オプション、Enter でスキップ）: " BEDROCK_SESSION_TOKEN
echo ""
echo ""

echo -e "${YELLOW}=== Basic認証の設定 ===${NC}"
read -p "AUTH_USERNAME（デフォルト: admin）: " AUTH_USERNAME
AUTH_USERNAME="${AUTH_USERNAME:-admin}"
read -s -p "AUTH_PASSWORD（デフォルト: password）: " AUTH_PASSWORD
echo ""
AUTH_PASSWORD="${AUTH_PASSWORD:-password}"
read -p "DISABLE_AUTH（trueで認証無効化、デフォルト: false）: " DISABLE_AUTH
DISABLE_AUTH="${DISABLE_AUTH:-false}"
echo ""

echo -e "${YELLOW}=== モデル設定（String） ===${NC}"
echo -e "${YELLOW}モデル名とリージョンを入力してください（Enter でデフォルト値）:${NC}"
echo ""

read -p "OPENAI_MODEL（デフォルト: gpt-4o-mini）: " OPENAI_MODEL
OPENAI_MODEL="${OPENAI_MODEL:-gpt-4o-mini}"

read -p "GEMINI_MODEL（デフォルト: gemini-1.0-pro）: " GEMINI_MODEL
GEMINI_MODEL="${GEMINI_MODEL:-gemini-1.0-pro}"

read -p "BEDROCK_MODEL_ID（デフォルト: anthropic.claude-3-5-sonnet-20240620-v1:0）: " BEDROCK_MODEL_ID
BEDROCK_MODEL_ID="${BEDROCK_MODEL_ID:-anthropic.claude-3-5-sonnet-20240620-v1:0}"

read -p "BEDROCK_REGION（デフォルト: us-east-1）: " BEDROCK_REGION_VALUE
BEDROCK_REGION_VALUE="${BEDROCK_REGION_VALUE:-us-east-1}"

read -p "MOCK_MODE（trueでモックモード、デフォルト: false）: " MOCK_MODE
MOCK_MODE="${MOCK_MODE:-false}"

echo ""

# パラメータの登録関数（SecureString）
create_secure_parameter() {
    local name=$1
    local value=$2
    local description=$3

    if [ -z "$value" ]; then
        echo -e "${YELLOW}⊘ スキップ: ${name}${NC}"
        return
    fi

    echo -e "${YELLOW}→ 作成中: ${name}${NC}"

    if aws ssm put-parameter \
        --name "${name}" \
        --value "${value}" \
        --type "SecureString" \
        --description "${description}" \
        --region "${REGION}" \
        --overwrite \
        &> /dev/null; then
        echo -e "${GREEN}✓ 成功: ${name}${NC}"
    else
        echo -e "${RED}✗ 失敗: ${name}${NC}"
    fi
}

# パラメータの登録関数（String）
create_string_parameter() {
    local name=$1
    local value=$2
    local description=$3

    if [ -z "$value" ]; then
        echo -e "${YELLOW}⊘ スキップ: ${name}${NC}"
        return
    fi

    echo -e "${YELLOW}→ 作成中: ${name}${NC}"

    if aws ssm put-parameter \
        --name "${name}" \
        --value "${value}" \
        --type "String" \
        --description "${description}" \
        --region "${REGION}" \
        --overwrite \
        &> /dev/null; then
        echo -e "${GREEN}✓ 成功: ${name}${NC}"
    else
        echo -e "${RED}✗ 失敗: ${name}${NC}"
    fi
}

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Parameter Store にパラメータを登録中...${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 機密情報の登録（SecureString）
echo -e "${GREEN}--- 機密情報（SecureString）の登録 ---${NC}"
create_secure_parameter \
    "${PARAMETER_PREFIX}/openai-api-key" \
    "${OPENAI_API_KEY}" \
    "OpenAI API Key for AI Workshop"

create_secure_parameter \
    "${PARAMETER_PREFIX}/google-api-key" \
    "${GOOGLE_API_KEY}" \
    "Google API Key for AI Workshop"

create_secure_parameter \
    "${PARAMETER_PREFIX}/bedrock-access-key-id" \
    "${BEDROCK_ACCESS_KEY_ID}" \
    "AWS Bedrock Access Key ID"

create_secure_parameter \
    "${PARAMETER_PREFIX}/bedrock-secret-access-key" \
    "${BEDROCK_SECRET_ACCESS_KEY}" \
    "AWS Bedrock Secret Access Key"

create_secure_parameter \
    "${PARAMETER_PREFIX}/bedrock-session-token" \
    "${BEDROCK_SESSION_TOKEN}" \
    "AWS Bedrock Session Token (optional)"

create_secure_parameter \
    "${PARAMETER_PREFIX}/auth-username" \
    "${AUTH_USERNAME}" \
    "Basic Authentication Username"

create_secure_parameter \
    "${PARAMETER_PREFIX}/auth-password" \
    "${AUTH_PASSWORD}" \
    "Basic Authentication Password"

echo ""
echo -e "${GREEN}--- 設定値（String）の登録 ---${NC}"

# 設定値の登録（String）
create_string_parameter \
    "${PARAMETER_PREFIX}/openai-model" \
    "${OPENAI_MODEL}" \
    "OpenAI Model Name"

create_string_parameter \
    "${PARAMETER_PREFIX}/gemini-model" \
    "${GEMINI_MODEL}" \
    "Gemini Model Name"

create_string_parameter \
    "${PARAMETER_PREFIX}/bedrock-model-id" \
    "${BEDROCK_MODEL_ID}" \
    "Bedrock Model ID"

create_string_parameter \
    "${PARAMETER_PREFIX}/bedrock-region" \
    "${BEDROCK_REGION_VALUE}" \
    "Bedrock Region"

create_string_parameter \
    "${PARAMETER_PREFIX}/mock-mode" \
    "${MOCK_MODE}" \
    "Mock Mode (true/false)"

create_string_parameter \
    "${PARAMETER_PREFIX}/disable-auth" \
    "${DISABLE_AUTH}" \
    "Disable Authentication (true/false)"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}登録完了${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# パラメータの確認
echo -e "${YELLOW}登録されたパラメータを確認中...${NC}"
echo ""

aws ssm describe-parameters \
    --parameter-filters "Key=Name,Option=BeginsWith,Values=${PARAMETER_PREFIX}" \
    --region "${REGION}" \
    --query "Parameters[].{Name:Name,Type:Type,LastModifiedDate:LastModifiedDate}" \
    --output table

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}次のステップ${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "1. IAM権限の設定:"
echo "   Amplify実行ロールに以下のポリシーをアタッチしてください。"
echo ""
echo -e "${YELLOW}   ポリシー例:${NC}"
cat <<EOF
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": ["ssm:GetParameter", "ssm:GetParameters"],
         "Resource": "arn:aws:ssm:${REGION}:${ACCOUNT_ID}:parameter${PARAMETER_PREFIX}/*"
       },
       {
         "Effect": "Allow",
         "Action": ["kms:Decrypt"],
         "Resource": "*",
         "Condition": {
           "StringEquals": {
             "kms:ViaService": "ssm.${REGION}.amazonaws.com"
           }
         }
       }
     ]
   }
EOF
echo ""
echo "2. Amplifyの環境変数を設定:"
echo "   AWS_REGION=${REGION}"
echo "   BEDROCK_REGION=${REGION}"
echo ""
echo "3. アプリをデプロイしてParameter Storeから認証情報を取得"
echo ""
echo -e "${GREEN}セットアップ完了！${NC}"
