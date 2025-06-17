export default () => ({
  port: parseInt(process.env.PORT, 10) || 3004,
  nodeEnv: process.env.NODE_ENV || 'development',
  authToken: process.env.AUTH_TOKEN || 'your-secret-bearer-token-here',
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 10485760, // 10MB
});