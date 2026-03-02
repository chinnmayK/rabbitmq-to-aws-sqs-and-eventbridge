output "mongo_secret_arn" {
  value = aws_secretsmanager_secret.mongo_secret.arn
}

output "mongo_password" {
  value     = random_password.mongo_password.result
  sensitive = true
}

output "jwt_secret_arn" {
  value = aws_secretsmanager_secret.jwt_secret.arn
}
