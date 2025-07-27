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
// import checklistRoutes from './routes/checklist' // ??��

// Middleware
// import { notFound } from './middleware/notFound' // ??��

// Database
import { getPool, initializeDatabase, createIndexes, insertInitialData } from './config/database'
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

// CORS ?�정
app.use(cors({
  origin: function (origin, callback) {
    // 개발 환경에서는 모든 origin 허용
    if (process.env.NODE_ENV === 'development') {
      callback(null, true);
      return;
    }
    
    const allowedOrigins = [
      process.env.CLIENT_URL || 'http://localhost:3000',
      'https://metrowork-1.onrender.com',
      'https://metrowork.onrender.com',
      'https://metrowork-1.onrender.com/',
      'https://metrowork.onrender.com/',
      // 모바일 접속을 위한 추가 설정
      /^https:\/\/.*\.onrender\.com$/,
      /^http:\/\/localhost:\d+$/,
      /^http:\/\/192\.168\.\d+\.\d+:\d+$/, // 로컬 네트워크
      /^http:\/\/10\.\d+\.\d+\.\d+:\d+$/, // 로컬 네트워크
      /^http:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+:\d+$/ // 로컬 네트워크
    ];
    
    // origin이 없거나 허용된 origin인 경우
    if (!origin || allowedOrigins.some(allowed => 
      typeof allowed === 'string' ? allowed === origin : allowed.test(origin)
    )) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Pragma', 'Expires', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'Content-Range']
}))

// OPTIONS 요청 처리
app.options('*', (req, res) => {
  const origin = req.headers.origin
  const allowedOrigins = [
    process.env.CLIENT_URL || 'http://localhost:3000',
    'https://metrowork-1.onrender.com',
    'https://metrowork.onrender.com',
    'https://metrowork-1.onrender.com/',
    'https://metrowork.onrender.com/'
  ]
  
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin)
  } else {
    res.header('Access-Control-Allow-Origin', '*')
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control, Pragma, Expires, X-Requested-With')
  res.header('Access-Control-Allow-Credentials', 'true')
  res.status(200).end()
})

// Trust proxy for rate limiting
app.set('trust proxy', 1)

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10000, // 개발 중에???�넉?�게
  message: '?�무 많�? ?�청??발생?�습?�다. ?�시 ???�시 ?�도?�주?�요.',
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
// app.use('/api/checklist', checklistRoutes) // ??��

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    socketIO: 'enabled',
    cors: 'enabled',
    origin: req.headers.origin || 'unknown'
  })
})

// Root endpoint for testing
app.get('/', (req, res) => {
  res.json({ 
    message: 'MetroWork API Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  })
})

// Start server
const startServer = async () => {
  try {
    // Initialize database
    await initializeDatabase()
    await createIndexes()
    await insertInitialData()
    
    console.log('✅ Database connected successfully')
    
    server.listen(PORT, () => {
      console.log(`?? Server running on port ${PORT}`)
      console.log(`?�� Environment: ${process.env.NODE_ENV || 'development'}`)
      console.log(`?�� API URL: http://localhost:${PORT}/api`)
      console.log(`?�� Socket.IO enabled for real-time features`)
    })
  } catch (error) {
    console.error('??Failed to start server:', error)
    process.exit(1)
  }
}

startServer()

export default app 
