import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import compression from 'compression'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'
import dotenv from 'dotenv'
import path from 'path'
import { createServer } from 'http'
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Routes
import authRoutes from './routes/auth'
import adminRoutes from './routes/admin'
import excelRoutes from './routes/excel'
import searchRoutes from './routes/search'
import workRoutes from './routes/work'
import duplicateRoutes from './routes/duplicate'
import passwordResetRoutes from './routes/passwordReset'
import smsAuthRoutes from './routes/smsAuth'
import workCheckRoutes from './routes/workCheck'
// import checklistRoutes from './routes/checklist' // ?? œ

// Middleware
// import { notFound } from './middleware/notFound' // ?? œ

// Database
import { connectDB } from './config/database'
import { initializeSocketServer } from './socket/socketServer'

// Load environment variables
dotenv.config()

const app = express()
const server = createServer(app)
const PORT = process.env.PORT || 5000

// Initialize Socket.IO server
initializeSocketServer(server)

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
    },
  },
}))

// CORS ?¤ì •
app.use(cors({
  origin: [
    process.env.CLIENT_URL || 'http://localhost:3000',
    'https://metrowork-1.onrender.com',
    'https://metrowork.onrender.com'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Pragma', 'Expires'],
}))

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10000, // ê°œë°œ ì¤‘ì—???‰ë„‰?˜ê²Œ
  message: '?ˆë¬´ ë§Žì? ?”ì²­??ë°œìƒ?ˆìŠµ?ˆë‹¤. ? ì‹œ ???¤ì‹œ ?œë„?´ì£¼?¸ìš”.',
})
app.use('/api/', limiter)

// Body parsing middleware
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))
app.use(cookieParser())

// Compression
app.use(compression())

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'))
} else {
  app.use(morgan('combined'))
}

// Static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')))

// API Routes
app.use('/api/auth', authRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/excel', excelRoutes)
app.use('/api/search', searchRoutes)
app.use('/api/work', workRoutes)
app.use('/api/auth', duplicateRoutes)
app.use('/api/auth', passwordResetRoutes)
app.use('/api/auth', smsAuthRoutes)
app.use('/api/work-check', workCheckRoutes)
// app.use('/api/checklist', checklistRoutes) // ?? œ

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    socketIO: 'enabled'
  })
})

// Start server
const startServer = async () => {
  try {
    // Connect to database
    await connectDB()
    console.log('??Database connected successfully')
    
    server.listen(PORT, () => {
      console.log(`?? Server running on port ${PORT}`)
      console.log(`?“± Environment: ${process.env.NODE_ENV || 'development'}`)
      console.log(`?”— API URL: http://localhost:${PORT}/api`)
      console.log(`?”Œ Socket.IO enabled for real-time features`)
    })
  } catch (error) {
    console.error('??Failed to start server:', error)
    process.exit(1)
  }
}

startServer()

export default app 
