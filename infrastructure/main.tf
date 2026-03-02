########################################################
# NETWORK MODULE
########################################################

module "network" {
  source       = "./modules/network"
  project_name = var.project_name
}

########################################################
# IAM MODULE
########################################################

module "iam" {
  source       = "./modules/iam"
  project_name = var.project_name
}

########################################################
# ECR MODULE
########################################################

module "ecr" {
  source       = "./modules/ecr"
  project_name = var.project_name
}

########################################################
# SECRETS MODULE
########################################################

module "secrets" {
  source         = "./modules/secrets"
  project_name   = var.project_name
  redis_endpoint = module.network.redis_endpoint
}

########################################################
# MESSAGING MODULE (SQS + EVENTBRIDGE)
########################################################

module "messaging" {
  source       = "./modules/messaging"
  project_name = var.project_name
  email        = var.email
}

########################################################
# EC2 MODULE
########################################################

module "ec2" {
  source                = "./modules/ec2"
  project_name          = var.project_name
  subnet_id             = module.network.public_subnet_id
  security_group_id     = module.network.security_group_id
  instance_profile_name = module.iam.instance_profile_name

  depends_on = [
    module.iam,
    module.network
  ]
}

########################################################
# CICD MODULE
########################################################

module "cicd" {
  source = "./modules/cicd"

  project_name = var.project_name
  aws_region   = var.aws_region

  codebuild_role_arn    = module.iam.codebuild_role_arn
  codepipeline_role_arn = module.iam.codepipeline_role_arn
  codedeploy_role_arn   = module.iam.codedeploy_role_arn

  sonar_host_url = var.sonar_host_url

  depends_on = [
    module.iam
  ]
}

########################################################
# DOCUMENTDB MODULE
########################################################

module "documentdb" {
  source = "./modules/documentdb"

  project_name       = var.project_name
  vpc_id             = module.network.vpc_id
  private_subnet_ids = module.network.private_subnet_ids
  ec2_sg_id          = module.network.security_group_id
  docdb_username     = var.docdb_username
  docdb_password     = module.secrets.mongo_password

  depends_on = [
    module.network,
    module.secrets
  ]
}
