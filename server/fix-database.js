import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fixDatabase() {
  let connection;
  
  try {
    // 데이터베이스 연결
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '', // 비밀번호가 있다면 입력
      database: 'metrowork_db'
    });

    console.log('데이터베이스에 연결되었습니다.');

    // 외래키 제약조건 확인 및 제거
    console.log('외래키 제약조건 확인 중...');
    
    // work_status를 참조하는 테이블들의 외래키 제거
    const dropForeignKeys = [
      'ALTER TABLE work_history DROP FOREIGN KEY IF EXISTS work_history_ibfk_1',
      'ALTER TABLE work_history DROP FOREIGN KEY IF EXISTS work_history_ibfk_2'
    ];

    for (const sql of dropForeignKeys) {
      try {
        await connection.execute(sql);
        console.log('외래키 제거 완료:', sql);
      } catch (error) {
        console.log('외래키가 이미 없거나 다른 이름:', error.message);
      }
    }

    // 기존 테이블 삭제
    console.log('기존 테이블 삭제 중...');
    await connection.execute('DROP TABLE IF EXISTS work_history');
    await connection.execute('DROP TABLE IF EXISTS work_status');

    // 새로운 테이블 생성
    console.log('새로운 테이블 생성 중...');
    
    // work_status 테이블 생성
    await connection.execute(`
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
        
        INDEX idx_excel_data_id (excel_data_id),
        INDEX idx_file_id (file_id),
        INDEX idx_user_id (user_id),
        INDEX idx_is_completed (is_completed),
        INDEX idx_completed_at (completed_at),
        UNIQUE KEY unique_excel_user (excel_data_id, user_id),
        
        FOREIGN KEY (excel_data_id) REFERENCES excel_data(id) ON DELETE CASCADE,
        FOREIGN KEY (file_id) REFERENCES excel_files(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (completed_by) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='업무 처리 상태 테이블'
    `);

    // work_history 테이블 생성
    await connection.execute(`
      CREATE TABLE work_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        work_status_id INT NOT NULL COMMENT '업무 상태 ID',
        user_id INT NOT NULL COMMENT '작업한 사용자 ID',
        action ENUM('created', 'assigned', 'started', 'completed', 'uncompleted', 'updated', 'commented') NOT NULL COMMENT '작업 액션',
        old_status BOOLEAN NULL COMMENT '이전 완료 상태',
        new_status BOOLEAN NULL COMMENT '새로운 완료 상태',
        comment TEXT COMMENT '작업 코멘트',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        INDEX idx_work_status_id (work_status_id),
        INDEX idx_user_id (user_id),
        INDEX idx_action (action),
        INDEX idx_created_at (created_at),
        
        FOREIGN KEY (work_status_id) REFERENCES work_status(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='작업 히스토리 테이블'
    `);

    // 추가 인덱스 생성
    await connection.execute(`
      CREATE INDEX idx_work_history_work_user ON work_history(work_status_id, user_id)
    `);

    console.log('✅ 데이터베이스 테이블이 성공적으로 수정되었습니다!');

  } catch (error) {
    console.error('❌ 데이터베이스 수정 중 오류 발생:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

fixDatabase(); 