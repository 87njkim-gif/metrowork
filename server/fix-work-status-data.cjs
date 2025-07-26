const { Pool } = require('pg')
require('dotenv').config()

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
})

async function fixWorkStatusData() {
  let client
  try {
    client = await pool.connect()
    console.log('🔗 데이터베이스 연결 성공')

    // 1. 현재 work_status 테이블 상태 확인
    console.log('\n📊 현재 work_status 테이블 상태:')
    const currentStats = await client.query(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(CASE WHEN is_completed = TRUE THEN 1 END) as completed_records,
        COUNT(CASE WHEN is_completed = FALSE THEN 1 END) as uncompleted_records
      FROM work_status
    `)
    
    const stats = currentStats.rows[0]
    console.log(`- 전체 레코드: ${stats.total_records}개`)
    console.log(`- 완료된 업무: ${stats.completed_records}개`)
    console.log(`- 미완료 업무: ${stats.uncompleted_records}개`)

    // 2. 미완료 업무 삭제
    console.log('\n🗑️ 미완료 업무(is_completed = FALSE) 삭제 중...')
    const deleteResult = await client.query(`
      DELETE FROM work_status 
      WHERE is_completed = FALSE
    `)
    
    console.log(`✅ ${deleteResult.rowCount}개의 미완료 업무 레코드 삭제 완료`)

    // 3. 삭제 후 상태 확인
    console.log('\n📊 삭제 후 work_status 테이블 상태:')
    const afterStats = await client.query(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(CASE WHEN is_completed = TRUE THEN 1 END) as completed_records
      FROM work_status
    `)
    
    const afterStatsData = afterStats.rows[0]
    console.log(`- 전체 레코드: ${afterStatsData.total_records}개`)
    console.log(`- 완료된 업무: ${afterStatsData.completed_records}개`)

    // 4. 사용자별 완료된 업무 현황
    console.log('\n👥 사용자별 완료된 업무 현황:')
    const userStats = await client.query(`
      SELECT 
        u.name as user_name,
        u.email as user_email,
        COUNT(ws.id) as completed_count
      FROM users u
      LEFT JOIN work_status ws ON u.id = ws.user_id AND ws.is_completed = TRUE
      WHERE u.role = 'user' AND u.status = 'approved'
      GROUP BY u.id, u.name, u.email
      ORDER BY completed_count DESC
    `)
    
    userStats.rows.forEach((user, index) => {
      console.log(`${index + 1}. ${user.user_name} (${user.user_email}): ${user.completed_count}개`)
    })

    console.log('\n✅ work_status 데이터 정리 완료!')
    console.log('이제 관리자 모드에서 정확한 완료된 업무 개수가 표시됩니다.')

  } catch (error) {
    console.error('❌ 데이터 정리 중 오류 발생:', error)
  } finally {
    if (client) {
      client.release()
    }
    await pool.end()
  }
}

// 스크립트 실행
fixWorkStatusData() 