#!/bin/bash
set -euo pipefail
REGION=${AWS_REGION:-ap-northeast-1}

for key in OPENAI_API_KEY GOOGLE_API_KEY AUTH_USERNAME AUTH_PASSWORD; do
  echo "Setting /til/$key ..."
  aws ssm put-parameter \
    --region "$REGION" \
    --name "/til/$key" \
    --type SecureString \
    --value "${!key}" \
    --overwrite
done
echo "Done."
