resource "aws_s3_bucket" "artifact_bucket" {
  bucket = "${var.project_name}-artifacts"

  force_destroy = true
}

resource "aws_s3_bucket_versioning" "artifact_versioning" {
  bucket = aws_s3_bucket.artifact_bucket.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_codebuild_project" "microservices_build" {
  name          = "${var.project_name}-build"
  description   = "Build all microservices docker images"
  service_role  = var.codebuild_role_arn

  artifacts {
    type = "CODEPIPELINE"
  }

  environment {
    compute_type                = "BUILD_GENERAL1_SMALL"
    image                       = "aws/codebuild/standard:7.0"
    type                        = "LINUX_CONTAINER"
    privileged_mode             = true   # required for Docker build

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
    type = "CODEPIPELINE"
    buildspec = "buildspec.yml"
  }

  build_timeout = 20
}

################################
# CODESTAR GITHUB CONNECTION
################################

resource "aws_codestarconnections_connection" "github" {
  name          = "${var.project_name}-gc"
  provider_type = "GitHub"
}

resource "aws_codepipeline" "microservices_pipeline" {
  name     = "${var.project_name}-pipeline"
  role_arn = var.codepipeline_role_arn

  artifact_store {
    location = aws_s3_bucket.artifact_bucket.bucket
    type     = "S3"
  }

  ################################
  # SOURCE STAGE (GitHub)
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
        FullRepositoryId = "chinnmayK/nodejs-microservices"
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
}
