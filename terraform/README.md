# Terraform Infrastructure

Deploys the Item Challenge API to AWS:

- **Lambda** (Node.js 20) - Hono app
- **API Gateway** (HTTP API) - Public endpoint
- **DynamoDB** - Item storage
- **CloudWatch** - Logs with configurable retention

## Prerequisites

- AWS CLI configured (`aws configure`)
- Terraform >= 1.0
- pnpm

## Deploy

```bash
# 1. Install dependencies
pnpm install

# 2. Build Lambda bundle
pnpm build:lambda

# 3. Deploy infrastructure
cd terraform
terraform init
terraform plan
terraform apply
```

## Outputs

After deploy, Terraform outputs:

- `api_url` - Your API endpoint (e.g., `https://abc123.execute-api.us-east-1.amazonaws.com`)
- `lambda_function_name` - For logs/debugging
- `dynamodb_table_name` - For data inspection

## Test

```bash
# Get the API URL
API_URL=$(terraform output -raw api_url)

# Test health endpoint
curl $API_URL/health

# Test get item (will 404 without data)
curl $API_URL/api/items/550e8400-e29b-41d4-a716-446655440000
```

## Variables

| Variable             | Default     | Description              |
| -------------------- | ----------- | ------------------------ |
| `aws_region`         | `us-east-1` | AWS region               |
| `environment`        | `dev`       | Environment name         |
| `lambda_memory_size` | `256`       | Lambda memory (MB)       |
| `lambda_timeout`     | `30`        | Lambda timeout (seconds) |
| `log_retention_days` | `14`        | Log retention            |

Override with:

```bash
terraform apply -var="environment=prod" -var="lambda_memory_size=512"
```

## Destroy

```bash
terraform destroy
```
