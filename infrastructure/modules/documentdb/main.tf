########################################################
# DOCUMENTDB SUBNET GROUP
########################################################

resource "aws_docdb_subnet_group" "this" {
  name       = "${var.project_name}-docdb-subnet"
  subnet_ids = var.private_subnet_ids

  tags = {
    Name = "${var.project_name}-docdb-subnet"
  }
}

########################################################
# DOCUMENTDB SECURITY GROUP
########################################################

resource "aws_security_group" "docdb_sg" {
  name        = "${var.project_name}-docdb-sg"
  description = "Allow DocumentDB access from EC2 only"
  vpc_id      = var.vpc_id

  ingress {
    description     = "MongoDB wire protocol from EC2"
    from_port       = 27017
    to_port         = 27017
    protocol        = "tcp"
    security_groups = [var.ec2_sg_id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-docdb-sg"
  }
}

########################################################
# DOCUMENTDB CLUSTER
########################################################

resource "aws_docdb_cluster" "this" {
  cluster_identifier     = "${var.project_name}-docdb"
  engine                 = "docdb"
  master_username        = var.docdb_username
  master_password        = var.docdb_password
  db_subnet_group_name   = aws_docdb_subnet_group.this.name
  vpc_security_group_ids = [aws_security_group.docdb_sg.id]
  skip_final_snapshot    = true
  deletion_protection    = false

  # TLS is enabled by default on DocumentDB — no need to disable
  tags = {
    Name = "${var.project_name}-docdb"
  }
}

########################################################
# DOCUMENTDB CLUSTER INSTANCE
########################################################

resource "aws_docdb_cluster_instance" "this" {
  identifier         = "${var.project_name}-docdb-instance-1"
  cluster_identifier = aws_docdb_cluster.this.id
  instance_class     = "db.t3.medium"

  tags = {
    Name = "${var.project_name}-docdb-instance"
  }
}

########################################################
# STORE ENDPOINT IN SSM (for deploy.sh)
########################################################

resource "aws_ssm_parameter" "docdb_endpoint" {
  name        = "/${var.project_name}/docdb_endpoint"
  description = "DocumentDB cluster endpoint"
  type        = "String"
  value       = aws_docdb_cluster.this.endpoint
  overwrite   = true

  tags = {
    Name = "${var.project_name}-docdb-endpoint"
  }
}
