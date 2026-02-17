output "public_subnet_id" {
  value = aws_subnet.public.id
}

output "security_group_id" {
  value = aws_security_group.app_sg.id
}

output "vpc_id" {
  value = aws_vpc.main.id
}
