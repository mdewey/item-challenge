# -----------------------------------------------------------------------------
# DynamoDB Table for Items
# -----------------------------------------------------------------------------

resource "aws_dynamodb_table" "items" {
  name         = local.table_name
  billing_mode = "PAY_PER_REQUEST" # On-demand pricing, scales automatically

  hash_key = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "subject"
    type = "S"
  }

  attribute {
    name = "status"
    type = "S"
  }

  # GSI for querying by subject
  global_secondary_index {
    name            = "subject-index"
    hash_key        = "subject"
    projection_type = "ALL"
  }

  # GSI for querying by status
  global_secondary_index {
    name            = "status-index"
    hash_key        = "status"
    projection_type = "ALL"
  }

  # Enable point-in-time recovery for production
  point_in_time_recovery {
    enabled = var.environment == "prod"
  }

  # Enable server-side encryption
  server_side_encryption {
    enabled = true
  }

  tags = {
    Name = local.table_name
  }
}
