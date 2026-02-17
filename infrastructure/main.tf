module "network" {
  source       = "./modules/network"
  project_name = var.project_name
}

module "iam" {
  source       = "./modules/iam"
  project_name = var.project_name
}

module "ecr" {
  source       = "./modules/ecr"
  project_name = var.project_name
}

module "secrets" {
  source       = "./modules/secrets"
  project_name = var.project_name
  redis_endpoint = module.network.redis_endpoint
}

module "ec2" {
  source             = "./modules/ec2"
  project_name       = var.project_name
  subnet_id          = module.network.public_subnet_id
  security_group_id  = module.network.security_group_id
  instance_role_name = module.iam.instance_profile_name
}

module "cicd" {
  source               = "./modules/cicd"
  project_name         = var.project_name
  aws_region           = var.aws_region
  codepipeline_role_arn = module.iam.codepipeline_role_arn
  codebuild_role_arn    = module.iam.codebuild_role_arn
}
