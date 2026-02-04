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
REGION="${AWS_REGION:-us-east-1}"
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
echo -e "${YELLOW}APIキーを入力してください（空の場合はスキップ）:${NC}"
echo ""

read -p "OpenAI API Key (sk-...): " OPENAI_API_KEY
read -p "Google API Key (AIza...): " GOOGLE_API_KEY
read -p "Bedrock Access Key ID (AKIA...): " BEDROCK_ACCESS_KEY_ID
read -s -p "Bedrock Secret Access Key: " BEDROCK_SECRET_ACCESS_KEY
echo ""
read -s -p "Bedrock Session Token（オプション、Enter でスキップ）: " BEDROCK_SESSION_TOKEN
echo ""
echo ""

# パラメータの登録関数
create_parameter() {
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

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Parameter Store にパラメータを登録中...${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# パラメータの登録
create_parameter \
    "${PARAMETER_PREFIX}/openai-api-key" \
    "${OPENAI_API_KEY}" \
    "OpenAI API Key for AI Workshop"

create_parameter \
    "${PARAMETER_PREFIX}/google-api-key" \
    "${GOOGLE_API_KEY}" \
    "Google API Key for AI Workshop"

create_parameter \
    "${PARAMETER_PREFIX}/bedrock-access-key-id" \
    "${BEDROCK_ACCESS_KEY_ID}" \
    "AWS Bedrock Access Key ID"

create_parameter \
    "${PARAMETER_PREFIX}/bedrock-secret-access-key" \
    "${BEDROCK_SECRET_ACCESS_KEY}" \
    "AWS Bedrock Secret Access Key"

create_parameter \
    "${PARAMETER_PREFIX}/bedrock-session-token" \
    "${BEDROCK_SESSION_TOKEN}" \
    "AWS Bedrock Session Token (optional)"

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
