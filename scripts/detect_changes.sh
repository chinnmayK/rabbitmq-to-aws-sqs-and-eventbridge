#!/bin/bash

echo "Checking changed files..."

CHANGED_FILES=$(git diff --name-only HEAD~1 HEAD)

echo "$CHANGED_FILES"

RUN_ANALYSIS=false
RUN_BUILD=false
RUN_DEPLOY=false

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

echo "RUN_ANALYSIS=$RUN_ANALYSIS"
echo "RUN_BUILD=$RUN_BUILD"
echo "RUN_DEPLOY=$RUN_DEPLOY"

echo "RUN_ANALYSIS=$RUN_ANALYSIS" >> pipeline.env
echo "RUN_BUILD=$RUN_BUILD" >> pipeline.env
echo "RUN_DEPLOY=$RUN_DEPLOY" >> pipeline.env
