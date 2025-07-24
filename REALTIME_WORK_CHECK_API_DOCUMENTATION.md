# MetroWork 실시간 업무 체크 시스템 API 문서

## 📋 개요

실시간 업무 체크 시스템은 회원들이 각자의 업무를 체크하면 실시간으로 취합되어 관리자가 볼 수 있도록 하는 시스템입니다. Socket.IO를 통한 실시간 통신과 중복 체크 방지 기능을 제공합니다.

### 🎯 주요 기능
- **실시간 업무 체크**: Socket.IO를 통한 실시간 공유
- **중복 체크 방지**: 이미 체크된 업무에 대한 안내
- **실시간 통계**: 관리자 대시보드에서 실시간 현황 모니터링
- **업무 상태 관리**: pending, in_progress, completed 상태 관리
- **메모 기능**: 업무 진행 상황 기록

---

## 🚀 API 엔드포인트

### 기본 정보
- **Base URL**: `http://localhost:5000/api/work-check`
- **Content-Type**: `application/json`
- **인증**: JWT 토큰 필요 (Authorization 헤더)

---

## 1️⃣ 업무 체크 상태 조회

### GET `/api/work-check/status/:taskId`

특정 업무의 체크 상태를 조회합니다.

#### Path Parameters
- `taskId` (number, required): 업무 ID

#### Response (200 OK) - 성공
```json
{
  "success": true,
  "data": {
    "taskId": 1,
    "checks": [
      {
        "id": 1,
        "task_id": 1,
        "user_id": 1,
        "checked_at": "2024-01-15T10:30:00.000Z",
        "status": "completed",
        "user_name": "홍길동",
        "user_email": "hong@example.com"
      }
    ],
    "statistics": {
      "total": 1,
      "completed": 1,
      "inProgress": 0,
      "completionRate": 100
    }
  }
}
```

#### Response (404 Not Found) - 업무 없음
```json
{
  "success": false,
  "message": "업무를 찾을 수 없습니다."
}
```

---

## 2️⃣ 전체 업무 체크 현황 조회 (관리자용)

### GET `/api/work-check/all-status`

전체 업무 체크 현황을 조회합니다. 관리자 권한이 필요합니다.

#### Query Parameters
- `date` (string, optional): 조회할 날짜 (YYYY-MM-DD 형식)
- `userId` (number, optional): 특정 사용자 ID

#### Response (200 OK) - 성공
```json
{
  "success": true,
  "data": {
    "checks": [
      {
        "id": 1,
        "task_id": 1,
        "user_id": 1,
        "checked_at": "2024-01-15T10:30:00.000Z",
        "status": "completed",
        "notes": "업무 완료했습니다.",
        "user_name": "홍길동",
        "user_email": "hong@example.com",
        "row_data": "업무 내용...",
        "file_name": "업무목록.xlsx"
      }
    ],
    "statistics": {
      "total": 5,
      "completed": 3,
      "inProgress": 2,
      "completionRate": 60
    },
    "userStatistics": [
      {
        "userId": 1,
        "userName": "홍길동",
        "total": 2,
        "completed": 1,
        "inProgress": 1
      }
    ]
  }
}
```

#### Response (403 Forbidden) - 권한 없음
```json
{
  "success": false,
  "message": "관리자 권한이 필요합니다."
}
```

---

## 3️⃣ 실시간 업무 현황 조회

### GET `/api/work-check/real-time-status`

실시간 업무 현황을 조회합니다.

#### Response (200 OK) - 성공
```json
{
  "success": true,
  "data": {
    "today": "2024-01-15",
    "statistics": {
      "total": 10,
      "completed": 6,
      "inProgress": 3
    },
    "userStatistics": [
      {
        "user_id": 1,
        "user_name": "홍길동",
        "user_email": "hong@example.com",
        "totalChecks": 3,
        "completedChecks": 2,
        "inProgressChecks": 1
      }
    ],
    "recentChecks": [
      {
        "id": 1,
        "task_id": 1,
        "user_id": 1,
        "checked_at": "2024-01-15T10:30:00.000Z",
        "status": "completed",
        "user_name": "홍길동",
        "user_email": "hong@example.com"
      }
    ]
  }
}
```

---

## 4️⃣ 업무 체크 (실시간 공유)

### POST `/api/work-check/check`

업무를 체크하고 실시간으로 공유합니다.

#### Request Body
```json
{
  "taskId": 1,
  "status": "completed",
  "notes": "업무 완료했습니다."
}
```

#### Request Parameters
- `taskId` (number, required): 업무 ID
- `status` (string, required): 상태 (pending, in_progress, completed)
- `notes` (string, optional): 메모 (최대 500자)

#### Response (201 Created) - 성공
```json
{
  "success": true,
  "message": "업무가 성공적으로 체크되었습니다.",
  "data": {
    "check": {
      "id": 1,
      "task_id": 1,
      "user_id": 1,
      "checked_at": "2024-01-15T10:30:00.000Z",
      "status": "completed",
      "notes": "업무 완료했습니다.",
      "user_name": "홍길동",
      "user_email": "hong@example.com"
    },
    "isUpdate": false
  }
}
```

#### Response (200 OK) - 상태 업데이트
```json
{
  "success": true,
  "message": "업무 상태가 업데이트되었습니다.",
  "data": {
    "check": {
      "id": 1,
      "task_id": 1,
      "user_id": 1,
      "checked_at": "2024-01-15T10:35:00.000Z",
      "status": "completed",
      "notes": "업무 완료했습니다.",
      "user_name": "홍길동",
      "user_email": "hong@example.com"
    },
    "isUpdate": true
  }
}
```

#### Response (409 Conflict) - 이미 체크된 업무
```json
{
  "success": false,
  "message": "이미 다른 사용자가 체크한 업무입니다.",
  "data": {
    "existingCheck": {
      "userName": "김철수",
      "checkedAt": "2024-01-15T10:25:00.000Z",
      "status": "in_progress",
      "notes": "진행 중입니다."
    },
    "suggestion": "업무가 이미 진행 중이므로 담당자와 협의해주세요."
  }
}
```

---

## 5️⃣ 업무 체크 취소

### DELETE `/api/work-check/uncheck/:taskId`

업무 체크를 취소합니다.

#### Path Parameters
- `taskId` (number, required): 업무 ID

#### Response (200 OK) - 성공
```json
{
  "success": true,
  "message": "업무 체크가 취소되었습니다.",
  "data": {
    "taskId": 1,
    "deletedAt": "2024-01-15T10:40:00.000Z"
  }
}
```

#### Response (404 Not Found) - 체크 정보 없음
```json
{
  "success": false,
  "message": "체크된 업무를 찾을 수 없습니다."
}
```

---

## 🔌 Socket.IO 이벤트

### 클라이언트 → 서버

#### `joinWorkRoom`
특정 업무의 실시간 룸에 참가합니다.
```javascript
socket.emit('joinWorkRoom', taskId)
```

#### `leaveWorkRoom`
특정 업무의 실시간 룸에서 나갑니다.
```javascript
socket.emit('leaveWorkRoom', taskId)
```

#### `subscribeWorkStatus`
실시간 업무 현황 구독을 시작합니다.
```javascript
socket.emit('subscribeWorkStatus')
```

#### `unsubscribeWorkStatus`
실시간 업무 현황 구독을 해제합니다.
```javascript
socket.emit('unsubscribeWorkStatus')
```

### 서버 → 클라이언트

#### `workCheckCreated`
새로운 업무 체크가 생성되었을 때 발생합니다.
```javascript
socket.on('workCheckCreated', (data) => {
  console.log('새로운 업무 체크:', data)
  // data: { type: 'created', data: {...}, message: '...' }
})
```

#### `workCheckUpdated`
업무 체크가 업데이트되었을 때 발생합니다.
```javascript
socket.on('workCheckUpdated', (data) => {
  console.log('업무 체크 업데이트:', data)
  // data: { type: 'updated', data: {...}, message: '...' }
})
```

#### `workCheckDeleted`
업무 체크가 삭제되었을 때 발생합니다.
```javascript
socket.on('workCheckDeleted', (data) => {
  console.log('업무 체크 삭제:', data)
  // data: { type: 'deleted', taskId: 1, userId: 1, message: '...' }
})
```

#### `workStatusUpdate`
실시간 업무 현황이 업데이트되었을 때 발생합니다.
```javascript
socket.on('workStatusUpdate', (data) => {
  console.log('업무 현황 업데이트:', data)
  // data: { today: '2024-01-15', statistics: {...}, ... }
})
```

---

## 🔧 유효성 검사 규칙

### taskId
- **타입**: 정수
- **범위**: 1 이상
- **검증**: `isInt({ min: 1 })`

### status
- **값**: 'pending', 'in_progress', 'completed' 중 하나
- **검증**: `isIn(['pending', 'in_progress', 'completed'])`

### notes
- **길이**: 최대 500자
- **검증**: `isLength({ max: 500 })`

---

## 📝 사용 예시

### 1. 전체 플로우 (JavaScript)

```javascript
// Socket.IO 연결
const socket = io('http://localhost:5000', {
  auth: { token: 'your-jwt-token' }
})

// 실시간 이벤트 구독
socket.on('workCheckCreated', (data) => {
  console.log('새로운 업무 체크:', data.message)
  updateWorkStatus() // UI 업데이트
})

socket.on('workCheckUpdated', (data) => {
  console.log('업무 체크 업데이트:', data.message)
  updateWorkStatus() // UI 업데이트
})

// 업무 체크
const checkWork = async (taskId, status, notes) => {
  try {
    const response = await fetch('/api/work-check/check', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ taskId, status, notes })
    })
    
    const data = await response.json()
    
    if (response.status === 409) {
      // 이미 체크된 업무
      alert(`${data.data.existingCheck.userName}님이 이미 체크했습니다.`)
      return
    }
    
    if (!response.ok) {
      throw new Error(data.message)
    }
    
    console.log('업무 체크 성공:', data.message)
    
  } catch (error) {
    console.error('업무 체크 실패:', error)
  }
}

// 실시간 업무 현황 조회
const getRealTimeStatus = async () => {
  try {
    const response = await fetch('/api/work-check/real-time-status', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    
    const data = await response.json()
    console.log('실시간 현황:', data.data)
    
  } catch (error) {
    console.error('실시간 현황 조회 실패:', error)
  }
}
```

### 2. React Hook 사용

```javascript
import { useWorkCheck } from '../hooks/useWorkCheck'

const WorkCheckComponent = () => {
  const {
    workChecks,
    statistics,
    realTimeStatus,
    isLoading,
    checkWork,
    uncheckWork,
    getWorkCheckStatus
  } = useWorkCheck()

  const handleCheckWork = async () => {
    await checkWork(1, 'completed', '업무 완료했습니다.')
  }

  return (
    <div>
      <h2>업무 체크 현황</h2>
      <p>전체: {statistics.total}, 완료: {statistics.completed}</p>
      
      <button onClick={handleCheckWork} disabled={isLoading}>
        업무 체크
      </button>
      
      {workChecks.map(check => (
        <div key={check.id}>
          {check.user_name}: {check.status}
        </div>
      ))}
    </div>
  )
}
```

### 3. cURL 예시

```bash
# 업무 체크 상태 조회
curl -X GET http://localhost:5000/api/work-check/status/1 \
  -H "Authorization: Bearer your-jwt-token"

# 업무 체크
curl -X POST http://localhost:5000/api/work-check/check \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token" \
  -d '{
    "taskId": 1,
    "status": "completed",
    "notes": "업무 완료했습니다."
  }'

# 실시간 업무 현황 조회
curl -X GET http://localhost:5000/api/work-check/real-time-status \
  -H "Authorization: Bearer your-jwt-token"

# 업무 체크 취소
curl -X DELETE http://localhost:5000/api/work-check/uncheck/1 \
  -H "Authorization: Bearer your-jwt-token"
```

---

## 🗄️ 데이터베이스 스키마

### work_checks 테이블
```sql
CREATE TABLE work_checks (
  id INT PRIMARY KEY AUTO_INCREMENT,
  task_id INT NOT NULL,
  user_id INT NOT NULL,
  status ENUM('pending', 'in_progress', 'completed') NOT NULL DEFAULT 'pending',
  notes TEXT,
  checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  
  INDEX idx_task_id (task_id),
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_checked_at (checked_at),
  INDEX idx_task_user (task_id, user_id),
  
  UNIQUE KEY unique_task_user (task_id, user_id)
);
```

### work_check_history 테이블 (감사 로그)
```sql
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
  
  FOREIGN KEY (work_check_id) REFERENCES work_checks(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  
  INDEX idx_work_check_id (work_check_id),
  INDEX idx_task_id (task_id),
  INDEX idx_user_id (user_id),
  INDEX idx_action (action),
  INDEX idx_changed_at (changed_at)
);
```

---

## 🔒 보안 고려사항

### 인증 및 권한
- **JWT 토큰**: 모든 API 요청에 JWT 토큰 필요
- **Socket.IO 인증**: 연결 시 JWT 토큰 검증
- **관리자 권한**: 전체 현황 조회는 관리자만 가능

### 데이터 보안
- **SQL Injection 방지**: Prepared Statements 사용
- **XSS 방지**: 입력 데이터 검증 및 이스케이프
- **CSRF 방지**: JWT 토큰 기반 인증

### 실시간 통신 보안
- **Socket.IO 인증**: 연결 시 토큰 검증
- **룸 기반 접근 제어**: 사용자별 룸 분리
- **이벤트 검증**: 서버 측 이벤트 검증

---

## ⚡ 성능 최적화

### 데이터베이스 최적화
```sql
-- 복합 인덱스로 빠른 조회
CREATE INDEX idx_work_checks_task_user ON work_checks(task_id, user_id);
CREATE INDEX idx_work_checks_status_date ON work_checks(status, checked_at);

-- 통계 조회 최적화
CREATE INDEX idx_work_checks_date_status ON work_checks(DATE(checked_at), status);
```

### 캐싱 전략
- **Redis 캐싱**: 실시간 통계 캐싱
- **메모리 캐싱**: 자주 조회되는 데이터 캐싱
- **TTL 설정**: 캐시 만료 시간 설정

### Socket.IO 최적화
- **룸 기반 메시징**: 필요한 사용자에게만 메시지 전송
- **연결 풀링**: 연결 수 제한 및 관리
- **하트비트**: 연결 상태 모니터링

---

## 🚨 에러 처리

### 일반적인 에러 코드
- `400`: 잘못된 요청 (유효성 검사 실패)
- `401`: 인증 실패 (JWT 토큰 없음/만료)
- `403`: 권한 없음 (관리자 권한 필요)
- `404`: 리소스 없음 (업무/체크 정보 없음)
- `409`: 충돌 (이미 체크된 업무)
- `500`: 서버 내부 오류

### 에러 응답 예시
```json
{
  "success": false,
  "message": "업무 체크 중 오류가 발생했습니다.",
  "error": "DATABASE_ERROR"
}
```

---

## 📊 모니터링

### 로그 기록
```javascript
// 업무 체크 로그
{
  "timestamp": "2024-01-15T10:30:00Z",
  "action": "work_check_created",
  "taskId": 1,
  "userId": 1,
  "userName": "홍길동",
  "status": "completed",
  "ip": "192.168.1.100",
  "userAgent": "Mozilla/5.0...",
  "result": "success"
}

// Socket.IO 연결 로그
{
  "timestamp": "2024-01-15T10:30:00Z",
  "action": "socket_connected",
  "socketId": "socket_123",
  "userId": 1,
  "userName": "홍길동",
  "ip": "192.168.1.100"
}
```

### 메트릭 수집
- **업무 체크 수**: 시간별 업무 체크 요청 수
- **실시간 연결 수**: 활성 Socket.IO 연결 수
- **완료율**: 업무 완료 비율
- **에러율**: 각 API별 에러 발생 비율

---

## 🔄 향후 확장 계획

### 추가 기능
- **업무 우선순위**: 우선순위별 업무 관리
- **업무 의존성**: 업무 간 의존 관계 관리
- **자동 알림**: 업무 완료 시 자동 알림
- **업무 템플릿**: 재사용 가능한 업무 템플릿

### 개선 사항
- **실시간 차트**: 실시간 통계 차트
- **업무 히스토리**: 상세한 업무 변경 이력
- **성능 최적화**: 대용량 데이터 처리 최적화
- **모바일 최적화**: 모바일 앱 지원

---

## 📞 지원

### API 관련 문의
- **이슈 리포트**: GitHub Issues
- **기술 문서**: API 문서
- **개발자 포럼**: 개발자 커뮤니티

### 연락처
- **이메일**: api-support@metrowork.com
- **전화**: 02-1234-5678
- **운영시간**: 평일 09:00-18:00 (KST)

---

## 🔧 환경 설정

### 환경변수 설정
```bash
# 서버 설정
NODE_ENV=production
PORT=5000
CLIENT_URL=https://your-domain.com

# 데이터베이스 설정
DB_HOST=localhost
DB_PORT=3306
DB_NAME=metrowork
DB_USER=metrowork_admin
DB_PASSWORD=your-password

# JWT 설정
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=24h

# Socket.IO 설정
FRONTEND_URL=https://your-domain.com

# 로깅 설정
LOG_LEVEL=info
LOG_FILE=/path/to/logs/app.log
```

### 의존성 설치
```bash
# 서버 의존성
npm install express socket.io mysql2 express-validator

# 클라이언트 의존성
npm install socket.io-client react-hot-toast

# 개발 의존성
npm install --save-dev @types/socket.io @types/express
```

---

## ✅ 완료 메시지

MetroWork 실시간 업무 체크 시스템 API가 성공적으로 구현되었습니다!

### 주요 특징:
- ✅ **실시간 업무 체크**: Socket.IO를 통한 실시간 공유
- ✅ **중복 체크 방지**: 이미 체크된 업무에 대한 안내
- ✅ **관리자 대시보드**: 실시간 통계 및 현황 모니터링
- ✅ **업무 상태 관리**: pending, in_progress, completed 상태
- ✅ **메모 기능**: 업무 진행 상황 기록
- ✅ **이력 관리**: 업무 체크 변경 이력 추적
- ✅ **보안**: JWT 인증 및 권한 관리
- ✅ **성능**: 데이터베이스 최적화 및 캐싱

### 접속 정보:
- **API Base URL**: `http://localhost:5000/api/work-check`
- **Socket.IO**: `http://localhost:5000`
- **관리자 대시보드**: `/admin/work-check`
- **실시간 대시보드**: `/dashboard`

### 유지보수 명령어:
```bash
# 서버 재시작
pm2 restart metrowork-server

# 로그 확인
pm2 logs metrowork-server

# 실시간 모니터링
pm2 monit

# 데이터베이스 백업
mysqldump -u metrowork_admin -p metrowork > backup.sql
``` 