output "endpoint" {
  description = "DocumentDB cluster endpoint (write endpoint)"
  value       = aws_docdb_cluster.this.endpoint
}

output "port" {
  description = "DocumentDB cluster port"
  value       = aws_docdb_cluster.this.port
}

output "reader_endpoint" {
  description = "DocumentDB cluster reader endpoint"
  value       = aws_docdb_cluster.this.reader_endpoint
}
