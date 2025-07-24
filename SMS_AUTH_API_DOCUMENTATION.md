# MetroWork SMS 인증 비밀번호 찾기 API 문서

## 📋 개요

SMS 인증을 사용한 비밀번호 찾기 시스템은 전화번호를 통한 본인 확인 후 SMS 인증번호로 비밀번호를 재설정하는 안전한 방법을 제공합니다.

### 🎯 주요 기능
- **본인 확인**: 이름+생년월일+전화번호로 사용자 검증
- **SMS 인증**: 6자리 랜덤 인증번호 발송
- **임시 토큰**: 인증 완료 후 임시 토큰 발급
- **비밀번호 재설정**: 임시 토큰으로 새 비밀번호 설정
- **모듈화된 SMS 서비스**: 개발/운영 환경 분리

---

## 🚀 API 엔드포인트

### 기본 정보
- **Base URL**: `http://localhost:5000/api/auth`
- **Content-Type**: `application/json`
- **인증**: 불필요 (공개 API)

---

## 1️⃣ 본인 확인

### POST `/api/auth/verify-user`

이름, 생년월일, 전화번호로 본인을 확인하고 SMS 인증번호를 발송합니다.

#### Request Body
```json
{
  "name": "홍길동",
  "birthDate": "1990-01-15",
  "phoneNumber": "010-1234-5678"
}
```

#### Request Parameters
- `name` (string, required): 사용자 이름 (2-50자, 한글/영문/공백만 허용)
- `birthDate` (string, required): 생년월일 (YYYY-MM-DD 형식)
- `phoneNumber` (string, required): 전화번호 (010-1234-5678 형식)

#### Response (200 OK) - 성공
```json
{
  "success": true,
  "message": "인증번호가 발송되었습니다.",
  "data": {
    "phoneNumber": "010-1234-5678",
    "expiresAt": "2024-01-15T11:35:00.000Z",
    "suggestion": "5분 이내에 인증번호를 입력해주세요."
  }
}
```

#### Response (404 Not Found) - 사용자 정보 불일치
```json
{
  "success": false,
  "message": "일치하는 사용자 정보를 찾을 수 없습니다.",
  "data": {
    "suggestion": "이름, 생년월일, 전화번호를 다시 확인해주세요."
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

---

## 2️⃣ SMS 인증번호 발송

### POST `/api/auth/send-sms`

전화번호로 SMS 인증번호를 재발송합니다.

#### Request Body
```json
{
  "phoneNumber": "010-1234-5678"
}
```

#### Request Parameters
- `phoneNumber` (string, required): 전화번호 (010-1234-5678 형식)

#### Response (200 OK) - 성공
```json
{
  "success": true,
  "message": "인증번호가 발송되었습니다.",
  "data": {
    "phoneNumber": "010-1234-5678",
    "expiresAt": "2024-01-15T11:40:00.000Z",
    "suggestion": "5분 이내에 인증번호를 입력해주세요."
  }
}
```

#### Response (400 Bad Request) - 이미 발송된 인증번호
```json
{
  "success": false,
  "message": "이미 발송된 인증번호가 있습니다.",
  "data": {
    "timeLeft": 180,
    "suggestion": "180초 후에 다시 요청해주세요."
  }
}
```

#### Response (404 Not Found) - 등록되지 않은 전화번호
```json
{
  "success": false,
  "message": "등록되지 않은 전화번호입니다.",
  "data": {
    "suggestion": "회원가입을 먼저 진행해주세요."
  }
}
```

---

## 3️⃣ 인증번호 확인

### POST `/api/auth/verify-sms`

SMS 인증번호를 확인하고 임시 토큰을 발급합니다.

#### Request Body
```json
{
  "phoneNumber": "010-1234-5678",
  "verificationCode": "123456"
}
```

#### Request Parameters
- `phoneNumber` (string, required): 전화번호 (010-1234-5678 형식)
- `verificationCode` (string, required): 6자리 인증번호

#### Response (200 OK) - 성공
```json
{
  "success": true,
  "message": "인증이 완료되었습니다.",
  "data": {
    "tempToken": "64자리_임시_토큰",
    "expiresAt": "2024-01-15T11:50:00.000Z",
    "suggestion": "새 비밀번호를 입력해주세요."
  }
}
```

#### Response (400 Bad Request) - 유효하지 않은 인증번호
```json
{
  "success": false,
  "message": "유효하지 않은 인증번호입니다.",
  "data": {
    "suggestion": "인증번호를 다시 확인해주세요."
  }
}
```

---

## 4️⃣ 비밀번호 재설정

### POST `/api/auth/reset-password`

임시 토큰을 검증하고 새로운 비밀번호를 설정합니다.

#### Request Body
```json
{
  "tempToken": "64자리_임시_토큰",
  "newPassword": "NewPassword123!"
}
```

#### Request Parameters
- `tempToken` (string, required): 인증 완료 후 발급된 임시 토큰
- `newPassword` (string, required): 새로운 비밀번호 (8-100자, 영문 대소문자+숫자+특수문자 포함)

#### Response (200 OK) - 성공
```json
{
  "success": true,
  "message": "비밀번호가 성공적으로 변경되었습니다.",
  "data": {
    "suggestion": "새 비밀번호로 로그인해주세요.",
    "smsSent": true
  }
}
```

#### Response (404 Not Found) - 유효하지 않은 토큰
```json
{
  "success": false,
  "message": "유효하지 않은 토큰입니다.",
  "data": {
    "suggestion": "인증을 다시 진행해주세요."
  }
}
```

#### Response (400 Bad Request) - 토큰 만료
```json
{
  "success": false,
  "message": "토큰이 만료되었습니다.",
  "data": {
    "suggestion": "인증을 다시 진행해주세요."
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

### 전화번호 (phoneNumber)
- **형식**: 010-1234-5678
- **정규식**: `/^01[0-9]-\d{3,4}-\d{4}$/`
- **예시**: 010-1234-5678, 010-123-4567

### 인증번호 (verificationCode)
- **길이**: 정확히 6자리
- **형식**: 숫자만
- **정규식**: `/^\d{6}$/`

### 임시 토큰 (tempToken)
- **길이**: 정확히 64자
- **형식**: 16진수 문자열 (a-f, 0-9)
- **정규식**: `/^[a-f0-9]{64}$/`

### 새 비밀번호 (newPassword)
- **길이**: 8-100자
- **요구사항**: 영문 대소문자, 숫자, 특수문자 포함
- **정규식**: `/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/`

---

## 📝 사용 예시

### 1. 전체 플로우 (cURL)
```bash
# 1단계: 본인 확인
curl -X POST http://localhost:5000/api/auth/verify-user \
  -H "Content-Type: application/json" \
  -d '{
    "name": "홍길동",
    "birthDate": "1990-01-15",
    "phoneNumber": "010-1234-5678"
  }'

# 2단계: 인증번호 확인
curl -X POST http://localhost:5000/api/auth/verify-sms \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "010-1234-5678",
    "verificationCode": "123456"
  }'

# 3단계: 비밀번호 재설정
curl -X POST http://localhost:5000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "tempToken": "64자리_임시_토큰",
    "newPassword": "NewPassword123!"
  }'
```

### 2. JavaScript (fetch)
```javascript
const smsPasswordReset = async () => {
  try {
    // 1단계: 본인 확인
    const verifyResponse = await fetch('http://localhost:5000/api/auth/verify-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '홍길동',
        birthDate: '1990-01-15',
        phoneNumber: '010-1234-5678'
      })
    })
    
    const verifyData = await verifyResponse.json()
    console.log('본인 확인 결과:', verifyData)
    
    // 2단계: 인증번호 확인
    const verifySMSResponse = await fetch('http://localhost:5000/api/auth/verify-sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneNumber: '010-1234-5678',
        verificationCode: '123456'
      })
    })
    
    const verifySMSData = await verifySMSResponse.json()
    console.log('SMS 인증 결과:', verifySMSData)
    
    // 3단계: 비밀번호 재설정
    const resetResponse = await fetch('http://localhost:5000/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tempToken: verifySMSData.data.tempToken,
        newPassword: 'NewPassword123!'
      })
    })
    
    const resetData = await resetResponse.json()
    console.log('비밀번호 재설정 결과:', resetData)
    
  } catch (error) {
    console.error('SMS 비밀번호 재설정 오류:', error)
  }
}
```

### 3. React Hook 사용
```javascript
import { useState } from 'react'

const useSMSPasswordReset = () => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const verifyUser = async (name, birthDate, phoneNumber) => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/auth/verify-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, birthDate, phoneNumber })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.message || '본인 확인에 실패했습니다.')
      }
      
      return data
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const verifySMS = async (phoneNumber, verificationCode) => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/auth/verify-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber, verificationCode })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.message || 'SMS 인증에 실패했습니다.')
      }
      
      return data
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const resetPassword = async (tempToken, newPassword) => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempToken, newPassword })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.message || '비밀번호 재설정에 실패했습니다.')
      }
      
      return data
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  return { verifyUser, verifySMS, resetPassword, isLoading, error }
}
```

---

## 🗄️ 데이터베이스 스키마

### sms_verifications 테이블
```sql
CREATE TABLE sms_verifications (
  id INT PRIMARY KEY AUTO_INCREMENT,
  phone_number VARCHAR(15) NOT NULL,
  verification_code VARCHAR(6) NOT NULL,
  expires_at DATETIME NOT NULL,
  user_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_phone_number (phone_number),
  INDEX idx_verification_code (verification_code),
  INDEX idx_expires_at (expires_at),
  INDEX idx_user_id (user_id)
);
```

### temp_tokens 테이블
```sql
CREATE TABLE temp_tokens (
  id INT PRIMARY KEY AUTO_INCREMENT,
  token VARCHAR(64) NOT NULL UNIQUE,
  user_id INT NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_token (token),
  INDEX idx_user_id (user_id),
  INDEX idx_expires_at (expires_at)
);
```

### users 테이블 (기존 테이블에 phone_number 컬럼 추가)
```sql
-- 기존 users 테이블에 phone_number 컬럼이 있다고 가정
-- 만약 없다면 아래 ALTER 문을 실행

ALTER TABLE users ADD COLUMN phone_number VARCHAR(15) AFTER email;

-- 인덱스 추가 (성능 최적화)
CREATE INDEX idx_users_name_birth_phone ON users(name, birth_date, phone_number);
CREATE INDEX idx_users_phone_number ON users(phone_number);
```

### 예시 데이터
```sql
-- 사용자 데이터
INSERT INTO users (name, birth_date, phone_number, email, password, role, status) VALUES
('홍길동', '1990-01-15', '010-1234-5678', 'hong@example.com', 'hashed_password', 'user', 'approved'),
('김철수', '1985-03-20', '010-2345-6789', 'kim@example.com', 'hashed_password', 'user', 'approved');

-- SMS 인증 데이터 (예시)
INSERT INTO sms_verifications (phone_number, verification_code, expires_at, user_id) VALUES
('010-1234-5678', '123456', '2024-01-15 11:35:00', 1);

-- 임시 토큰 데이터 (예시)
INSERT INTO temp_tokens (token, user_id, expires_at) VALUES
('a1b2c3d4e5f6...', 1, '2024-01-15 11:50:00');
```

---

## 📱 SMS 서비스 모듈화

### 개발 환경 설정
```bash
# .env 파일
SMS_PROVIDER=development
```

### 운영 환경 설정

#### Twilio 설정
```bash
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_FROM_NUMBER=+1234567890
```

#### AWS SNS 설정
```bash
SMS_PROVIDER=aws-sns
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=ap-northeast-2
```

#### 네이버 클라우드 플랫폼 설정
```bash
SMS_PROVIDER=naver-cloud
NAVER_CLOUD_ACCESS_KEY=your_access_key
NAVER_CLOUD_SECRET_KEY=your_secret_key
NAVER_CLOUD_SMS_SERVICE_ID=your_service_id
NAVER_CLOUD_SMS_FROM_NUMBER=01012345678
```

### SMS 서비스 사용법
```javascript
import { sendSMS, sendVerificationCode, checkSMSServiceConfig } from '../services/smsService'

// SMS 서비스 설정 확인
checkSMSServiceConfig()

// 일반 SMS 발송
const success = await sendSMS('010-1234-5678', '안녕하세요!')

// 인증번호 SMS 발송
const success = await sendVerificationCode('010-1234-5678', '123456')
```

---

## 🔒 보안 고려사항

### 토큰 보안
- **암호학적 안전성**: 32바이트 랜덤 토큰 (64자 16진수)
- **만료 시간**: 인증번호 5분, 임시 토큰 10분
- **일회성**: 사용 후 즉시 삭제
- **HTTPS 필수**: 프로덕션 환경에서 HTTPS 사용

### SMS 보안
- **인증번호 생성**: 6자리 랜덤 숫자
- **재발송 제한**: 기존 인증번호 만료 전 재발송 방지
- **시도 횟수 제한**: IP별 요청 횟수 제한
- **개인정보 보호**: SMS 내용에 민감 정보 포함 금지

### 비밀번호 보안
- **강력한 해싱**: bcrypt (salt rounds: 12)
- **복잡도 요구사항**: 영문 대소문자+숫자+특수문자
- **최소 길이**: 8자 이상

---

## ⚡ 성능 최적화

### 인덱싱
```sql
-- 복합 인덱스로 빠른 사용자 조회
CREATE INDEX idx_users_name_birth_phone ON users(name, birth_date, phone_number);

-- SMS 인증 조회 최적화
CREATE INDEX idx_sms_verifications_phone_code ON sms_verifications(phone_number, verification_code);
CREATE INDEX idx_sms_verifications_expires ON sms_verifications(expires_at);

-- 임시 토큰 조회 최적화
CREATE INDEX idx_temp_tokens_token ON temp_tokens(token);
CREATE INDEX idx_temp_tokens_expires ON temp_tokens(expires_at);
```

### 캐싱
- **Redis 캐싱**: 자주 조회되는 사용자 정보 캐싱
- **토큰 캐싱**: 활성 토큰 캐싱으로 빠른 검증
- **TTL 설정**: 캐시 만료 시간 설정

### 정리 작업
```sql
-- 만료된 인증 정보 정리 (스케줄러로 주기적 실행)
DELETE FROM sms_verifications WHERE expires_at < NOW();

-- 만료된 임시 토큰 정리
DELETE FROM temp_tokens WHERE expires_at < NOW();
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
  "message": "SMS 인증 중 오류가 발생했습니다.",
  "error": "SMS_SERVICE_ERROR"
}
```

---

## 📊 모니터링

### 로그 기록
```javascript
// SMS 인증 요청 로그
{
  "timestamp": "2024-01-15T10:30:00Z",
  "action": "sms_verification_request",
  "name": "홍길동",
  "phoneNumber": "010-1234-5678",
  "ip": "192.168.1.100",
  "userAgent": "Mozilla/5.0...",
  "result": "sms_sent"
}

// SMS 인증 완료 로그
{
  "timestamp": "2024-01-15T10:35:00Z",
  "action": "sms_verification_complete",
  "phoneNumber": "010-1234-5678",
  "ip": "192.168.1.100",
  "userAgent": "Mozilla/5.0...",
  "result": "success"
}
```

### 메트릭 수집
- **인증 요청 수**: 시간별 SMS 인증 요청 수
- **SMS 발송 성공률**: SMS 발송 성공 비율
- **인증 완료율**: 인증번호 입력 완료 비율
- **에러율**: 각 단계별 에러 발생 비율

---

## 🔄 향후 확장 계획

### 추가 기능
- **음성 인증**: SMS 대신 음성으로 인증번호 발송
- **앱 푸시 알림**: 모바일 앱 푸시로 인증번호 전송
- **2단계 인증**: SMS 인증 후 추가 보안 단계

### 개선 사항
- **인증번호 만료 시간 조정**: 사용자 설정에 따른 만료 시간 조정
- **인증 이력 관리**: SMS 인증 이력 추적
- **자동 정리**: 만료된 데이터 자동 삭제 스케줄러

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
# SMS 서비스 설정
SMS_PROVIDER=development

# Twilio 설정 (선택사항)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_FROM_NUMBER=+1234567890

# AWS SNS 설정 (선택사항)
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=ap-northeast-2

# 네이버 클라우드 설정 (선택사항)
NAVER_CLOUD_ACCESS_KEY=your_access_key
NAVER_CLOUD_SECRET_KEY=your_secret_key
NAVER_CLOUD_SMS_SERVICE_ID=your_service_id
NAVER_CLOUD_SMS_FROM_NUMBER=01012345678

# 데이터베이스 설정
DB_HOST=localhost
DB_PORT=3306
DB_NAME=metrowork
DB_USER=root
DB_PASSWORD=your-password
```

### 의존성 설치
```bash
# 기본 의존성
npm install bcryptjs express-validator

# SMS 서비스 의존성 (선택사항)
npm install twilio aws-sdk axios

# 개발 의존성
npm install --save-dev @types/bcryptjs
``` 