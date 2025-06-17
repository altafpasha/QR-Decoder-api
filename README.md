# NestJS QR Code API Server

A production-ready NestJS API server for decoding QR codes from uploaded image files.

## Features

- **QR Code Decoding**: Server-side QR code decoding using @zxing/library and jimp
- **Authentication**: Bearer token authentication for secure access
- **File Upload**: Multipart form data support with file validation
- **Logging**: Comprehensive logging for uploads, processing, and errors
- **Docker Support**: Containerized deployment with Docker Compose
- **Health Checks**: Built-in health endpoint for monitoring
- **Environment Configuration**: Flexible configuration via environment variables

## Quick Start

### Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start development server:**
   ```bash
   npm run start:dev
   ```

4. **Test the API:**
   ```bash
   # Health check
   curl http://localhost:3004/health
   
   # QR decode (replace with your token and image file)
   curl -X POST http://localhost:3004/qr/decode \
     -H "Authorization: Bearer your-secret-bearer-token-here" \
     -F "file=@./sample-qr.png"
   ```

### Docker Deployment

1. **Build and run with Docker Compose:**
   ```bash
   docker-compose up --build
   ```

2. **Or build manually:**
   ```bash
   docker build -t nestjs-qr-api .
   docker run -p 3004:3004 -e AUTH_TOKEN=your-token nestjs-qr-api
   ```

## API Endpoints

### POST /qr/decode

Decode QR code from uploaded image file.

**Headers:**
- `Authorization: Bearer <token>` (required)
- `Content-Type: multipart/form-data`

**Body:**
- `file`: Image file (PNG, JPG, JPEG, GIF, BMP, WebP)

**Response:**
```json
{
  "success": true,
  "text": "Decoded QR code content",
  "metadata": {
    "filename": "qr-code.png",
    "size": 12345,
    "mimetype": "image/png"
  }
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.456,
  "memory": {...},
  "version": "v18.17.0",
  "environment": "production"
}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3004` | Server port |
| `NODE_ENV` | `development` | Environment mode |
| `AUTH_TOKEN` | `your-secret-bearer-token-here` | Bearer authentication token |
| `MAX_FILE_SIZE` | `10485760` | Maximum file size in bytes (10MB) |

## Development

### Available Scripts

- `npm run start` - Start production server
- `npm run start:dev` - Start development server with hot reload
- `npm run start:debug` - Start server in debug mode
- `npm run build` - Build for production
- `npm run test` - Run tests
- `npm run lint` - Lint code

### Project Structure

```
src/
├── app.module.ts           # Main application module
├── main.ts                 # Application entry point
├── config/
│   └── configuration.ts    # Environment configuration
├── auth/
│   └── auth.guard.ts      # Bearer token authentication
├── qr/
│   ├── qr.module.ts       # QR processing module
│   ├── qr.controller.ts   # QR endpoints
│   └── qr.service.ts      # QR decoding logic
└── health/
    ├── health.module.ts   # Health check module
    └── health.controller.ts # Health endpoint
```

## Production Considerations

- **Security**: Change the default `AUTH_TOKEN` in production
- **File Limits**: Adjust `MAX_FILE_SIZE` based on your needs
- **Logging**: Configure appropriate log levels for production
- **Monitoring**: Use the `/health` endpoint for health checks
- **Scaling**: Consider load balancing for high-traffic scenarios

## Troubleshooting

### Common Issues

1. **"No QR code found"**: Ensure the image contains a clear, readable QR code
2. **"Invalid bearer token"**: Check that the Authorization header is correctly formatted
3. **File too large**: Verify the file size is within the configured limits
4. **Image format not supported**: Only common image formats are supported

### Debugging

Enable debug logging by setting the log level:
```typescript
// In main.ts, enable debug logging
app.useLogger(['log', 'error', 'warn', 'debug', 'verbose']);
```

## License

This project is licensed under the MIT License.