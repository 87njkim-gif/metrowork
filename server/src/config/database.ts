import { Pool, PoolConfig } from 'pg'
import dotenv from 'dotenv'

dotenv.config()

// Debug: ?�경변???�인
console.log('?�� Database Config Debug:')
console.log('DB_HOST:', process.env.DB_HOST)
console.log('DB_PORT:', process.env.DB_PORT)
console.log('DB_USER:', process.env.DB_USER)
console.log('DB_NAME:', process.env.DB_NAME)
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '***SET***' : 'NOT SET')

let pool: Pool

const getPool = (): Pool => {
  if (!pool) {
    const dbConfig: PoolConfig = {
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432'),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    }

    pool = new Pool(dbConfig)
  }
  return pool
}

const initializeDatabase = async (): Promise<void> => {
  const pool = getPool()

  try {
    // 사용자 테이블 생성
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

    // 엑셀 파일 테이블 생성
    await pool.query(`
      CREATE TABLE IF NOT EXISTS excel_files (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        original_name VARCHAR(500) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        file_size INTEGER NOT NULL,
        file_type VARCHAR(100),
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

    // 엑셀 컬럼 테이블 생성
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

    // 엑셀 데이터 테이블 생성
    await pool.query(`
      CREATE TABLE IF NOT EXISTS excel_data (
        id SERIAL PRIMARY KEY,
        file_id INTEGER NOT NULL,
        row_index INTEGER NOT NULL,
        data JSONB NOT NULL,
        is_valid BOOLEAN DEFAULT TRUE,
        validation_errors JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // work_status 테이블 생성 (PostgreSQL용)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS work_status (
        id SERIAL PRIMARY KEY,
        excel_data_id INTEGER NOT NULL,
        file_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        is_completed BOOLEAN DEFAULT FALSE,
        completed_at TIMESTAMP,
        completed_by INTEGER,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(excel_data_id, user_id)
      )
    `)

    // work_status 테이블에 필요한 컬럼들이 없으면 추가
    try {
      await pool.query(`
        ALTER TABLE work_status 
        ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT FALSE
      `)
      console.log('✅ is_completed column added to work_status table')
    } catch (error) {
      console.log('⚠️ is_completed column already exists or error occurred:', error.message)
    }

    try {
      await pool.query(`
        ALTER TABLE work_status 
        ADD COLUMN IF NOT EXISTS user_id INTEGER
      `)
      console.log('✅ user_id column added to work_status table')
    } catch (error) {
      console.log('⚠️ user_id column already exists or error occurred:', error.message)
    }

    try {
      await pool.query(`
        ALTER TABLE work_status 
        ADD COLUMN IF NOT EXISTS excel_data_id INTEGER
      `)
      console.log('✅ excel_data_id column added to work_status table')
    } catch (error) {
      console.log('⚠️ excel_data_id column already exists or error occurred:', error.message)
    }

    try {
      await pool.query(`
        ALTER TABLE work_status 
        ADD COLUMN IF NOT EXISTS file_id INTEGER
      `)
      console.log('✅ file_id column added to work_status table')
    } catch (error) {
      console.log('⚠️ file_id column already exists or error occurred:', error.message)
    }

    // excel_files 테이블의 컬럼 길이 확장
    try {
      await pool.query(`
        ALTER TABLE excel_files 
        ALTER COLUMN original_name TYPE VARCHAR(500)
      `)
      console.log('✅ original_name column length extended to 500')
    } catch (error) {
      console.log('⚠️ original_name column length extension failed:', error.message)
    }

    try {
      await pool.query(`
        ALTER TABLE excel_files 
        ALTER COLUMN file_type TYPE VARCHAR(100)
      `)
      console.log('✅ file_type column length extended to 100')
    } catch (error) {
      console.log('⚠️ file_type column length extension failed:', error.message)
    }

    // user_sessions 테이블 생성
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        refresh_token VARCHAR(255) UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // work_history 테이블 생성
    await pool.query(`
      CREATE TABLE IF NOT EXISTS work_history (
        id SERIAL PRIMARY KEY,
        work_status_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        action VARCHAR(20) NOT NULL CHECK (action IN ('created', 'assigned', 'started', 'completed', 'uncompleted', 'updated', 'commented')),
        old_status BOOLEAN,
        new_status BOOLEAN,
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // user_date_settings 테이블 생성
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_date_settings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        today_date DATE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id)
      )
    `)

    console.log('✅ Database tables initialized successfully')
  } catch (error) {
    console.error('❌ Database initialization error:', error)
    throw error
  }
}

const createIndexes = async (): Promise<void> => {
  const pool = getPool()

  try {
    // 사용자 테이블 인덱스
    await pool.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)')
    await pool.query('CREATE INDEX IF NOT EXISTS idx_users_status ON users(status)')
    await pool.query('CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)')

    // 엑셀 파일 테이블 인덱스
    await pool.query('CREATE INDEX IF NOT EXISTS idx_excel_files_uploaded_by ON excel_files(uploaded_by)')
    await pool.query('CREATE INDEX IF NOT EXISTS idx_excel_files_created_at ON excel_files(created_at)')
    await pool.query('CREATE INDEX IF NOT EXISTS idx_excel_files_is_processed ON excel_files(is_processed)')

    // 엑셀 컬럼 테이블 인덱스
    await pool.query('CREATE INDEX IF NOT EXISTS idx_excel_columns_file_id ON excel_columns(file_id)')
    await pool.query('CREATE INDEX IF NOT EXISTS idx_excel_columns_column_index ON excel_columns(column_index)')

    // 엑셀 데이터 테이블 인덱스
    await pool.query('CREATE INDEX IF NOT EXISTS idx_excel_data_file_id ON excel_data(file_id)')
    await pool.query('CREATE INDEX IF NOT EXISTS idx_excel_data_row_index ON excel_data(row_index)')
    await pool.query('CREATE INDEX IF NOT EXISTS idx_excel_data_is_valid ON excel_data(is_valid)')

    // work_status 테이블 인덱스 (안전하게 처리)
    try {
      const tableExistsResult = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'work_status'
        )
      `)
      
      if (tableExistsResult.rows[0].exists) {
        // work_status 테이블 인덱스
        await pool.query('CREATE INDEX IF NOT EXISTS idx_work_status_excel_data_id ON work_status(excel_data_id)')
        await pool.query('CREATE INDEX IF NOT EXISTS idx_work_status_file_id ON work_status(file_id)')
        await pool.query('CREATE INDEX IF NOT EXISTS idx_work_status_user_id ON work_status(user_id)')
        await pool.query('CREATE INDEX IF NOT EXISTS idx_work_status_is_completed ON work_status(is_completed)')
        await pool.query('CREATE INDEX IF NOT EXISTS idx_work_status_completed_at ON work_status(completed_at)')
        console.log('✅ work_status table indexes created')
      } else {
        console.log('⚠️ work_status table does not exist, skipping indexes')
      }
    } catch (workStatusError) {
      console.log('⚠️ work_status table index creation failed, skipping:', workStatusError.message)
    }

    // user_sessions 테이블 인덱스
    await pool.query('CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id)')
    await pool.query('CREATE INDEX IF NOT EXISTS idx_user_sessions_refresh_token ON user_sessions(refresh_token)')
    await pool.query('CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at)')

    // work_history 테이블 인덱스
    await pool.query('CREATE INDEX IF NOT EXISTS idx_work_history_work_status_id ON work_history(work_status_id)')
    await pool.query('CREATE INDEX IF NOT EXISTS idx_work_history_user_id ON work_history(user_id)')
    await pool.query('CREATE INDEX IF NOT EXISTS idx_work_history_action ON work_history(action)')
    await pool.query('CREATE INDEX IF NOT EXISTS idx_work_history_created_at ON work_history(created_at)')

    console.log('✅ Database indexes created successfully')
  } catch (error) {
    console.error('❌ Database index creation error:', error)
    throw error
  }
}

const insertInitialData = async (): Promise<void> => {
  const pool = getPool()

  try {
    // 관리자 계정이 있는지 확인
    const adminResult = await pool.query('SELECT id FROM users WHERE name = $1', ['시스템 관리자'])
    
    if (adminResult.rows.length === 0) {
      // 관리자 계정 생성
      const bcrypt = require('bcrypt')
      const hashedPassword = await bcrypt.hash('ADMIN123', 10)
      
      await pool.query(`
        INSERT INTO users (email, password, name, role, status, department, position, approved_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        'admin@metrowork.com',
        hashedPassword,
        '시스템 관리자',
        'admin',
        'approved',
        'IT팀',
        '시스템 관리자',
        new Date()
      ])
      
      console.log('✅ Initial admin user created successfully')
    } else {
      console.log('✅ Admin user already exists')
    }
  } catch (error) {
    console.error('❌ Initial data insertion error:', error)
    throw error
  }
}

export { getPool, initializeDatabase, createIndexes, insertInitialData } 
