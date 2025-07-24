import mysql from 'mysql2/promise'
import dotenv from 'dotenv'

dotenv.config()

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'metrowork_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true,
}

// Create connection pool
const pool = mysql.createPool(dbConfig)

// Test database connection
export const connectDB = async (): Promise<void> => {
  try {
    const connection = await pool.getConnection()
    console.log('✅ MySQL Database connected successfully')
    connection.release()
    
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
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(100) NOT NULL,
        role ENUM('admin', 'user') DEFAULT 'user' COMMENT '사용자 역할',
        status ENUM('pending', 'approved', 'rejected', 'inactive') DEFAULT 'pending' COMMENT '승인 상태',
        phone VARCHAR(20),
        department VARCHAR(100) COMMENT '부서',
        position VARCHAR(100) COMMENT '직책',
        profile_image VARCHAR(500) COMMENT '프로필 이미지 URL',
        last_login_at TIMESTAMP NULL COMMENT '마지막 로그인 시간',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        approved_at TIMESTAMP NULL COMMENT '승인 시간',
        approved_by INT NULL COMMENT '승인자 ID',
        rejected_at TIMESTAMP NULL COMMENT '거부 시간',
        rejected_by INT NULL COMMENT '거부자 ID',
        rejection_reason TEXT COMMENT '거부 사유',
        
        INDEX idx_email (email),
        INDEX idx_status (status),
        INDEX idx_role (role),
        INDEX idx_department (department),
        INDEX idx_created_at (created_at),
        
        FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (rejected_by) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='사용자 관리 테이블'
    `)

    // Excel files table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS excel_files (
        id INT AUTO_INCREMENT PRIMARY KEY,
        filename VARCHAR(255) NOT NULL COMMENT '저장된 파일명',
        original_name VARCHAR(255) NOT NULL COMMENT '원본 파일명',
        file_path VARCHAR(500) NOT NULL COMMENT '파일 경로',
        file_size INT NOT NULL COMMENT '파일 크기 (bytes)',
        file_type VARCHAR(50) COMMENT '파일 타입',
        sheet_name VARCHAR(100) COMMENT '시트명',
        total_rows INT DEFAULT 0 COMMENT '총 행 수',
        total_columns INT DEFAULT 0 COMMENT '총 열 수',
        uploaded_by INT NOT NULL COMMENT '업로드한 사용자 ID',
        description TEXT COMMENT '파일 설명',
        tags JSON COMMENT '태그 정보',
        is_processed BOOLEAN DEFAULT FALSE COMMENT '처리 완료 여부',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        INDEX idx_uploaded_by (uploaded_by),
        INDEX idx_created_at (created_at),
        INDEX idx_is_processed (is_processed),
        
        FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='엑셀 파일 메타데이터 테이블'
    `)

    // Excel columns table (동적 컬럼 지원)
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS excel_columns (
        id INT AUTO_INCREMENT PRIMARY KEY,
        file_id INT NOT NULL COMMENT '엑셀 파일 ID',
        column_index INT NOT NULL COMMENT '컬럼 순서 (0부터 시작)',
        column_name VARCHAR(100) NOT NULL COMMENT '컬럼명',
        column_type ENUM('string', 'number', 'date', 'boolean', 'json') DEFAULT 'string' COMMENT '데이터 타입',
        is_required BOOLEAN DEFAULT FALSE COMMENT '필수 여부',
        is_searchable BOOLEAN DEFAULT TRUE COMMENT '검색 가능 여부',
        is_sortable BOOLEAN DEFAULT TRUE COMMENT '정렬 가능 여부',
        display_name VARCHAR(100) COMMENT '표시명',
        description TEXT COMMENT '컬럼 설명',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        INDEX idx_file_id (file_id),
        INDEX idx_column_index (column_index),
        INDEX idx_column_name (column_name),
        UNIQUE KEY unique_file_column (file_id, column_index),
        
        FOREIGN KEY (file_id) REFERENCES excel_files(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='엑셀 컬럼 정의 테이블'
    `)

    // Excel data table (동적 컬럼 지원)
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS excel_data (
        id INT AUTO_INCREMENT PRIMARY KEY,
        file_id INT NOT NULL COMMENT '엑셀 파일 ID',
        row_index INT NOT NULL COMMENT '행 번호 (0부터 시작)',
        row_data JSON NOT NULL COMMENT '행 데이터 (컬럼명:값 형태)',
        is_valid BOOLEAN DEFAULT TRUE COMMENT '데이터 유효성',
        validation_errors JSON COMMENT '유효성 검사 오류',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        INDEX idx_file_id (file_id),
        INDEX idx_row_index (row_index),
        INDEX idx_is_valid (is_valid),
        UNIQUE KEY unique_file_row (file_id, row_index),
        
        FOREIGN KEY (file_id) REFERENCES excel_files(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='엑셀 데이터 테이블'
    `)

    // Work status table (업무 처리 상태)
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS work_status (
        id INT AUTO_INCREMENT PRIMARY KEY,
        data_id INT NOT NULL COMMENT '엑셀 데이터 ID',
        assigned_to INT NOT NULL COMMENT '담당자 ID',
        status ENUM('pending', 'in_progress', 'completed', 'cancelled', 'on_hold') DEFAULT 'pending' COMMENT '처리 상태',
        priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium' COMMENT '우선순위',
        due_date DATE COMMENT '마감일',
        started_at TIMESTAMP NULL COMMENT '작업 시작 시간',
        completed_at TIMESTAMP NULL COMMENT '작업 완료 시간',
        cancelled_at TIMESTAMP NULL COMMENT '작업 취소 시간',
        cancelled_by INT NULL COMMENT '취소한 사용자 ID',
        cancel_reason TEXT COMMENT '취소 사유',
        notes TEXT COMMENT '작업 노트',
        processing_time INT COMMENT '처리 시간 (분)',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        INDEX idx_data_id (data_id),
        INDEX idx_assigned_to (assigned_to),
        INDEX idx_status (status),
        INDEX idx_priority (priority),
        INDEX idx_due_date (due_date),
        INDEX idx_started_at (started_at),
        INDEX idx_completed_at (completed_at),
        UNIQUE KEY unique_data_assignment (data_id, assigned_to),
        
        FOREIGN KEY (data_id) REFERENCES excel_data(id) ON DELETE CASCADE,
        FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (cancelled_by) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='업무 처리 상태 테이블'
    `)

    // User date settings table (사용자별 날짜 설정)
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS user_date_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL COMMENT '사용자 ID',
        custom_date DATE NOT NULL COMMENT '사용자 설정 날짜',
        is_active BOOLEAN DEFAULT TRUE COMMENT '활성화 여부',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        INDEX idx_user_id (user_id),
        INDEX idx_custom_date (custom_date),
        INDEX idx_is_active (is_active),
        UNIQUE KEY unique_user_date (user_id, custom_date),
        
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='사용자별 날짜 설정 테이블'
    `)

    // Work history table (작업 히스토리)
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS work_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        work_status_id INT NOT NULL COMMENT '업무 상태 ID',
        user_id INT NOT NULL COMMENT '작업한 사용자 ID',
        action ENUM('created', 'assigned', 'started', 'completed', 'cancelled', 'updated', 'commented') NOT NULL COMMENT '작업 액션',
        old_status ENUM('pending', 'in_progress', 'completed', 'cancelled', 'on_hold') NULL COMMENT '이전 상태',
        new_status ENUM('pending', 'in_progress', 'completed', 'cancelled', 'on_hold') NULL COMMENT '새로운 상태',
        old_priority ENUM('low', 'medium', 'high', 'urgent') NULL COMMENT '이전 우선순위',
        new_priority ENUM('low', 'medium', 'high', 'urgent') NULL COMMENT '새로운 우선순위',
        old_due_date DATE NULL COMMENT '이전 마감일',
        new_due_date DATE NULL COMMENT '새로운 마감일',
        comment TEXT COMMENT '작업 코멘트',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        INDEX idx_work_status_id (work_status_id),
        INDEX idx_user_id (user_id),
        INDEX idx_action (action),
        INDEX idx_created_at (created_at),
        
        FOREIGN KEY (work_status_id) REFERENCES work_status(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='작업 히스토리 테이블'
    `)

    // User sessions table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL COMMENT '사용자 ID',
        token VARCHAR(500) NOT NULL COMMENT 'JWT 토큰',
        refresh_token VARCHAR(500) COMMENT '리프레시 토큰',
        device_info JSON COMMENT '디바이스 정보',
        ip_address VARCHAR(45) COMMENT 'IP 주소',
        user_agent TEXT COMMENT '사용자 에이전트',
        expires_at TIMESTAMP NOT NULL COMMENT '만료 시간',
        is_active BOOLEAN DEFAULT TRUE COMMENT '활성화 여부',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        INDEX idx_user_id (user_id),
        INDEX idx_token (token(255)),
        INDEX idx_refresh_token (refresh_token(255)),
        INDEX idx_expires_at (expires_at),
        INDEX idx_is_active (is_active),
        
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='사용자 세션 테이블'
    `)

    // Create views
    await createViews()

    // Create additional indexes for performance
    await createIndexes()

    // Insert initial admin user
    await insertInitialData()

    console.log('✅ Database tables initialized successfully')
  } catch (error) {
    console.error('❌ Failed to initialize database tables:', error)
    throw error
  }
}

// Create views for common queries
const createViews = async (): Promise<void> => {
  try {
    // User work summary view
    await pool.execute(`
      CREATE OR REPLACE VIEW user_work_summary AS
      SELECT 
          u.id as user_id,
          u.name as user_name,
          u.department,
          u.position,
          COUNT(CASE WHEN ws.is_completed = FALSE THEN 1 END) as pending_count,
          COUNT(CASE WHEN ws.is_completed = TRUE THEN 1 END) as completed_count,
          COUNT(CASE WHEN ws.completed_at IS NOT NULL THEN 1 END) as total_completed_count
      FROM users u
      LEFT JOIN work_status ws ON u.id = ws.user_id
      WHERE u.status = 'approved'
      GROUP BY u.id, u.name, u.department, u.position
    `)

    // Excel file summary view
    await pool.execute(`
      CREATE OR REPLACE VIEW excel_file_summary AS
      SELECT 
          ef.id as file_id,
          ef.original_name,
          ef.filename,
          ef.total_rows,
          ef.total_columns,
          ef.uploaded_by,
          u.name as uploaded_by_name,
          COUNT(ed.id) as data_count,
          COUNT(CASE WHEN ed.is_valid = TRUE THEN 1 END) as valid_data_count,
          COUNT(CASE WHEN ed.is_valid = FALSE THEN 1 END) as invalid_data_count,
          COUNT(ws.id) as assigned_work_count,
          COUNT(CASE WHEN ws.is_completed = TRUE THEN 1 END) as completed_work_count,
          ef.created_at
      FROM excel_files ef
      LEFT JOIN users u ON ef.uploaded_by = u.id
      LEFT JOIN excel_data ed ON ef.id = ed.file_id
      LEFT JOIN work_status ws ON ed.id = ws.excel_data_id
      GROUP BY ef.id, ef.original_name, ef.filename, ef.total_rows, ef.total_columns, ef.uploaded_by, u.name, ef.created_at
    `)

    // Today work view
    await pool.execute(`
      CREATE OR REPLACE VIEW today_work AS
      SELECT 
          ws.id as work_id,
          ws.excel_data_id,
          ws.user_id,
          u.name as user_name,
          u.department,
          ws.is_completed,
          ws.completed_at,
          COALESCE(uds.custom_date, CURDATE()) as work_date,
          ed.row_data,
          ef.original_name as file_name,
          ef.id as file_id
      FROM work_status ws
      JOIN users u ON ws.user_id = u.id
      JOIN excel_data ed ON ws.excel_data_id = ed.id
      JOIN excel_files ef ON ed.file_id = ef.id
      LEFT JOIN user_date_settings uds ON ws.user_id = uds.user_id AND uds.is_active = TRUE
      WHERE ws.is_completed = FALSE
      AND DATE(ws.created_at) = COALESCE(uds.custom_date, CURDATE())
    `)

    console.log('✅ Database views created successfully')
  } catch (error) {
    console.error('❌ Failed to create views:', error)
    throw error
  }
}

// Create additional indexes for performance
const createIndexes = async (): Promise<void> => {
  try {
    await pool.execute('CREATE INDEX IF NOT EXISTS idx_work_status_user_completed ON work_status(user_id, is_completed)')
    await pool.execute('CREATE INDEX IF NOT EXISTS idx_work_status_excel_completed ON work_status(excel_data_id, is_completed)')
    await pool.execute('CREATE INDEX IF NOT EXISTS idx_excel_data_file_valid ON excel_data(file_id, is_valid)')
    await pool.execute('CREATE INDEX IF NOT EXISTS idx_users_status_role ON users(status, role)')
    await pool.execute('CREATE INDEX IF NOT EXISTS idx_work_history_work_user ON work_history(work_status_id, user_id)')
    
    console.log('✅ Additional indexes created successfully')
  } catch (error) {
    console.error('❌ Failed to create indexes:', error)
    throw error
  }
}

// Insert initial data
const insertInitialData = async (): Promise<void> => {
  try {
    // Check if admin user already exists
    const [adminUsers] = await pool.execute('SELECT id FROM users WHERE email = ?', ['admin@metrowork.com'])
    
    if ((adminUsers as any[]).length === 0) {
      // Insert admin user (password: admin123)
      await pool.execute(`
        INSERT INTO users (email, password, name, role, status, department, position, approved_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
      `, ['admin@metrowork.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HS.iK2O', '시스템 관리자', 'admin', 'approved', 'IT', '시스템 관리자'])
      
      // Set approved_by to self
      await pool.execute('UPDATE users SET approved_by = id WHERE email = ?', ['admin@metrowork.com'])
      
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