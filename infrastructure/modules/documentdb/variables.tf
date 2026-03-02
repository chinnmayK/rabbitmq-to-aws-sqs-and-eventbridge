variable "project_name" {
  description = "Project name prefix for all resources"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID where DocumentDB will be provisioned"
  type        = string
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs for the DocumentDB subnet group (must span ≥2 AZs)"
  type        = list(string)
}

variable "ec2_sg_id" {
  description = "Security group ID of the EC2 instance — DocumentDB will allow inbound only from this"
  type        = string
}

variable "docdb_username" {
  description = "Master username for DocumentDB"
  type        = string
}

variable "docdb_password" {
  description = "Master password for DocumentDB"
  type        = string
  sensitive   = true
}
