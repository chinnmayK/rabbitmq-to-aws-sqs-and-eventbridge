variable "project_name" {
  type = string
}

variable "aws_region" {
  type = string
}

variable "codebuild_role_arn" {
  type = string
}

variable "codepipeline_role_arn" {
  type = string
}

variable "codedeploy_role_arn" {
  type = string
}

variable "sonar_host_url" {
  description = "SonarQube host URL accessible from CodeBuild (e.g. http://EC2_IP:9000)"
  type        = string
}
