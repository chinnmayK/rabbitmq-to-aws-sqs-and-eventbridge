module "bootstrap" {
  source       = "./modules/bootstrap"
  project_name = var.project_name
}

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
}

module "ec2" {
  source             = "./modules/ec2"
  project_name       = var.project_name
  subnet_id          = module.network.public_subnet_id
  security_group_id  = module.network.security_group_id
  instance_role_name = module.iam.ec2_role_name
}

module "cicd" {
  source             = "./modules/cicd"
  project_name       = var.project_name
  github_repo        = var.github_repo
  ecr_urls           = module.ecr.repository_urls
  ec2_instance_name  = module.ec2.instance_name
}
