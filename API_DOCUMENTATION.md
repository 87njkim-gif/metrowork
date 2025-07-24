# MetroWork API Documentation

## 🔐 인증 시스템 API

### 기본 정보
- **Base URL**: `http://localhost:5000/api`
- **Content-Type**: `application/json`
- **Authorization**: `Bearer {token}` (보호된 라우트)

---

## 📝 회원가입

### POST `/api/auth/register`

새로운 사용자를 등록합니다. 등록 후 관리자 승인이 필요합니다.

#### Request Body
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "홍길동",
  "phone": "010-1234-5678",
  "department": "개발팀",
  "position": "개발자"
}
```

#### Response (201 Created)
```json
{
  "success": true,
  "message": "회원가입이 완료되었습니다. 관리자 승인을 기다려주세요.",
  "data": {
    "user": {
      "id": 2,
      "email": "user@example.com",
      "name": "홍길동",
      "role": "user",
      "status": "pending",
      "phone": "010-1234-5678",
      "department": "개발팀",
      "position": "개발자",
      "created_at": "2024-01-15T10:30:00.000Z"
    },
    "requiresApproval": true
  }
}
```

#### Validation Rules
- `email`: 유효한 이메일 형식
- `password`: 최소 6자, 영문+숫자 포함
- `name`: 2-50자
- `phone`: 선택사항, 전화번호 형식
- `department`: 선택사항, 최대 100자
- `position`: 선택사항, 최대 100자

---

## 🔑 로그인

### POST `/api/auth/login`

사용자 로그인 및 JWT 토큰 발급

#### Request Body
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "message": "로그인이 완료되었습니다.",
  "data": {
    "user": {
      "id": 2,
      "email": "user@example.com",
      "name": "홍길동",
      "role": "user",
      "status": "approved",
      "phone": "010-1234-5678",
      "department": "개발팀",
      "position": "개발자",
      "last_login_at": "2024-01-15T10:30:00.000Z",
      "created_at": "2024-01-15T10:30:00.000Z",
      "updated_at": "2024-01-15T10:30:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "abc123def456...",
    "expiresIn": 604800000
  }
}
```

#### Error Responses
- `401`: 이메일/비밀번호 오류
- `403`: 승인되지 않은 계정

---

## 🔄 토큰 갱신

### POST `/api/auth/refresh`

리프레시 토큰을 사용하여 새로운 액세스 토큰 발급

#### Request Body
```json
{
  "refreshToken": "abc123def456..."
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "message": "토큰이 갱신되었습니다.",
  "data": {
    "user": { ... },
    "token": "new_jwt_token...",
    "refreshToken": "new_refresh_token...",
    "expiresIn": 604800000
  }
}
```

---

## 🚪 로그아웃

### POST `/api/auth/logout`

사용자 로그아웃 및 리프레시 토큰 무효화

#### Request Body
```json
{
  "refreshToken": "abc123def456..."
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "message": "로그아웃이 완료되었습니다."
}
```

---

## 👤 현재 사용자 정보

### GET `/api/auth/me`

현재 로그인한 사용자 정보 조회

#### Headers
```
Authorization: Bearer {token}
```

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 2,
      "email": "user@example.com",
      "name": "홍길동",
      "role": "user",
      "status": "approved",
      "phone": "010-1234-5678",
      "department": "개발팀",
      "position": "개발자",
      "last_login_at": "2024-01-15T10:30:00.000Z",
      "created_at": "2024-01-15T10:30:00.000Z",
      "updated_at": "2024-01-15T10:30:00.000Z"
    }
  }
}
```

---

## 👨‍💼 관리자 API

### 사용자 승인/거부

#### PUT `/api/admin/approve/:userId`

관리자가 사용자 승인/거부 처리

#### Headers
```
Authorization: Bearer {admin_token}
```

#### Request Body
```json
{
  "status": "approved"
}
```

또는

```json
{
  "status": "rejected",
  "rejection_reason": "부적절한 정보"
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "message": "사용자가 승인되었습니다.",
  "data": {
    "user": {
      "id": 2,
      "email": "user@example.com",
      "name": "홍길동",
      "role": "user",
      "status": "approved",
      "approved_at": "2024-01-15T10:30:00.000Z",
      "approved_by": 1,
      "approver_name": "시스템 관리자"
    }
  }
}
```

---

### 대기 중인 사용자 목록

#### GET `/api/admin/pending-users`

승인 대기 중인 사용자 목록 조회

#### Headers
```
Authorization: Bearer {admin_token}
```

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": 2,
        "email": "user@example.com",
        "name": "홍길동",
        "role": "user",
        "status": "pending",
        "phone": "010-1234-5678",
        "department": "개발팀",
        "position": "개발자",
        "created_at": "2024-01-15T10:30:00.000Z"
      }
    ],
    "total": 1
  }
}
```

---

### 모든 사용자 목록

#### GET `/api/admin/users`

모든 사용자 목록 조회 (페이지네이션, 검색, 필터링 지원)

#### Headers
```
Authorization: Bearer {admin_token}
```

#### Query Parameters
- `page`: 페이지 번호 (기본값: 1)
- `limit`: 페이지당 항목 수 (기본값: 20)
- `search`: 검색어 (이름, 이메일, 부서)
- `status`: 상태 필터 (pending, approved, rejected, inactive)
- `role`: 역할 필터 (admin, user)

#### Example Request
```
GET /api/admin/users?page=1&limit=10&search=홍길동&status=approved
```

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": 2,
        "email": "user@example.com",
        "name": "홍길동",
        "role": "user",
        "status": "approved",
        "phone": "010-1234-5678",
        "department": "개발팀",
        "position": "개발자",
        "created_at": "2024-01-15T10:30:00.000Z",
        "approved_at": "2024-01-15T10:30:00.000Z",
        "approved_by": 1,
        "approver_name": "시스템 관리자",
        "last_login_at": "2024-01-15T10:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 1,
      "totalPages": 1
    }
  }
}
```

---

### 사용자 상태 변경

#### PUT `/api/admin/users/:userId/status`

사용자 상태 변경 (승인/거부/비활성화)

#### Headers
```
Authorization: Bearer {admin_token}
```

#### Request Body
```json
{
  "status": "inactive"
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "message": "사용자 상태가 비활성화되었습니다.",
  "data": {
    "user": {
      "id": 2,
      "email": "user@example.com",
      "name": "홍길동",
      "role": "user",
      "status": "inactive",
      "created_at": "2024-01-15T10:30:00.000Z"
    }
  }
}
```

---

### 사용자 역할 변경

#### PUT `/api/admin/users/:userId/role`

사용자 역할 변경 (관리자/일반 사용자)

#### Headers
```
Authorization: Bearer {admin_token}
```

#### Request Body
```json
{
  "role": "admin"
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "message": "사용자 역할이 관리자로 변경되었습니다."
}
```

---

### 관리자 대시보드

#### GET `/api/admin/dashboard`

관리자 대시보드 통계 데이터

#### Headers
```
Authorization: Bearer {admin_token}
```

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "userStats": {
      "total_users": 10,
      "pending_users": 3,
      "approved_users": 6,
      "rejected_users": 1,
      "inactive_users": 0,
      "admin_users": 2,
      "regular_users": 8
    },
    "recentUsers": [
      {
        "id": 10,
        "email": "newuser@example.com",
        "name": "새사용자",
        "role": "user",
        "status": "pending",
        "created_at": "2024-01-15T10:30:00.000Z"
      }
    ],
    "departmentStats": [
      {
        "department": "개발팀",
        "user_count": 5,
        "approved_count": 4
      },
      {
        "department": "디자인팀",
        "user_count": 3,
        "approved_count": 2
      }
    ]
  }
}
```

---

## 🔒 권한 체크 미들웨어

### 사용법

```typescript
import { authenticate, requireAdmin, requireApproved } from '../middleware/auth'

// 기본 인증
router.get('/protected', authenticate, (req, res) => {
  // req.user에 사용자 정보 포함
})

// 관리자 권한 체크
router.get('/admin-only', authenticate, requireAdmin, (req, res) => {
  // 관리자만 접근 가능
})

// 승인된 사용자만
router.get('/approved-only', authenticate, requireApproved, (req, res) => {
  // 승인된 사용자만 접근 가능
})

// 역할별 권한 체크
router.get('/admin-or-user', authenticate, requireRole(['admin', 'user']), (req, res) => {
  // admin 또는 user 역할만 접근 가능
})
```

---

## 📊 상태 코드

| 코드 | 의미 | 설명 |
|------|------|------|
| 200 | OK | 요청 성공 |
| 201 | Created | 리소스 생성 성공 |
| 400 | Bad Request | 잘못된 요청 |
| 401 | Unauthorized | 인증 필요 |
| 403 | Forbidden | 권한 없음 |
| 404 | Not Found | 리소스 없음 |
| 409 | Conflict | 중복 데이터 |
| 500 | Internal Server Error | 서버 오류 |

---

## 🔐 보안 특징

### JWT 토큰
- **알고리즘**: HS256
- **만료 시간**: 7일 (설정 가능)
- **리프레시 토큰**: 30일

### 비밀번호 보안
- **해시 알고리즘**: bcrypt
- **Salt Rounds**: 12 (설정 가능)
- **정책**: 영문+숫자 포함, 최소 6자

### 세션 관리
- 리프레시 토큰 기반 세션 관리
- 토큰 무효화 지원
- 만료된 세션 자동 정리

---

## 🚀 초기 설정

### 1. 환경 변수 설정
```env
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=7d
BCRYPT_ROUNDS=12
```

### 2. 초기 관리자 계정
- **이메일**: admin@metrowork.com
- **비밀번호**: admin123
- **역할**: admin
- **상태**: approved

### 3. 데이터베이스 실행
```bash
# 데이터베이스 스키마 실행
mysql -u root -p < database_schema.sql

# 서버 실행
npm run dev
```

---

## 📝 사용 예시

### 회원가입 → 승인 → 로그인 플로우

1. **회원가입**
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123",
    "name": "홍길동",
    "department": "개발팀"
  }'
```

2. **관리자 로그인**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@metrowork.com",
    "password": "admin123"
  }'
```

3. **사용자 승인**
```bash
curl -X PUT http://localhost:5000/api/admin/approve/2 \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "approved"
  }'
```

4. **사용자 로그인**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
``` 