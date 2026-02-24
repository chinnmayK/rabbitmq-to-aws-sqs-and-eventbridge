############################################################
# S3 ARTIFACT BUCKET
############################################################

resource "aws_s3_bucket" "artifact_bucket" {
  bucket        = "${var.project_name}-artifacts"
  force_destroy = true
}

resource "aws_s3_bucket_versioning" "artifact_versioning" {
  bucket = aws_s3_bucket.artifact_bucket.id

  versioning_configuration {
    status = "Enabled"
  }
}

# 🔐 Recommended: Enable encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "artifact_encryption" {
  bucket = aws_s3_bucket.artifact_bucket.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

############################################################
# CODEBUILD PROJECT
############################################################

resource "aws_codebuild_project" "microservices_build" {
  name         = "${var.project_name}-build"
  description  = "Build all microservices docker images"
  service_role = var.codebuild_role_arn

  artifacts {
    type = "CODEPIPELINE"
  }

  environment {
    compute_type    = "BUILD_GENERAL1_SMALL"
    image           = "aws/codebuild/standard:7.0"
    type            = "LINUX_CONTAINER"
    privileged_mode = true

    environment_variable {
      name  = "AWS_DEFAULT_REGION"
      value = var.aws_region
    }

    environment_variable {
      name  = "PROJECT_NAME"
      value = var.project_name
    }
  }

  source {
    type      = "CODEPIPELINE"
    buildspec = "buildspec.yml"
  }

  build_timeout = 20
}

############################################################
# CODEDEPLOY APPLICATION
############################################################

resource "aws_codedeploy_app" "app" {
  name             = "${var.project_name}-app"
  compute_platform = "Server"
}

resource "aws_codedeploy_deployment_group" "deployment_group" {
  app_name              = aws_codedeploy_app.app.name
  deployment_group_name = "${var.project_name}-dg"
  service_role_arn      = var.codedeploy_role_arn

  deployment_config_name = "CodeDeployDefault.AllAtOnce"

  # Explicit deployment style
  deployment_style {
    deployment_type   = "IN_PLACE"
    deployment_option = "WITHOUT_TRAFFIC_CONTROL"
  }

  ec2_tag_set {
    ec2_tag_filter {
      key   = "Name"
      type  = "KEY_AND_VALUE"
      value = "${var.project_name}-ec2"
    }
  }
}

############################################################
# CODESTAR CONNECTION
############################################################

resource "aws_codestarconnections_connection" "github" {
  name          = "${var.project_name}-gc"
  provider_type = "GitHub"
}

############################################################
# CODEPIPELINE
############################################################

resource "aws_codepipeline" "microservices_pipeline" {
  name     = "${var.project_name}-pipeline"
  role_arn = var.codepipeline_role_arn

  artifact_store {
    location = aws_s3_bucket.artifact_bucket.bucket
    type     = "S3"

    # 🔐 Recommended encryption block
    encryption_key {
      id   = "alias/aws/s3"
      type = "KMS"
    }
  }

  ################################
  # SOURCE STAGE
  ################################
  stage {
    name = "Source"

    action {
      name             = "GitHub_Source"
      category         = "Source"
      owner            = "AWS"
      provider         = "CodeStarSourceConnection"
      version          = "1"
      output_artifacts = ["source_output"]

      configuration = {
        ConnectionArn    = aws_codestarconnections_connection.github.arn
        FullRepositoryId = "chinnmayK/rabbitmq-to-aws-sqs-and-eventbridge"
        BranchName       = "main"
        DetectChanges    = "true"
      }
    }
  }

  ################################
  # BUILD STAGE
  ################################
  stage {
    name = "Build"

    action {
      name             = "Docker_Build"
      category         = "Build"
      owner            = "AWS"
      provider         = "CodeBuild"
      input_artifacts  = ["source_output"]
      output_artifacts = ["build_output"]
      version          = "1"

      configuration = {
        ProjectName = aws_codebuild_project.microservices_build.name
      }
    }
  }

  ################################
  # DEPLOY STAGE
  ################################
  stage {
    name = "Deploy"

    action {
      name            = "DeployToEC2"
      category        = "Deploy"
      owner           = "AWS"
      provider        = "CodeDeploy"
      version         = "1"
      input_artifacts = ["build_output"]

      configuration = {
        ApplicationName     = aws_codedeploy_app.app.name
        DeploymentGroupName = aws_codedeploy_deployment_group.deployment_group.deployment_group_name
      }
    }
  }

  depends_on = [
    aws_codestarconnections_connection.github,
    aws_codebuild_project.microservices_build,
    aws_codedeploy_app.app,
    aws_s3_bucket_server_side_encryption_configuration.artifact_encryption
  ]
}