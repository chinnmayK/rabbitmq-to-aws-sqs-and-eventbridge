output "public_ip" {
  description = "Public IP of EC2 instance"
  value       = module.ec2.public_ip
}

output "instance_name" {
  description = "EC2 instance name"
  value       = module.ec2.instance_name
}

output "redis_endpoint" {
  description = "Redis cluster endpoint"
  value       = module.network.redis_endpoint
}

output "docdb_endpoint" {
  description = "DocumentDB cluster write endpoint"
  value       = module.documentdb.endpoint
}

output "docdb_port" {
  description = "DocumentDB cluster port"
  value       = module.documentdb.port
}
