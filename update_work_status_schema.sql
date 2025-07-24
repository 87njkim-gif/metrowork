-- MetroWork 업무 처리 시스템 스키마 업데이트
USE metrowork_db;

-- 기존 테이블 삭제 (외래키 제약조건 때문에 순서 중요)
DROP TABLE IF EXISTS work_history;
DROP TABLE IF EXISTS work_status;

-- 새로운 통합 업무 상태 테이블 생성
CREATE TABLE work_status (
  id INT PRIMARY KEY AUTO_INCREMENT,
  excel_data_id INT NOT NULL COMMENT '엑셀 데이터 ID',
  user_id INT NOT NULL COMMENT '사용자 ID',
  is_completed BOOLEAN DEFAULT FALSE COMMENT '완료 여부',
  completed_at TIMESTAMP NULL COMMENT '완료 시간',
  notes TEXT COMMENT '작업 노트',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- 유니크 제약: 한 사용자가 같은 업무를 중복 처리하지 않도록
  UNIQUE KEY unique_excel_user (excel_data_id, user_id),
  
  -- 인덱스
  INDEX idx_excel_data_id (excel_data_id),
  INDEX idx_user_id (user_id),
  INDEX idx_is_completed (is_completed),
  INDEX idx_completed_at (completed_at),
  INDEX idx_user_completed (user_id, is_completed),
  
  -- 외래키
  FOREIGN KEY (excel_data_id) REFERENCES excel_data(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='업무 처리 상태 테이블';

-- 업무 처리 이력 테이블 (감사 로그)
CREATE TABLE work_history (
  id INT PRIMARY KEY AUTO_INCREMENT,
  excel_data_id INT NOT NULL COMMENT '엑셀 데이터 ID',
  user_id INT NOT NULL COMMENT '사용자 ID',
  action ENUM('completed', 'uncompleted', 'note_added') NOT NULL COMMENT '처리 액션',
  old_status BOOLEAN NULL COMMENT '이전 상태',
  new_status BOOLEAN NULL COMMENT '새로운 상태',
  notes TEXT COMMENT '작업 노트',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- 인덱스
  INDEX idx_excel_data_id (excel_data_id),
  INDEX idx_user_id (user_id),
  INDEX idx_action (action),
  INDEX idx_created_at (created_at),
  INDEX idx_user_action (user_id, action),
  
  -- 외래키
  FOREIGN KEY (excel_data_id) REFERENCES excel_data(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='업무 처리 이력 테이블';

-- 기존 데이터 마이그레이션 (있다면)
-- INSERT INTO work_status (excel_data_id, user_id, is_completed, completed_at, notes)
-- SELECT excel_data_id, user_id, is_completed, completed_at, notes 
-- FROM old_work_status_table;

-- 샘플 데이터 삽입 (테스트용)
-- INSERT INTO work_status (excel_data_id, user_id, is_completed, notes) VALUES
-- (1, 1, FALSE, '테스트 업무 1'),
-- (1, 2, FALSE, '테스트 업무 1'),
-- (2, 1, TRUE, '완료된 업무'),
-- (2, 2, FALSE, '진행 중인 업무');

-- 통계 뷰 생성 (회원별 업무 처리 현황)
CREATE OR REPLACE VIEW user_work_stats AS
SELECT 
  u.id as user_id,
  u.name as user_name,
  u.email as user_email,
  u.department as user_department,
  COUNT(ws.id) as total_work_count,
  COUNT(CASE WHEN ws.is_completed = TRUE THEN 1 END) as completed_count,
  COUNT(CASE WHEN ws.is_completed = FALSE THEN 1 END) as pending_count,
  ROUND(
    (COUNT(CASE WHEN ws.is_completed = TRUE THEN 1 END) / COUNT(ws.id)) * 100, 
    2
  ) as completion_rate,
  MAX(ws.completed_at) as last_completed_at
FROM users u
LEFT JOIN work_status ws ON u.id = ws.user_id
WHERE u.role = 'user' AND u.status = 'approved'
GROUP BY u.id, u.name, u.email, u.department
ORDER BY completed_count DESC;

-- 전역 업무 현황 뷰 생성
CREATE OR REPLACE VIEW global_work_stats AS
SELECT 
  ed.id as excel_data_id,
  ed.row_index,
  ed.row_data,
  ef.original_name as file_name,
  COUNT(ws.id) as total_users,
  COUNT(CASE WHEN ws.is_completed = TRUE THEN 1 END) as completed_users,
  COUNT(CASE WHEN ws.is_completed = FALSE THEN 1 END) as pending_users,
  ROUND(
    (COUNT(CASE WHEN ws.is_completed = TRUE THEN 1 END) / COUNT(ws.id)) * 100, 
    2
  ) as completion_rate,
  MAX(ws.completed_at) as last_completed_at
FROM excel_data ed
JOIN excel_files ef ON ed.file_id = ef.id
LEFT JOIN work_status ws ON ed.id = ws.excel_data_id
GROUP BY ed.id, ed.row_index, ed.row_data, ef.original_name
ORDER BY completion_rate DESC, last_completed_at DESC; 