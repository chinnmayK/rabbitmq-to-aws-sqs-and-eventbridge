#!/bin/bash

echo "Checking changed files..."

CHANGED_FILES=$(git diff --name-only HEAD~1 HEAD || true)

echo "$CHANGED_FILES"

RUN_ANALYSIS=false
RUN_BUILD=false
RUN_DEPLOY=false

# ---------- FIRST DEPLOYMENT CHECK ----------
echo "Checking if images exist in ECR..."

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_URL="$ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com"

SERVICES=("customer" "products" "shopping" "gateway")

MISSING_IMAGE=false

for service in "${SERVICES[@]}"; do
  if ! aws ecr describe-images \
       --repository-name "$PROJECT_NAME-$service" \
       --region "$AWS_DEFAULT_REGION" \
       --query 'imageDetails[*].imageTags' \
       --output text 2>/dev/null | grep -q latest; then
    echo "Image for $service not found in ECR"
    MISSING_IMAGE=true
  fi
done

if [ "$MISSING_IMAGE" = true ]; then
  echo "First deployment detected — forcing full build and deploy"
  RUN_ANALYSIS=true
  RUN_BUILD=true
  RUN_DEPLOY=true
else
  echo "Existing deployment detected — applying optimized pipeline"

  for file in $CHANGED_FILES
  do
    if [[ $file == *.js || $file == package.json ]]; then
        RUN_ANALYSIS=true
        RUN_BUILD=true
        RUN_DEPLOY=true
    fi

    if [[ $file == Dockerfile || $file == docker-compose.yml ]]; then
        RUN_BUILD=true
        RUN_DEPLOY=true
    fi

    if [[ $file == terraform/* ]]; then
        RUN_DEPLOY=true
    fi
  done
fi

echo "RUN_ANALYSIS=$RUN_ANALYSIS"
echo "RUN_BUILD=$RUN_BUILD"
echo "RUN_DEPLOY=$RUN_DEPLOY"

cat <<EOF > pipeline.env
RUN_ANALYSIS=$RUN_ANALYSIS
RUN_BUILD=$RUN_BUILD
RUN_DEPLOY=$RUN_DEPLOY
EOF

echo "pipeline.env created:"
cat pipeline.env