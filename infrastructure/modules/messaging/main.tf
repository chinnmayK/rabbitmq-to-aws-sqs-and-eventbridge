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
    maxReceiveCount     = 3
  })
}

resource "aws_sqs_queue" "order_created" {
  name                       = "r2sqs-eb-order-created-queue"
  visibility_timeout_seconds = 30
  message_retention_seconds  = 86400
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

resource "aws_cloudwatch_event_rule" "order_created_rule" {
  name           = "${var.project_name}-order-created-rule"
  event_bus_name = aws_cloudwatch_event_bus.microservices_bus.name

  event_pattern = jsonencode({
    detail-type = ["OrderCreated"]
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

resource "aws_cloudwatch_event_target" "sqs_order_target" {
  rule           = aws_cloudwatch_event_rule.order_created_rule.name
  event_bus_name = aws_cloudwatch_event_bus.microservices_bus.name
  arn            = aws_sqs_queue.order_created.arn
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

resource "aws_sqs_queue_policy" "allow_eventbridge_order_created" {
  queue_url = aws_sqs_queue.order_created.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "events.amazonaws.com"
        }
        Action   = "sqs:SendMessage"
        Resource = aws_sqs_queue.order_created.arn
      }
    ]
  })
}

########################################################
# CLOUDWATCH ALARMS
########################################################

resource "aws_cloudwatch_metric_alarm" "dlq_alarm" {
  alarm_name          = "${var.project_name}-dlq-alarm"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = "60"
  statistic           = "Sum"
  threshold           = "0"
  alarm_description   = "This alarm monitors if there are any messages in the DLQ"

  dimensions = {
    QueueName = aws_sqs_queue.customer_created_dlq.name
  }
}

resource "aws_cloudwatch_metric_alarm" "queue_backlog_alarm" {
  alarm_name          = "${var.project_name}-queue-backlog-alarm"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = "60"
  statistic           = "Average"
  threshold           = "50"
  alarm_description   = "This alarm monitors if the main queue backlog exceeds 50 messages"

  dimensions = {
    QueueName = aws_sqs_queue.customer_created.name
  }
}
