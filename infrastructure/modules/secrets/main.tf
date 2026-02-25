############################################################
# RANDOM PASSWORDS
############################################################

resource "random_password" "mongo_password" {
  length  = 20
  special = false
}

resource "random_password" "jwt_secret" {
  length  = 32
  special = false
}

############################################################
# MongoDB Secret
############################################################

resource "aws_secretsmanager_secret" "mongo_secret" {
  name                    = "${var.project_name}-mongo-credentials_v2"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "mongo_secret_value" {
  secret_id = aws_secretsmanager_secret.mongo_secret.id

  secret_string = jsonencode({
    username = "admin"
    password = random_password.mongo_password.result
  })
}

############################################################
# JWT Secret
############################################################

resource "aws_secretsmanager_secret" "jwt_secret" {
  name                    = "${var.project_name}-jwt-secret_v2"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "jwt_secret_value" {
  secret_id = aws_secretsmanager_secret.jwt_secret.id

  secret_string = jsonencode({
    jwt = random_password.jwt_secret.result
  })
}

############################################################
# Redis Secret
############################################################

resource "aws_secretsmanager_secret" "redis_secret" {
  name                    = "${var.project_name}-redis_v2"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "redis_secret_value" {
  secret_id = aws_secretsmanager_secret.redis_secret.id

  secret_string = jsonencode({
    REDIS_URL = var.redis_endpoint
  })
}

resource "aws_secretsmanager_secret" "ngrok_secret" {
  name                    = "${var.project_name}-ngrok-token"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "ngrok_secret_value" {
  secret_id = aws_secretsmanager_secret.ngrok_secret.id

  secret_string = "36hO44WBmbBQi4gzS1uKG3rcd0M_5s1VJ5EFGc6vQw7A12h5y"
}
