# Hos3Green Backend API

Production-grade Node.js backend for the Hos3Green Android device integrity verification system.

## Features

- Google Play Integrity API integration
- Server-side token verification
- HMAC-signed responses
- Rate limiting
- Stateless architecture
- Privacy-focused (no data storage)

## Prerequisites

- Node.js 18+ 
- Google Cloud project with Play Integrity API enabled
- Service account with Play Integrity API permissions

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Place your Google service account key file at the path specified in `.env`

4. Start the server:
```bash
npm start
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` | Path to service account JSON | Yes |
| `GOOGLE_CLOUD_PROJECT_NUMBER` | Google Cloud project number | Yes |
| `PORT` | Server port (default: 3000) | No |
| `NODE_ENV` | Environment (production/development) | No |
| `JWT_SECRET` | Secret for JWT signing | Yes |
| `RESPONSE_SIGNING_KEY` | Key for HMAC response signing | Yes |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window in ms | No |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | No |
| `ALLOWED_PACKAGE_NAMES` | Comma-separated package names | Yes |

## API Endpoints

See [API_CONTRACT.md](API_CONTRACT.md) for detailed API documentation.

### POST /api/integrity/verify
Verify a Play Integrity token.

### GET /api/integrity/levels
Get integrity level descriptions.

### GET /health
Health check endpoint.

## Security

See [SECURITY_RATIONALE.md](SECURITY_RATIONALE.md) for detailed security documentation.

## Deployment

### Using Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### Environment Setup

1. Set up HTTPS (required for production)
2. Configure firewall rules
3. Set up monitoring and logging
4. Configure certificate pinning hashes for client

## License

MIT# hos3green
# hos3green
# hos3green
