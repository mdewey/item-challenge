# -----------------------------------------------------------------------------
# DynamoDB Table for Items
# -----------------------------------------------------------------------------
#
# Schema Design (Single Table):
#
# Main Table:
#   PK: pk (e.g., "ITEM#<uuid>")
#   SK: sk (e.g., "CURRENT" or "VERSION#00001")
#
# Access Patterns:
#   - getItem(id)        → PK = ITEM#id, SK = CURRENT
#   - getAuditTrail(id)  → PK = ITEM#id, SK begins_with VERSION#
#   - listItems(subject) → Query SubjectIndex
#   - listItems(status)  → Query StatusIndex
#
# GSI1 (SubjectIndex): For listing items by subject
#   PK: subject
#   SK: status#id (enables filtering by status within subject)
#
# GSI2 (StatusIndex): For listing items by status alone
#   PK: status
#   SK: subject#id (enables filtering by subject within status)
#
# -----------------------------------------------------------------------------

resource "aws_dynamodb_table" "items" {
  name         = local.table_name
  billing_mode = "PAY_PER_REQUEST" # On-demand pricing, scales automatically

  # Composite primary key
  hash_key  = "pk"
  range_key = "sk"

  # Primary key attributes
  attribute {
    name = "pk"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }

  # GSI attributes
  attribute {
    name = "subject"
    type = "S"
  }

  attribute {
    name = "gsi1sk"
    type = "S"
  }

  attribute {
    name = "status"
    type = "S"
  }

  attribute {
    name = "gsi2sk"
    type = "S"
  }

  # GSI1: SubjectIndex - for listing by subject (optionally filtered by status)
  # Query: GSI1PK = subject, GSI1SK begins_with status#
  global_secondary_index {
    name            = "SubjectIndex"
    hash_key        = "subject"
    range_key       = "gsi1sk"
    projection_type = "ALL"
  }

  # GSI2: StatusIndex - for listing by status alone
  # Query: GSI2PK = status, GSI2SK begins_with subject#
  global_secondary_index {
    name            = "StatusIndex"
    hash_key        = "status"
    range_key       = "gsi2sk"
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
