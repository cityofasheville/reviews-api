#!/usr/bin/env sh
set -e

REGION="us-east-1"
ECR_URL="382274149743.dkr.ecr.us-east-1.amazonaws.com/coa-reviewsapi"
BUILD_NUMBER="${BUILD_NUMBER:-$(date +%s)}"
APP_NAME="reviewsapi"

echo "Building $BUILD_NUMBER"

# log docker into eks using aws cli
$(aws ecr get-login --no-include-email --region $REGION)
# build a docker image with a unique build number
docker build -t $ECR_URL:$BUILD_NUMBER \
  --build-arg VERSION="$BUILD_NUMBER" \
  .

# push to ecr
docker push $ECR_URL:$BUILD_NUMBER

#tag for "latest" and also push that
docker tag $ECR_URL:$BUILD_NUMBER $ECR_URL:latest
docker push $ECR_URL:latest