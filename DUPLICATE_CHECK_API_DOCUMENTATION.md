# MetroWork Duplicate Check API Documentation

## 📋 이름+생년월일 중복 확인 API

### 기본 정보
- **Base URL**: `http://localhost:5000/api/auth`
- **Content-Type**: `application/json`
- **인증**: 불필요 (공개 API)

---

## 🔍 이름+생년월일 중복 확인

### POST `/api/auth/check-duplicate`

회원가입 전 이름과 생년월일의 중복 여부를 확인합니다.

#### Request Body
```json
{
  "name": "홍길동",
  "birthDate": "1990-01-15"
}
```

#### Request Parameters
- `name` (string, required): 사용자 이름 (2-50자, 한글/영문/공백만 허용)
- `birthDate` (string, required): 생년월일 (YYYY-MM-DD 형식)

#### Response (200 OK) - 중복된 경우
```json
{
  "success": true,
  "isDuplicate": true,
  "message": "이미 가입된 사용자입니다.",
  "data": {
    "duplicateInfo": {
      "name": "홍길동",
      "email": "hong@example.com",
      "status": "approved"
    },
    "suggestion": "비밀번호 찾기를 이용해주세요.",
    "helpText": "가입 시 사용한 이메일로 비밀번호를 재설정할 수 있습니다."
  }
}
```

#### Response (200 OK) - 중복되지 않은 경우
```json
{
  "success": true,
  "isDuplicate": false,
  "message": "사용 가능한 정보입니다.",
  "data": {
    "suggestion": "회원가입을 진행해주세요."
  }
}
```

#### Response (400 Bad Request) - 유효성 검사 실패
```json
{
  "success": false,
  "message": "입력 데이터가 올바르지 않습니다.",
  "errors": [
    {
      "type": "field",
      "value": "홍",
      "msg": "이름은 2-50자 사이여야 합니다.",
      "path": "name",
      "location": "body"
    }
  ]
}
```

#### Response (500 Internal Server Error)
```json
{
  "success": false,
  "message": "중복 확인 중 오류가 발생했습니다."
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

---

## 📝 사용 예시

### 1. cURL 사용
```bash
curl -X POST http://localhost:5000/api/auth/check-duplicate \
  -H "Content-Type: application/json" \
  -d '{
    "name": "홍길동",
    "birthDate": "1990-01-15"
  }'
```

### 2. JavaScript (fetch)
```javascript
const checkDuplicate = async (name, birthDate) => {
  try {
    const response = await fetch('http://localhost:5000/api/auth/check-duplicate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: name,
        birthDate: birthDate
      })
    })
    
    const data = await response.json()
    
    if (data.success) {
      if (data.isDuplicate) {
        console.log('중복된 사용자:', data.data.duplicateInfo)
        console.log('제안:', data.data.suggestion)
      } else {
        console.log('사용 가능한 정보')
        console.log('제안:', data.data.suggestion)
      }
    }
  } catch (error) {
    console.error('API 호출 오류:', error)
  }
}

// 사용 예시
checkDuplicate('홍길동', '1990-01-15')
```

### 3. React Hook 사용
```javascript
import { useState } from 'react'

const useDuplicateCheck = () => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const checkDuplicate = async (name, birthDate) => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/auth/check-duplicate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, birthDate })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.message || '중복 확인에 실패했습니다.')
      }
      
      return data
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  return { checkDuplicate, isLoading, error }
}

// 컴포넌트에서 사용
const RegisterForm = () => {
  const { checkDuplicate, isLoading, error } = useDuplicateCheck()
  const [duplicateResult, setDuplicateResult] = useState(null)

  const handleDuplicateCheck = async () => {
    try {
      const result = await checkDuplicate('홍길동', '1990-01-15')
      setDuplicateResult(result)
    } catch (err) {
      console.error('중복 확인 오류:', err)
    }
  }

  return (
    <div>
      <button onClick={handleDuplicateCheck} disabled={isLoading}>
        {isLoading ? '확인 중...' : '중복 확인'}
      </button>
      
      {error && <p className="error">{error}</p>}
      
      {duplicateResult && (
        <div>
          {duplicateResult.isDuplicate ? (
            <div className="warning">
              <p>{duplicateResult.message}</p>
              <p>{duplicateResult.data.suggestion}</p>
              <p>{duplicateResult.data.helpText}</p>
            </div>
          ) : (
            <div className="success">
              <p>{duplicateResult.message}</p>
              <p>{duplicateResult.data.suggestion}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

---

## 🗄️ 데이터베이스 스키마

### users 테이블 (기존 테이블 활용)
```sql
-- 기존 users 테이블에 birth_date 컬럼이 있다고 가정
-- 만약 없다면 아래 ALTER 문을 실행

ALTER TABLE users ADD COLUMN birth_date DATE AFTER name;

-- 인덱스 추가 (성능 최적화)
CREATE INDEX idx_users_name_birth ON users(name, birth_date);
```

### 예시 데이터
```sql
INSERT INTO users (name, birth_date, email, password, role, status) VALUES
('홍길동', '1990-01-15', 'hong@example.com', 'hashed_password', 'user', 'approved'),
('김철수', '1985-03-20', 'kim@example.com', 'hashed_password', 'user', 'approved'),
('이영희', '1992-07-10', 'lee@example.com', 'hashed_password', 'user', 'pending');
```

---

## 🔒 보안 고려사항

### 개인정보 보호
- **이메일 마스킹**: 중복 시 이메일 주소 일부만 표시
- **상세 정보 제한**: 민감한 정보는 노출하지 않음
- **로그 기록**: 중복 확인 시도 로그 기록

### 요청 제한
- **Rate Limiting**: IP별 요청 횟수 제한
- **입력 검증**: 엄격한 유효성 검사
- **SQL Injection 방지**: Prepared Statement 사용

---

## ⚡ 성능 최적화

### 인덱싱
```sql
-- 복합 인덱스로 빠른 조회
CREATE INDEX idx_users_name_birth ON users(name, birth_date);

-- 단일 컬럼 인덱스 (필요시)
CREATE INDEX idx_users_name ON users(name);
CREATE INDEX idx_users_birth_date ON users(birth_date);
```

### 캐싱
- **Redis 캐싱**: 자주 조회되는 중복 결과 캐싱
- **TTL 설정**: 캐시 만료 시간 설정
- **캐시 무효화**: 사용자 정보 변경 시 캐시 삭제

---

## 🚨 에러 처리

### 일반적인 에러 코드
- `400`: 잘못된 요청 (유효성 검사 실패)
- `500`: 서버 내부 오류

### 에러 응답 예시
```json
{
  "success": false,
  "message": "중복 확인 중 오류가 발생했습니다.",
  "error": "DATABASE_CONNECTION_ERROR"
}
```

---

## 📊 모니터링

### 로그 기록
```javascript
// 중복 확인 시도 로그
{
  "timestamp": "2024-01-15T10:30:00Z",
  "action": "duplicate_check",
  "name": "홍길동",
  "birthDate": "1990-01-15",
  "ip": "192.168.1.100",
  "userAgent": "Mozilla/5.0...",
  "result": "duplicate_found"
}
```

### 메트릭 수집
- **요청 수**: 시간별 중복 확인 요청 수
- **중복률**: 중복 발견 비율
- **응답 시간**: API 응답 시간 통계
- **에러율**: 에러 발생 비율

---

## 🔄 향후 확장 계획

### 추가 기능
- **이메일 중복 확인**: 이메일 주소 중복 확인
- **전화번호 중복 확인**: 전화번호 중복 확인
- **일괄 중복 확인**: 여러 정보 동시 확인

### 개선 사항
- **퍼지 매칭**: 이름의 유사도 기반 중복 확인
- **음성 인식**: 음성 입력 지원
- **OCR 지원**: 신분증 사진으로 정보 추출

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