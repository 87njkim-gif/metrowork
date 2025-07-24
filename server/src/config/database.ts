import { Pool } from 'pg'
import dotenv from 'dotenv'

dotenv.config()

// Debug: 환경변수 확인
console.log('🔍 Database Config Debug:')
console.log('DB_HOST:', process.env.DB_HOST)
console.log('DB_PORT:', process.env.DB_PORT)
console.log('DB_USER:', process.env.DB_USER)
console.log('DB_NAME:', process.env.DB_NAME)
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '***SET***' : 'NOT SET')

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'metrowork_db',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
}

console.log('🔍 Final DB Config:', {
  host: dbConfig.host,
  port: dbConfig.port,
  user: dbConfig.user,
  database: dbConfig.database,
  password: dbConfig.password ? '***SET***' : 'NOT SET'
})

// Create connection pool
const pool = new Pool(dbConfig)

// Test database connection
export const connectDB = async (): Promise<void> => {
  try {
    const client = await pool.connect()
    console.log('✅ PostgreSQL Database connected successfully')
    client.release()
    
    // Initialize database tables
    await initializeTables()
  } catch (error) {
    console.error('❌ Database connection failed:', error)
    throw error
  }
}

// Initialize database tables
const initializeTables = async (): Promise<void> => {
  try {
    // Users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(100) NOT NULL,
        role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'user')),
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'inactive')),
        phone VARCHAR(20),
        department VARCHAR(100),
        position VARCHAR(100),
        profile_image VARCHAR(500),
        last_login_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        approved_at TIMESTAMP,
        approved_by INTEGER,
        rejected_at TIMESTAMP,
        rejected_by INTEGER,
        rejection_reason TEXT
      )
    `)

    // Excel files table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS excel_files (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        file_size INTEGER NOT NULL,
        file_type VARCHAR(50),
        sheet_name VARCHAR(100),
        total_rows INTEGER DEFAULT 0,
        total_columns INTEGER DEFAULT 0,
        uploaded_by INTEGER NOT NULL,
        description TEXT,
        tags JSONB,
        is_processed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Excel columns table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS excel_columns (
        id SERIAL PRIMARY KEY,
        file_id INTEGER NOT NULL,
        column_index INTEGER NOT NULL,
        column_name VARCHAR(100) NOT NULL,
        column_type VARCHAR(20) DEFAULT 'string' CHECK (column_type IN ('string', 'number', 'date', 'boolean', 'json')),
        is_required BOOLEAN DEFAULT FALSE,
        is_searchable BOOLEAN DEFAULT TRUE,
        is_sortable BOOLEAN DEFAULT TRUE,
        display_name VARCHAR(100),
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(file_id, column_index)
      )
    `)

    // Excel data table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS excel_data (
        id SERIAL PRIMARY KEY,
        file_id INTEGER NOT NULL,
        row_index INTEGER NOT NULL,
        row_data JSONB NOT NULL,
        is_valid BOOLEAN DEFAULT TRUE,
        validation_errors JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(file_id, row_index)
      )
    `)

    // Work status table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS work_status (
        id SERIAL PRIMARY KEY,
        data_id INTEGER NOT NULL,
        assigned_to INTEGER NOT NULL,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled', 'on_hold')),
        priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
        due_date DATE,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        cancelled_at TIMESTAMP,
        cancelled_by INTEGER,
        cancel_reason TEXT,
        notes TEXT,
        processing_time INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(data_id, assigned_to)
      )
    `)

    // User date settings table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_date_settings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        custom_date DATE NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, custom_date)
      )
    `)

    // Work history table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS work_history (
        id SERIAL PRIMARY KEY,
        work_status_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        action VARCHAR(20) NOT NULL CHECK (action IN ('created', 'assigned', 'started', 'completed', 'cancelled', 'updated', 'commented')),
        old_status VARCHAR(20),
        new_status VARCHAR(20),
        old_priority VARCHAR(20),
        new_priority VARCHAR(20),
        old_due_date DATE,
        new_due_date DATE,
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // User sessions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        token VARCHAR(500) NOT NULL,
        refresh_token VARCHAR(500),
        device_info JSONB,
        ip_address VARCHAR(45),
        user_agent TEXT,
        expires_at TIMESTAMP NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Create indexes
    await createIndexes()

    // Insert initial admin user
    await insertInitialData()

    console.log('✅ Database tables initialized successfully')
  } catch (error) {
    console.error('❌ Failed to initialize database tables:', error)
    throw error
  }
}

// Create indexes for performance
const createIndexes = async (): Promise<void> => {
  try {
    await pool.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)')
    await pool.query('CREATE INDEX IF NOT EXISTS idx_users_status ON users(status)')
    await pool.query('CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)')
    await pool.query('CREATE INDEX IF NOT EXISTS idx_excel_files_uploaded_by ON excel_files(uploaded_by)')
    await pool.query('CREATE INDEX IF NOT EXISTS idx_excel_data_file_id ON excel_data(file_id)')
    await pool.query('CREATE INDEX IF NOT EXISTS idx_work_status_assigned_to ON work_status(assigned_to)')
    await pool.query('CREATE INDEX IF NOT EXISTS idx_work_status_status ON work_status(status)')
    await pool.query('CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id)')
    await pool.query('CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(token)')
    
    console.log('✅ Database indexes created successfully')
  } catch (error) {
    console.error('❌ Failed to create indexes:', error)
    throw error
  }
}

// Insert initial data
const insertInitialData = async (): Promise<void> => {
  try {
    // Check if admin user already exists
    const adminResult = await pool.query('SELECT id FROM users WHERE email = $1', ['admin@metrowork.com'])
    
    if (adminResult.rows.length === 0) {
      // Insert admin user (password: admin123)
      await pool.query(`
        INSERT INTO users (email, password, name, role, status, department, position, approved_at) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, ['admin@metrowork.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HS.iK2O', '시스템 관리자', 'admin', 'approved', 'IT', '시스템 관리자'])
      
      // Set approved_by to self
      await pool.query('UPDATE users SET approved_by = id WHERE email = $1', ['admin@metrowork.com'])
      
      console.log('✅ Initial admin user created successfully')
    }
  } catch (error) {
    console.error('❌ Failed to insert initial data:', error)
    throw error
  }
}

// Get database pool
export const getPool = () => pool

// Close database connection
export const closeDB = async (): Promise<void> => {
  try {
    await pool.end()
    console.log('✅ Database connection closed')
  } catch (error) {
    console.error('❌ Error closing database connection:', error)
    throw error
  }
}

export default pool 