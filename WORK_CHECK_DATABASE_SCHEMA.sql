-- MetroWork 실시간 업무 체크 시스템 데이터베이스 스키마

-- =====================================================
-- 업무 체크 테이블
-- =====================================================
CREATE TABLE work_checks (
  id INT PRIMARY KEY AUTO_INCREMENT,
  task_id INT NOT NULL,
  user_id INT NOT NULL,
  status ENUM('pending', 'in_progress', 'completed') NOT NULL DEFAULT 'pending',
  notes TEXT,
  checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- 외래키 제약조건
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  
  -- 인덱스
  INDEX idx_task_id (task_id),
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_checked_at (checked_at),
  INDEX idx_task_user (task_id, user_id),
  
  -- 유니크 제약조건 (한 사용자가 같은 업무를 중복 체크하지 못하도록)
  UNIQUE KEY unique_task_user (task_id, user_id)
);

-- =====================================================
-- 업무 체크 이력 테이블 (감사 로그)
-- =====================================================
CREATE TABLE work_check_history (
  id INT PRIMARY KEY AUTO_INCREMENT,
  work_check_id INT NOT NULL,
  task_id INT NOT NULL,
  user_id INT NOT NULL,
  action ENUM('created', 'updated', 'deleted') NOT NULL,
  old_status ENUM('pending', 'in_progress', 'completed'),
  new_status ENUM('pending', 'in_progress', 'completed'),
  old_notes TEXT,
  new_notes TEXT,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- 외래키 제약조건
  FOREIGN KEY (work_check_id) REFERENCES work_checks(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  
  -- 인덱스
  INDEX idx_work_check_id (work_check_id),
  INDEX idx_task_id (task_id),
  INDEX idx_user_id (user_id),
  INDEX idx_action (action),
  INDEX idx_changed_at (changed_at)
);

-- =====================================================
-- 실시간 알림 테이블
-- =====================================================
CREATE TABLE work_notifications (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  type ENUM('work_check', 'work_update', 'work_complete', 'system') NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  data JSON,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- 외래키 제약조건
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  
  -- 인덱스
  INDEX idx_user_id (user_id),
  INDEX idx_type (type),
  INDEX idx_is_read (is_read),
  INDEX idx_created_at (created_at)
);

-- =====================================================
-- 업무 통계 테이블 (성능 최적화용)
-- =====================================================
CREATE TABLE work_statistics (
  id INT PRIMARY KEY AUTO_INCREMENT,
  date DATE NOT NULL,
  user_id INT NOT NULL,
  total_checks INT DEFAULT 0,
  completed_checks INT DEFAULT 0,
  in_progress_checks INT DEFAULT 0,
  pending_checks INT DEFAULT 0,
  completion_rate DECIMAL(5,2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- 외래키 제약조건
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  
  -- 인덱스
  INDEX idx_date (date),
  INDEX idx_user_id (user_id),
  INDEX idx_date_user (date, user_id),
  
  -- 유니크 제약조건 (하루에 한 사용자당 하나의 통계)
  UNIQUE KEY unique_date_user (date, user_id)
);

-- =====================================================
-- 기존 users 테이블에 전화번호 컬럼 추가 (SMS 인증용)
-- =====================================================
ALTER TABLE users ADD COLUMN phone_number VARCHAR(15) AFTER email;

-- =====================================================
-- 인덱스 추가 (성능 최적화)
-- =====================================================
-- 사용자 조회 최적화
CREATE INDEX idx_users_name_birth_phone ON users(name, birth_date, phone_number);
CREATE INDEX idx_users_phone_number ON users(phone_number);

-- excel_data 테이블 조회 최적화
CREATE INDEX idx_excel_data_file_name ON excel_data(file_name);
CREATE INDEX idx_excel_data_created_at ON excel_data(created_at);

-- =====================================================
-- 트리거: 업무 체크 이력 자동 기록
-- =====================================================
DELIMITER //

-- 업무 체크 생성 시 이력 기록
CREATE TRIGGER work_check_after_insert
AFTER INSERT ON work_checks
FOR EACH ROW
BEGIN
  INSERT INTO work_check_history (
    work_check_id, task_id, user_id, action, 
    new_status, new_notes
  ) VALUES (
    NEW.id, NEW.task_id, NEW.user_id, 'created',
    NEW.status, NEW.notes
  );
END//

-- 업무 체크 수정 시 이력 기록
CREATE TRIGGER work_check_after_update
AFTER UPDATE ON work_checks
FOR EACH ROW
BEGIN
  INSERT INTO work_check_history (
    work_check_id, task_id, user_id, action,
    old_status, new_status, old_notes, new_notes
  ) VALUES (
    NEW.id, NEW.task_id, NEW.user_id, 'updated',
    OLD.status, NEW.status, OLD.notes, NEW.notes
  );
END//

-- 업무 체크 삭제 시 이력 기록
CREATE TRIGGER work_check_after_delete
AFTER DELETE ON work_checks
FOR EACH ROW
BEGIN
  INSERT INTO work_check_history (
    work_check_id, task_id, user_id, action,
    old_status, old_notes
  ) VALUES (
    OLD.id, OLD.task_id, OLD.user_id, 'deleted',
    OLD.status, OLD.notes
  );
END//

DELIMITER ;

-- =====================================================
-- 뷰: 실시간 업무 현황
-- =====================================================
CREATE VIEW real_time_work_status AS
SELECT 
  DATE(wc.checked_at) as check_date,
  u.id as user_id,
  u.name as user_name,
  u.email as user_email,
  COUNT(wc.id) as total_checks,
  SUM(CASE WHEN wc.status = 'completed' THEN 1 ELSE 0 END) as completed_checks,
  SUM(CASE WHEN wc.status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_checks,
  SUM(CASE WHEN wc.status = 'pending' THEN 1 ELSE 0 END) as pending_checks,
  ROUND(
    (SUM(CASE WHEN wc.status = 'completed' THEN 1 ELSE 0 END) / COUNT(wc.id)) * 100, 2
  ) as completion_rate
FROM users u
LEFT JOIN work_checks wc ON u.id = wc.user_id 
  AND DATE(wc.checked_at) = CURDATE()
WHERE u.status = 'approved'
GROUP BY u.id, u.name, u.email, DATE(wc.checked_at);

-- =====================================================
-- 뷰: 오늘의 업무 체크 요약
-- =====================================================
CREATE VIEW today_work_summary AS
SELECT 
  DATE(checked_at) as check_date,
  COUNT(*) as total_checks,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_checks,
  SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_checks,
  SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_checks,
  ROUND(
    (SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) / COUNT(*)) * 100, 2
  ) as overall_completion_rate
FROM work_checks 
WHERE DATE(checked_at) = CURDATE()
GROUP BY DATE(checked_at);

-- =====================================================
-- 샘플 데이터 삽입
-- =====================================================

-- 샘플 사용자 데이터 (전화번호 추가)
INSERT INTO users (name, birth_date, phone_number, email, password, role, status) VALUES
('홍길동', '1990-01-15', '010-1234-5678', 'hong@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.s5uO.G', 'user', 'approved'),
('김철수', '1985-03-20', '010-2345-6789', 'kim@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.s5uO.G', 'user', 'approved'),
('이영희', '1992-07-10', '010-3456-7890', 'lee@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.s5uO.G', 'user', 'approved'),
('박민수', '1988-12-05', '010-4567-8901', 'park@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.s5uO.G', 'admin', 'approved');

-- 샘플 업무 체크 데이터
INSERT INTO work_checks (task_id, user_id, status, notes) VALUES
(1, 1, 'completed', '업무 완료했습니다.'),
(2, 1, 'in_progress', '진행 중입니다.'),
(3, 2, 'completed', '검토 완료'),
(4, 2, 'pending', '대기 중'),
(5, 3, 'in_progress', '분석 중'),
(6, 3, 'completed', '최종 승인 완료'),
(7, 4, 'completed', '관리자 검토 완료');

-- 샘플 알림 데이터
INSERT INTO work_notifications (user_id, type, title, message, data) VALUES
(1, 'work_check', '업무 체크 완료', '홍길동님이 업무를 체크했습니다.', '{"taskId": 1, "status": "completed"}'),
(2, 'work_update', '업무 상태 변경', '김철수님이 업무 상태를 변경했습니다.', '{"taskId": 3, "status": "completed"}'),
(3, 'work_complete', '업무 완료', '이영희님이 업무를 완료했습니다.', '{"taskId": 6, "status": "completed"}'),
(4, 'system', '시스템 알림', '새로운 업무가 등록되었습니다.', '{"taskId": 8}');

-- =====================================================
-- 저장 프로시저: 일일 통계 업데이트
-- =====================================================
DELIMITER //

CREATE PROCEDURE UpdateDailyStatistics(IN target_date DATE)
BEGIN
  DECLARE done INT DEFAULT FALSE;
  DECLARE user_id_val INT;
  DECLARE total_checks_val INT;
  DECLARE completed_checks_val INT;
  DECLARE in_progress_checks_val INT;
  DECLARE pending_checks_val INT;
  DECLARE completion_rate_val DECIMAL(5,2);
  
  -- 사용자별 통계 계산
  DECLARE user_cursor CURSOR FOR
    SELECT 
      u.id,
      COUNT(wc.id) as total_checks,
      SUM(CASE WHEN wc.status = 'completed' THEN 1 ELSE 0 END) as completed_checks,
      SUM(CASE WHEN wc.status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_checks,
      SUM(CASE WHEN wc.status = 'pending' THEN 1 ELSE 0 END) as pending_checks
    FROM users u
    LEFT JOIN work_checks wc ON u.id = wc.user_id 
      AND DATE(wc.checked_at) = target_date
    WHERE u.status = 'approved'
    GROUP BY u.id;
  
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
  
  -- 기존 통계 삭제
  DELETE FROM work_statistics WHERE date = target_date;
  
  OPEN user_cursor;
  
  read_loop: LOOP
    FETCH user_cursor INTO user_id_val, total_checks_val, completed_checks_val, 
                         in_progress_checks_val, pending_checks_val;
    
    IF done THEN
      LEAVE read_loop;
    END IF;
    
    -- 완료율 계산
    IF total_checks_val > 0 THEN
      SET completion_rate_val = (completed_checks_val / total_checks_val) * 100;
    ELSE
      SET completion_rate_val = 0;
    END IF;
    
    -- 통계 삽입
    INSERT INTO work_statistics (
      date, user_id, total_checks, completed_checks, 
      in_progress_checks, pending_checks, completion_rate
    ) VALUES (
      target_date, user_id_val, total_checks_val, completed_checks_val,
      in_progress_checks_val, pending_checks_val, completion_rate_val
    );
    
  END LOOP;
  
  CLOSE user_cursor;
END//

DELIMITER ;

-- =====================================================
-- 이벤트: 매일 자정에 통계 업데이트
-- =====================================================
-- 이벤트 스케줄러 활성화
SET GLOBAL event_scheduler = ON;

-- 매일 자정에 통계 업데이트 이벤트 생성
CREATE EVENT IF NOT EXISTS daily_statistics_update
ON SCHEDULE EVERY 1 DAY
STARTS CURRENT_TIMESTAMP
DO
  CALL UpdateDailyStatistics(CURDATE());

-- =====================================================
-- 권한 설정
-- =====================================================
-- 일반 사용자 권한
GRANT SELECT, INSERT, UPDATE, DELETE ON work_checks TO 'metrowork_user'@'%';
GRANT SELECT ON work_check_history TO 'metrowork_user'@'%';
GRANT SELECT, INSERT ON work_notifications TO 'metrowork_user'@'%';
GRANT SELECT ON real_time_work_status TO 'metrowork_user'@'%';
GRANT SELECT ON today_work_summary TO 'metrowork_user'@'%';

-- 관리자 권한
GRANT ALL PRIVILEGES ON work_checks TO 'metrowork_admin'@'%';
GRANT ALL PRIVILEGES ON work_check_history TO 'metrowork_admin'@'%';
GRANT ALL PRIVILEGES ON work_notifications TO 'metrowork_admin'@'%';
GRANT ALL PRIVILEGES ON work_statistics TO 'metrowork_admin'@'%';
GRANT EXECUTE ON PROCEDURE UpdateDailyStatistics TO 'metrowork_admin'@'%';

-- 권한 적용
FLUSH PRIVILEGES;

-- =====================================================
-- 성능 최적화 설정
-- =====================================================
-- 쿼리 캐시 설정 (MySQL 5.7 이하)
-- SET GLOBAL query_cache_size = 67108864; -- 64MB
-- SET GLOBAL query_cache_type = 1;

-- InnoDB 설정 최적화
SET GLOBAL innodb_buffer_pool_size = 1073741824; -- 1GB
SET GLOBAL innodb_log_file_size = 268435456; -- 256MB
SET GLOBAL innodb_flush_log_at_trx_commit = 2;

-- 연결 수 설정
SET GLOBAL max_connections = 200;

-- 타임아웃 설정
SET GLOBAL wait_timeout = 28800; -- 8시간
SET GLOBAL interactive_timeout = 28800; -- 8시간

-- =====================================================
-- 백업 및 복구 설정
-- =====================================================
-- 자동 백업 이벤트 (매일 새벽 2시)
CREATE EVENT IF NOT EXISTS daily_backup
ON SCHEDULE EVERY 1 DAY
STARTS CURRENT_TIMESTAMP + INTERVAL 2 HOUR
DO
  -- 백업 명령어 (실제 환경에서는 mysqldump 사용)
  -- mysqldump -u root -p metrowork > /backup/metrowork_$(date +%Y%m%d).sql
  SELECT 'Backup completed' as backup_status;

-- =====================================================
-- 모니터링 뷰
-- =====================================================
-- 시스템 상태 모니터링 뷰
CREATE VIEW system_monitoring AS
SELECT 
  'work_checks' as table_name,
  COUNT(*) as record_count,
  MAX(checked_at) as last_activity
FROM work_checks
UNION ALL
SELECT 
  'work_notifications' as table_name,
  COUNT(*) as record_count,
  MAX(created_at) as last_activity
FROM work_notifications
UNION ALL
SELECT 
  'users' as table_name,
  COUNT(*) as record_count,
  MAX(created_at) as last_activity
FROM users;

-- =====================================================
-- 완료 메시지
-- =====================================================
SELECT 'MetroWork 실시간 업무 체크 시스템 데이터베이스 스키마가 성공적으로 생성되었습니다.' as status; 