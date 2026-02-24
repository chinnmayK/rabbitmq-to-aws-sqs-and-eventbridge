########################################################
# SQS DEAD LETTER QUEUE
########################################################

resource "aws_sqs_queue" "customer_created_dlq" {
  name = "${var.project_name}-customer-created-dlq"
}

########################################################
# MAIN SQS QUEUE
########################################################

resource "aws_sqs_queue" "customer_created" {
  name                       = "${var.project_name}-customer-created-queue"
  visibility_timeout_seconds = 30
  message_retention_seconds  = 86400

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.customer_created_dlq.arn
    maxReceiveCount     = 5
  })
}

########################################################
# EVENTBRIDGE BUS
########################################################

resource "aws_cloudwatch_event_bus" "microservices_bus" {
  name = "${var.project_name}-bus"
}

########################################################
# EVENT RULE
########################################################

resource "aws_cloudwatch_event_rule" "customer_created_rule" {
  name           = "${var.project_name}-customer-created-rule"
  event_bus_name = aws_cloudwatch_event_bus.microservices_bus.name

  event_pattern = jsonencode({
    source      = ["customer.service"]
    detail-type = ["CustomerCreated"]
  })
}

########################################################
# EVENT TARGET → SQS
########################################################

resource "aws_cloudwatch_event_target" "sqs_target" {
  rule           = aws_cloudwatch_event_rule.customer_created_rule.name
  event_bus_name = aws_cloudwatch_event_bus.microservices_bus.name
  arn            = aws_sqs_queue.customer_created.arn
}

########################################################
# ALLOW EVENTBRIDGE TO SEND TO SQS
########################################################

resource "aws_sqs_queue_policy" "allow_eventbridge" {
  queue_url = aws_sqs_queue.customer_created.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "events.amazonaws.com"
        }
        Action   = "sqs:SendMessage"
        Resource = aws_sqs_queue.customer_created.arn
      }
    ]
  })
}