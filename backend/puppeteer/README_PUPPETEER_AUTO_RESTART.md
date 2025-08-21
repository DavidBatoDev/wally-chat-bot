# Puppeteer Auto-Restart Service

This document describes the enhanced Puppeteer service with automatic browser restart capabilities to handle connection issues and ensure reliable OCR capture operations.

## 🚀 Features

### Automatic Browser Restart

- **Health Monitoring**: Continuous browser health checks every 30 seconds
- **Auto-Restart**: Automatically restarts browser when connection issues are detected
- **Retry Logic**: Retries operations after browser restart
- **Maximum Restarts**: Configurable limit to prevent infinite restart loops

### Enhanced Error Handling

- **Connection Error Detection**: Automatically detects "Connection closed" and "Protocol error" issues
- **Graceful Degradation**: Handles errors gracefully without crashing the service
- **Comprehensive Logging**: Detailed logging for debugging and monitoring

### Manual Control

- **Health Check Endpoint**: `/health` - Check browser status and health
- **Manual Restart Endpoint**: `/restart-browser` - Manually restart browser if needed
- **Debug Endpoints**: Monitor service status in real-time

## 🔧 Configuration

### Environment Variables

```bash
# Port for the OCR capture service
OCR_CAPTURE_PORT=3001

# Node environment
NODE_ENV=development
```

### Browser Launch Arguments

The service uses optimized Chrome launch arguments for stability:

- `--no-sandbox`: Disables sandbox for containerized environments
- `--disable-dev-shm-usage`: Prevents shared memory issues
- `--disable-gpu`: Disables GPU acceleration for stability
- `--disable-extensions`: Disables extensions for cleaner operation
- `--disable-web-security`: Allows capture of various content types

### Restart Limits

```javascript
const MAX_BROWSER_RESTARTS = 5; // Maximum restart attempts
const BROWSER_RESTART_DELAY = 2000; // Delay between restarts (2 seconds)
const HEALTH_CHECK_INTERVAL = 30000; // Health check frequency (30 seconds)
```

## 📡 API Endpoints

### Health Check

```http
GET /health
```

**Response:**

```json
{
  "status": "healthy",
  "timestamp": "2025-08-21T19:35:18.829Z",
  "browser": "initialized",
  "browserHealth": {
    "isConnected": true,
    "processRunning": "running",
    "restartCount": 0,
    "maxRestarts": 5
  }
}
```

### Manual Browser Restart

```http
POST /restart-browser
```

**Response:**

```json
{
  "success": true,
  "message": "Browser restarted successfully",
  "timestamp": "2025-08-21T19:35:18.829Z",
  "restartCount": 1
}
```

### OCR Capture

```http
POST /capture-and-ocr
```

**Features:**

- Automatic browser health check before capture
- Retry logic for page operations
- Connection error detection and recovery
- Automatic browser restart on connection issues

## 🔍 Monitoring and Debugging

### Real-time Monitoring

```bash
# Check service health
curl http://localhost:3001/health

# Monitor debug info
curl http://localhost:3001/debug

# Check service status
curl http://localhost:3001/status
```

### Log Analysis

The service provides comprehensive logging with timestamps:

```
🔍 [2025-08-21T19:35:18.829Z] Browser health check passed - Browser is healthy
⚠️ [2025-08-21T19:35:18.829Z] Periodic health check failed, restarting browser...
🔄 [2025-08-21T19:35:18.829Z] Restarting Puppeteer browser (attempt 1/5)...
✅ Browser restarted successfully
```

### Common Log Patterns

- **Browser Health**: `🔍` - Health checks and status
- **Warnings**: `⚠️` - Issues that trigger restarts
- **Restarts**: `🔄` - Browser restart operations
- **Success**: `✅` - Successful operations
- **Errors**: `💥` - Fatal errors
- **Info**: `ℹ️` - General information

## 🚨 Troubleshooting

### Connection Issues

If you see "Connection closed" or "Protocol error":

1. **Automatic Recovery**: The service will automatically restart the browser
2. **Manual Restart**: Use the `/restart-browser` endpoint if needed
3. **Check Logs**: Monitor logs for restart attempts and success

### Browser Crashes

If the browser crashes repeatedly:

1. **Check System Resources**: Ensure sufficient memory and CPU
2. **Review Launch Arguments**: Some arguments may need adjustment for your environment
3. **Monitor Restart Count**: Service will exit after 5 failed restart attempts

### Performance Issues

For better performance:

1. **Adjust Health Check Interval**: Modify `HEALTH_CHECK_INTERVAL` if needed
2. **Optimize Launch Arguments**: Remove unnecessary Chrome flags
3. **Monitor Memory Usage**: Check if browser is consuming excessive memory

## 🔄 How Auto-Restart Works

### 1. Health Monitoring

- Service checks browser health every 30 seconds
- Tests browser connectivity and responsiveness
- Logs health status periodically

### 2. Error Detection

- Monitors for connection errors during operations
- Detects "Connection closed" and "Protocol error" messages
- Identifies when browser becomes unresponsive

### 3. Automatic Recovery

- Closes existing browser instance gracefully
- Waits 2 seconds before restarting
- Launches new browser with optimized settings
- Retries failed operations automatically

### 4. Retry Logic

- Page creation failures trigger browser restart
- Navigation and viewport operations are retried
- Capture operations continue after recovery

## 📊 Performance Metrics

### Browser Health

- **Uptime**: How long browser has been running
- **Restart Count**: Number of restarts in current session
- **Connection Status**: Whether browser is responsive
- **Process Status**: Whether browser process is running

### Capture Performance

- **Success Rate**: Percentage of successful captures
- **Error Recovery**: How often errors are automatically resolved
- **Restart Frequency**: How often browser needs restarting

## 🛠️ Development and Testing

### Local Development

```bash
cd client/backend/puppeteer
npm install
npm start
```

### Testing Auto-Restart

1. Start the service
2. Monitor logs for health checks
3. Simulate connection issues (kill browser process)
4. Observe automatic recovery

### Customization

Modify these functions for custom behavior:

- `isBrowserHealthy()`: Custom health check logic
- `restartBrowser()`: Custom restart behavior
- `ensureBrowserHealth()`: Custom health enforcement

## 🔒 Security Considerations

- **Sandbox Disabled**: `--no-sandbox` is used for containerized environments
- **Web Security Disabled**: `--disable-web-security` allows capture of various content
- **Extension Disabled**: Extensions are disabled for stability
- **Network Isolation**: Background networking is disabled

## 📝 Best Practices

1. **Monitor Logs**: Regularly check service logs for issues
2. **Health Checks**: Use health endpoints for monitoring
3. **Resource Management**: Ensure adequate system resources
4. **Error Handling**: Let automatic recovery handle transient issues
5. **Manual Intervention**: Use manual restart only when necessary

## 🆘 Support

For issues or questions:

1. Check the logs for error details
2. Monitor browser health endpoints
3. Review restart patterns and frequency
4. Check system resource usage
5. Verify Chrome/Chromium compatibility

---

**Note**: This service is designed to be self-healing and should require minimal manual intervention. Most connection issues will be automatically resolved through the restart mechanism.
