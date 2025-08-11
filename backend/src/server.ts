import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import { config } from './config/config'
import { logger } from './utils/logger'
import { errorHandler } from './middleware/errorHandler'
import { authRoutes } from './routes/auth.routes'
import { dashboardRoutes } from './routes/dashboard.routes'
import { thinClientRoutes } from './routes/thin-client.routes'

const app = express()

// Security middleware
app.use(helmet())
app.use(compression())

// CORS configuration
app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMaxRequests,
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false
})
app.use('/api/', limiter)

// Body parsing middleware
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.nodeEnv
  })
})

// API routes
app.use('/api/auth', authRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/thin-client', thinClientRoutes)

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found',
    path: req.originalUrl
  })
})

// Error handling middleware
app.use(errorHandler)

// Start server
const server = app.listen(config.port, '0.0.0.0', () => {
  logger.info(`Server running on port ${config.port} in ${config.nodeEnv} mode`)
  logger.info(`Health check available at http://localhost:${config.port}/health`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...')
  server.close(() => {
    logger.info('Server closed')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down gracefully...')
  server.close(() => {
    logger.info('Server closed')
    process.exit(0)
  })
})

export default app