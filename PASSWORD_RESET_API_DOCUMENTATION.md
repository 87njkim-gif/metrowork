# MetroWork Password Reset API Documentation

## 📋 비밀번호 재설정 API

### 기본 정보
- **Base URL**: `http://localhost:5000/api/auth`
- **Content-Type**: `application/json`
- **인증**: 불필요 (공개 API)

---

## 🔐 비밀번호 재설정 요청

### POST `/api/auth/reset-password`

이름, 생년월일, 이메일로 본인 확인 후 비밀번호 재설정 이메일을 발송합니다.

#### Request Body
```json
{
  "name": "홍길동",
  "birthDate": "1990-01-15",
  "email": "hong@example.com"
}
```

#### Request Parameters
- `name` (string, required): 사용자 이름 (2-50자, 한글/영문/공백만 허용)
- `birthDate` (string, required): 생년월일 (YYYY-MM-DD 형식)
- `email` (string, required): 가입 시 사용한 이메일 주소

#### Response (200 OK) - 성공
```json
{
  "success": true,
  "message": "비밀번호 재설정 이메일이 발송되었습니다.",
  "data": {
    "email": "hong@example.com",
    "expiresAt": "2024-01-15T11:30:00.000Z",
    "suggestion": "이메일을 확인하여 비밀번호를 재설정해주세요."
  }
}
```

#### Response (404 Not Found) - 사용자 정보 불일치
```json
{
  "success": false,
  "message": "일치하는 사용자 정보를 찾을 수 없습니다.",
  "data": {
    "suggestion": "이름, 생년월일, 이메일을 다시 확인해주세요."
  }
}
```

#### Response (403 Forbidden) - 승인되지 않은 계정
```json
{
  "success": false,
  "message": "승인되지 않은 계정입니다.",
  "data": {
    "suggestion": "관리자에게 계정 승인을 요청해주세요."
  }
}
```

#### Response (500 Internal Server Error) - 이메일 전송 실패
```json
{
  "success": false,
  "message": "이메일 전송에 실패했습니다.",
  "data": {
    "suggestion": "잠시 후 다시 시도해주세요."
  }
}
```

---

## ✅ 비밀번호 재설정 확인

### POST `/api/auth/confirm-reset`

재설정 토큰을 검증하고 새로운 비밀번호를 설정합니다.

#### Request Body
```json
{
  "token": "64자리_재설정_토큰",
  "newPassword": "NewPassword123!"
}
```

#### Request Parameters
- `token` (string, required): 이메일로 받은 64자리 재설정 토큰
- `newPassword` (string, required): 새로운 비밀번호 (8-100자, 영문 대소문자+숫자+특수문자 포함)

#### Response (200 OK) - 성공
```json
{
  "success": true,
  "message": "비밀번호가 성공적으로 변경되었습니다.",
  "data": {
    "suggestion": "새 비밀번호로 로그인해주세요.",
    "emailSent": true
  }
}
```

#### Response (404 Not Found) - 유효하지 않은 토큰
```json
{
  "success": false,
  "message": "유효하지 않은 재설정 토큰입니다.",
  "data": {
    "suggestion": "비밀번호 재설정을 다시 요청해주세요."
  }
}
```

#### Response (400 Bad Request) - 토큰 만료
```json
{
  "success": false,
  "message": "재설정 토큰이 만료되었습니다.",
  "data": {
    "suggestion": "비밀번호 재설정을 다시 요청해주세요."
  }
}
```

---

## 🔧 유효성 검사 규칙

### 이름 (name)
- **길이**: 2-50자
- **문자**: 한글, 영문, 공백만 허용
- **정규식**: `/^[가-힣a-zA-Z\s]+$/`

### 생년월일 (birthDate)
- **형식**: YYYY-MM-DD
- **정규식**: `/^\d{4}-\d{2}-\d{2}$/`
- **범위**: 1900년 이후 ~ 오늘 이전
- **유효성**: 실제 존재하는 날짜

### 이메일 (email)
- **형식**: 표준 이메일 형식
- **정규화**: 자동으로 이메일 주소 정규화

### 새 비밀번호 (newPassword)
- **길이**: 8-100자
- **요구사항**: 영문 대소문자, 숫자, 특수문자 포함
- **정규식**: `/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/`

### 재설정 토큰 (token)
- **길이**: 정확히 64자
- **형식**: 16진수 문자열 (a-f, 0-9)
- **정규식**: `/^[a-f0-9]{64}$/`

---

## 📝 사용 예시

### 1. 비밀번호 재설정 요청 (cURL)
```bash
curl -X POST http://localhost:5000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "name": "홍길동",
    "birthDate": "1990-01-15",
    "email": "hong@example.com"
  }'
```

### 2. 비밀번호 재설정 확인 (cURL)
```bash
curl -X POST http://localhost:5000/api/auth/confirm-reset \
  -H "Content-Type: application/json" \
  -d '{
    "token": "a1b2c3d4e5f6...",
    "newPassword": "NewPassword123!"
  }'
```

### 3. JavaScript (fetch)
```javascript
const requestPasswordReset = async (name, birthDate, email) => {
  try {
    const response = await fetch('http://localhost:5000/api/auth/reset-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: name,
        birthDate: birthDate,
        email: email
      })
    })
    
    const data = await response.json()
    
    if (data.success) {
      console.log('이메일 발송 완료:', data.message)
      console.log('만료 시간:', data.data.expiresAt)
    } else {
      console.error('재설정 요청 실패:', data.message)
    }
  } catch (error) {
    console.error('API 호출 오류:', error)
  }
}

const confirmPasswordReset = async (token, newPassword) => {
  try {
    const response = await fetch('http://localhost:5000/api/auth/confirm-reset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token: token,
        newPassword: newPassword
      })
    })
    
    const data = await response.json()
    
    if (data.success) {
      console.log('비밀번호 변경 완료:', data.message)
    } else {
      console.error('비밀번호 변경 실패:', data.message)
    }
  } catch (error) {
    console.error('API 호출 오류:', error)
  }
}
```

### 4. React Hook 사용
```javascript
import { useState } from 'react'

const usePasswordReset = () => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const requestReset = async (name, birthDate, email) => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, birthDate, email })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.message || '비밀번호 재설정 요청에 실패했습니다.')
      }
      
      return data
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const confirmReset = async (token, newPassword) => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/auth/confirm-reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, newPassword })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.message || '비밀번호 변경에 실패했습니다.')
      }
      
      return data
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  return { requestReset, confirmReset, isLoading, error }
}

// 컴포넌트에서 사용
const PasswordResetForm = () => {
  const { requestReset, isLoading, error } = usePasswordReset()
  const [resetResult, setResetResult] = useState(null)

  const handleResetRequest = async () => {
    try {
      const result = await requestReset('홍길동', '1990-01-15', 'hong@example.com')
      setResetResult(result)
    } catch (err) {
      console.error('재설정 요청 오류:', err)
    }
  }

  return (
    <div>
      <button onClick={handleResetRequest} disabled={isLoading}>
        {isLoading ? '처리 중...' : '비밀번호 재설정 요청'}
      </button>
      
      {error && <p className="error">{error}</p>}
      
      {resetResult && (
        <div className="success">
          <p>{resetResult.message}</p>
          <p>{resetResult.data.suggestion}</p>
        </div>
      )}
    </div>
  )
}
```

---

## 🗄️ 데이터베이스 스키마

### password_reset_tokens 테이블
```sql
CREATE TABLE password_reset_tokens (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  token VARCHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_token (token),
  INDEX idx_user_id (user_id),
  INDEX idx_expires_at (expires_at)
);
```

### users 테이블 (기존 테이블 활용)
```sql
-- 기존 users 테이블에 birth_date 컬럼이 있다고 가정
-- 만약 없다면 아래 ALTER 문을 실행

ALTER TABLE users ADD COLUMN birth_date DATE AFTER name;

-- 인덱스 추가 (성능 최적화)
CREATE INDEX idx_users_name_birth_email ON users(name, birth_date, email);
```

### 예시 데이터
```sql
-- 사용자 데이터
INSERT INTO users (name, birth_date, email, password, role, status) VALUES
('홍길동', '1990-01-15', 'hong@example.com', 'hashed_password', 'user', 'approved'),
('김철수', '1985-03-20', 'kim@example.com', 'hashed_password', 'user', 'approved');

-- 재설정 토큰 데이터 (예시)
INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES
(1, 'a1b2c3d4e5f6...', '2024-01-15 11:30:00');
```

---

## 🔒 보안 고려사항

### 토큰 보안
- **암호학적 안전성**: 32바이트 랜덤 토큰 (64자 16진수)
- **만료 시간**: 1시간 후 자동 만료
- **일회성**: 사용 후 즉시 삭제
- **HTTPS 필수**: 프로덕션 환경에서 HTTPS 사용

### 개인정보 보호
- **이메일 암호화**: 전송 중 이메일 내용 암호화
- **로그 기록**: 재설정 시도 로그 기록 (민감 정보 제외)
- **Rate Limiting**: IP별 요청 횟수 제한

### 비밀번호 보안
- **강력한 해싱**: bcrypt (salt rounds: 12)
- **복잡도 요구사항**: 영문 대소문자+숫자+특수문자
- **최소 길이**: 8자 이상

---

## ⚡ 성능 최적화

### 인덱싱
```sql
-- 복합 인덱스로 빠른 사용자 조회
CREATE INDEX idx_users_name_birth_email ON users(name, birth_date, email);

-- 토큰 조회 최적화
CREATE INDEX idx_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX idx_reset_tokens_expires ON password_reset_tokens(expires_at);
```

### 캐싱
- **Redis 캐싱**: 자주 조회되는 사용자 정보 캐싱
- **토큰 캐싱**: 활성 토큰 캐싱으로 빠른 검증
- **TTL 설정**: 캐시 만료 시간 설정

### 정리 작업
```sql
-- 만료된 토큰 정리 (스케줄러로 주기적 실행)
DELETE FROM password_reset_tokens WHERE expires_at < NOW();
```

---

## 🚨 에러 처리

### 일반적인 에러 코드
- `400`: 잘못된 요청 (유효성 검사 실패)
- `403`: 승인되지 않은 계정
- `404`: 사용자 정보 불일치 또는 유효하지 않은 토큰
- `500`: 서버 내부 오류

### 에러 응답 예시
```json
{
  "success": false,
  "message": "비밀번호 재설정 중 오류가 발생했습니다.",
  "error": "DATABASE_CONNECTION_ERROR"
}
```

---

## 📧 이메일 템플릿

### 재설정 요청 이메일
```html
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #333;">MetroWork 비밀번호 재설정</h2>
  <p>안녕하세요, <strong>홍길동</strong>님.</p>
  <p>비밀번호 재설정 요청이 접수되었습니다.</p>
  <p>아래 링크를 클릭하여 새로운 비밀번호를 설정해주세요:</p>
  <div style="text-align: center; margin: 30px 0;">
    <a href="http://localhost:3000/reset-password?token=a1b2c3d4..." 
       style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
      비밀번호 재설정하기
    </a>
  </div>
  <p style="color: #666; font-size: 14px;">
    이 링크는 1시간 후에 만료됩니다.<br>
    본인이 요청하지 않았다면 이 이메일을 무시하세요.
  </p>
</div>
```

### 변경 완료 이메일
```html
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #333;">비밀번호 변경 완료</h2>
  <p>안녕하세요, <strong>홍길동</strong>님.</p>
  <p>비밀번호가 성공적으로 변경되었습니다.</p>
  <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <p style="margin: 0; color: #666;">
      변경 시간: 2024-01-15 10:30:00<br>
      변경된 비밀번호는 안전하게 암호화되어 저장되었습니다.
    </p>
  </div>
  <p style="color: #666; font-size: 14px;">
    본인이 변경하지 않았다면 즉시 관리자에게 연락해주세요.
  </p>
</div>
```

---

## 📊 모니터링

### 로그 기록
```javascript
// 비밀번호 재설정 요청 로그
{
  "timestamp": "2024-01-15T10:30:00Z",
  "action": "password_reset_request",
  "name": "홍길동",
  "email": "hong@example.com",
  "ip": "192.168.1.100",
  "userAgent": "Mozilla/5.0...",
  "result": "email_sent"
}

// 비밀번호 변경 로그
{
  "timestamp": "2024-01-15T10:35:00Z",
  "action": "password_reset_confirm",
  "userId": 1,
  "ip": "192.168.1.100",
  "userAgent": "Mozilla/5.0...",
  "result": "success"
}
```

### 메트릭 수집
- **재설정 요청 수**: 시간별 재설정 요청 수
- **이메일 전송 성공률**: 이메일 전송 성공 비율
- **토큰 사용률**: 발급된 토큰 중 실제 사용된 비율
- **에러율**: 각 단계별 에러 발생 비율

---

## 🔄 향후 확장 계획

### 추가 기능
- **SMS 인증**: 이메일 대신 SMS로 인증 코드 발송
- **보안 질문**: 추가적인 보안 질문을 통한 본인 확인
- **2단계 인증**: 비밀번호 재설정 시 2단계 인증 추가

### 개선 사항
- **토큰 만료 시간 조정**: 사용자 설정에 따른 만료 시간 조정
- **재설정 이력 관리**: 비밀번호 재설정 이력 추적
- **자동 정리**: 만료된 토큰 자동 삭제 스케줄러

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
# SMTP 설정
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# 프론트엔드 URL
FRONTEND_URL=http://localhost:3000

# 데이터베이스 설정
DB_HOST=localhost
DB_PORT=3306
DB_NAME=metrowork
DB_USER=root
DB_PASSWORD=your-password
```

### 의존성 설치
```bash
npm install bcryptjs nodemailer express-validator
npm install --save-dev @types/bcryptjs @types/nodemailer
``` 