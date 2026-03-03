output "public_ip" {
  value = aws_instance.app.public_ip
}

output "instance_name" {
  value = aws_instance.app.tags["Name"]
}

output "security_group_id" {
  value = var.security_group_id
}
