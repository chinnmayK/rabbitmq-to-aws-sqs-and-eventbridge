variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
}

variable "github_repo" {
  description = "GitHub repo owner/name"
  type        = string
}

variable "email" {
  description = "Email address for SNS alert notifications"
  type        = string
}

variable "sonar_host_url" {
  description = "SonarQube host URL for CodeBuild analysis (e.g. http://EC2_IP:9000)"
  type        = string
  default     = ""
}
