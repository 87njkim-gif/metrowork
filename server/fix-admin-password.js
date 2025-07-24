import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';

async function fixAdminPassword() {
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

    // 현재 관리자 계정 확인
    const [adminUsers] = await connection.execute(
      'SELECT id, name, email, password FROM users WHERE email = ?',
      ['admin@metrowork.com']
    );

    if (adminUsers.length === 0) {
      console.log('관리자 계정을 찾을 수 없습니다.');
      return;
    }

    const admin = adminUsers[0];
    console.log('현재 관리자 정보:', {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      passwordLength: admin.password?.length || 0
    });

    // 새로운 비밀번호 해시 생성
    const newPassword = 'admin123'; // 기본 비밀번호
    const SALT_ROUNDS = 12;
    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

    console.log('새로운 해시된 비밀번호 생성 완료');

    // 관리자 비밀번호 업데이트
    await connection.execute(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, admin.id]
    );

    console.log('✅ 관리자 비밀번호가 성공적으로 업데이트되었습니다!');
    console.log('새 비밀번호:', newPassword);
    console.log('이제 이 비밀번호로 로그인할 수 있습니다.');

  } catch (error) {
    console.error('❌ 관리자 비밀번호 업데이트 중 오류 발생:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

fixAdminPassword(); 