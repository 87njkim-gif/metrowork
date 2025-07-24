-- MetroWork Database Schema
-- 모바일 웹앱을 위한 데이터베이스 스키마

-- 데이터베이스 생성
CREATE DATABASE IF NOT EXISTS metrowork_db 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE metrowork_db;

-- 1. 사용자 관리 테이블
CREATE TABLE users (
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
    
    -- 인덱스
    INDEX idx_email (email),
    INDEX idx_status (status),
    INDEX idx_role (role),
    INDEX idx_department (department),
    INDEX idx_created_at (created_at),
    
    -- 외래키 (자체 참조)
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (rejected_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='사용자 관리 테이블';

-- 2. 엑셀 파일 메타데이터 테이블
CREATE TABLE excel_files (
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
    
    -- 인덱스
    INDEX idx_uploaded_by (uploaded_by),
    INDEX idx_created_at (created_at),
    INDEX idx_is_processed (is_processed),
    
    -- 외래키
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='엑셀 파일 메타데이터 테이블';

-- 3. 엑셀 컬럼 정의 테이블 (동적 컬럼 지원)
CREATE TABLE excel_columns (
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
    
    -- 인덱스
    INDEX idx_file_id (file_id),
    INDEX idx_column_index (column_index),
    INDEX idx_column_name (column_name),
    UNIQUE KEY unique_file_column (file_id, column_index),
    
    -- 외래키
    FOREIGN KEY (file_id) REFERENCES excel_files(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='엑셀 컬럼 정의 테이블';

-- 4. 엑셀 데이터 테이블 (동적 컬럼 지원)
CREATE TABLE excel_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    file_id INT NOT NULL COMMENT '엑셀 파일 ID',
    row_index INT NOT NULL COMMENT '행 번호 (0부터 시작)',
    row_data JSON NOT NULL COMMENT '행 데이터 (컬럼명:값 형태)',
    is_valid BOOLEAN DEFAULT TRUE COMMENT '데이터 유효성',
    validation_errors JSON COMMENT '유효성 검사 오류',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- 인덱스
    INDEX idx_file_id (file_id),
    INDEX idx_row_index (row_index),
    INDEX idx_is_valid (is_valid),
    UNIQUE KEY unique_file_row (file_id, row_index),
    
    -- 외래키
    FOREIGN KEY (file_id) REFERENCES excel_files(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='엑셀 데이터 테이블';

-- 5. 업무 처리 상태 테이블
CREATE TABLE work_status (
    id INT AUTO_INCREMENT PRIMARY KEY,
    excel_data_id INT NOT NULL COMMENT '엑셀 데이터 ID',
    file_id INT NOT NULL COMMENT '엑셀 파일 ID',
    user_id INT NOT NULL COMMENT '사용자 ID',
    is_completed BOOLEAN DEFAULT FALSE COMMENT '완료 여부',
    completed_at TIMESTAMP NULL COMMENT '완료 시간',
    completed_by INT NULL COMMENT '완료한 사용자 ID',
    notes TEXT COMMENT '작업 노트',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- 인덱스
    INDEX idx_excel_data_id (excel_data_id),
    INDEX idx_file_id (file_id),
    INDEX idx_user_id (user_id),
    INDEX idx_is_completed (is_completed),
    INDEX idx_completed_at (completed_at),
    UNIQUE KEY unique_excel_user (excel_data_id, user_id),
    
    -- 외래키
    FOREIGN KEY (excel_data_id) REFERENCES excel_data(id) ON DELETE CASCADE,
    FOREIGN KEY (file_id) REFERENCES excel_files(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (completed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='업무 처리 상태 테이블';

-- 6. 사용자별 오늘 날짜 설정 테이블
CREATE TABLE user_date_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL COMMENT '사용자 ID',
    custom_date DATE NOT NULL COMMENT '사용자 설정 날짜',
    is_active BOOLEAN DEFAULT TRUE COMMENT '활성화 여부',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- 인덱스
    INDEX idx_user_id (user_id),
    INDEX idx_custom_date (custom_date),
    INDEX idx_is_active (is_active),
    UNIQUE KEY unique_user_date (user_id, custom_date),
    
    -- 외래키
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='사용자별 날짜 설정 테이블';

-- 7. 작업 히스토리 테이블
CREATE TABLE work_history (
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
    
    -- 인덱스
    INDEX idx_work_status_id (work_status_id),
    INDEX idx_user_id (user_id),
    INDEX idx_action (action),
    INDEX idx_created_at (created_at),
    
    -- 외래키
    FOREIGN KEY (work_status_id) REFERENCES work_status(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='작업 히스토리 테이블';

-- 8. 사용자 세션 테이블
CREATE TABLE user_sessions (
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
    
    -- 인덱스
    INDEX idx_user_id (user_id),
    INDEX idx_token (token(255)),
    INDEX idx_refresh_token (refresh_token(255)),
    INDEX idx_expires_at (expires_at),
    INDEX idx_is_active (is_active),
    
    -- 외래키
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='사용자 세션 테이블';

-- 초기 데이터 삽입

-- 관리자 계정 생성 (비밀번호: admin123)
INSERT INTO users (email, password, name, role, status, department, position, approved_at) 
VALUES ('admin@metrowork.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HS.iK2O', '시스템 관리자', 'admin', 'approved', 'IT', '시스템 관리자', NOW());

-- 기본 관리자 ID를 1로 설정
UPDATE users SET approved_by = 1 WHERE id = 1;

-- 뷰 생성 (자주 사용되는 쿼리를 위한 뷰)

-- 1. 사용자별 업무 현황 뷰
CREATE VIEW user_work_summary AS
SELECT 
    u.id as user_id,
    u.name as user_name,
    u.department,
    u.position,
    COUNT(CASE WHEN ws.status = 'pending' THEN 1 END) as pending_count,
    COUNT(CASE WHEN ws.status = 'in_progress' THEN 1 END) as in_progress_count,
    COUNT(CASE WHEN ws.status = 'completed' THEN 1 END) as completed_count,
    COUNT(CASE WHEN ws.status = 'cancelled' THEN 1 END) as cancelled_count,
    COUNT(CASE WHEN ws.due_date < CURDATE() AND ws.status NOT IN ('completed', 'cancelled') THEN 1 END) as overdue_count
FROM users u
LEFT JOIN work_status ws ON u.id = ws.assigned_to
WHERE u.status = 'approved'
GROUP BY u.id, u.name, u.department, u.position;

-- 2. 엑셀 파일별 데이터 현황 뷰
CREATE VIEW excel_file_summary AS
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
    COUNT(CASE WHEN ws.status = 'completed' THEN 1 END) as completed_work_count,
    ef.created_at
FROM excel_files ef
LEFT JOIN users u ON ef.uploaded_by = u.id
LEFT JOIN excel_data ed ON ef.id = ed.file_id
LEFT JOIN work_status ws ON ed.id = ws.data_id
GROUP BY ef.id, ef.original_name, ef.filename, ef.total_rows, ef.total_columns, ef.uploaded_by, u.name, ef.created_at;

-- 3. 오늘 할 일 뷰 (사용자별 날짜 설정 반영)
CREATE VIEW today_work AS
SELECT 
    ws.id as work_id,
    ws.data_id,
    ws.assigned_to,
    u.name as assigned_to_name,
    u.department,
    ws.status,
    ws.priority,
    ws.due_date,
    COALESCE(uds.custom_date, CURDATE()) as work_date,
    ed.row_data,
    ef.original_name as file_name,
    ef.id as file_id
FROM work_status ws
JOIN users u ON ws.assigned_to = u.id
JOIN excel_data ed ON ws.data_id = ed.id
JOIN excel_files ef ON ed.file_id = ef.id
LEFT JOIN user_date_settings uds ON ws.assigned_to = uds.user_id AND uds.is_active = TRUE
WHERE ws.status IN ('pending', 'in_progress')
AND COALESCE(uds.custom_date, CURDATE()) = COALESCE(ws.due_date, COALESCE(uds.custom_date, CURDATE()));

-- 인덱스 최적화를 위한 추가 인덱스
CREATE INDEX idx_work_status_assigned_due ON work_status(assigned_to, due_date);
CREATE INDEX idx_work_status_status_due ON work_status(status, due_date);
CREATE INDEX idx_excel_data_file_valid ON excel_data(file_id, is_valid);
CREATE INDEX idx_users_status_role ON users(status, role);
CREATE INDEX idx_work_history_work_user ON work_history(work_status_id, user_id);

-- 권한 설정 (선택사항)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON metrowork_db.* TO 'metrowork_user'@'localhost';
-- FLUSH PRIVILEGES; 