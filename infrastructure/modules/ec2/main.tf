resource "aws_instance" "app" {
  ami                         = "ami-019715e0d74f695be"
  instance_type               = "t3.medium"
  subnet_id                   = var.subnet_id
  vpc_security_group_ids      = [var.security_group_id]
  associate_public_ip_address = true
  iam_instance_profile        = var.instance_profile_name
  key_name                    = "my-key"

  user_data_base64 = base64encode(file("${path.module}/../../../scripts/user_data.sh"))

  metadata_options {
    http_endpoint = "enabled"
    http_tokens   = "required"
  }

  root_block_device {
    volume_size = 30
    volume_type = "gp3"
  }

  tags = {
    Name = "${var.project_name}-ec2"
  }

  lifecycle {
    create_before_destroy = true
  }
}
