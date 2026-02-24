output "customer_created_queue_url" {
  value = aws_sqs_queue.customer_created.id
}

output "event_bus_name" {
  value = aws_cloudwatch_event_bus.microservices_bus.name
}