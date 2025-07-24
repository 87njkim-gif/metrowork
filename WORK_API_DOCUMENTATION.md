# MetroWork Work API Documentation

## 📋 엑셀 데이터 기반 업무 처리 API

### 기본 정보
- **Base URL**: `http://localhost:5000/api/work`
- **Content-Type**: `application/json`
- **Authorization**: `Bearer {token}` (모든 라우트)
- **데이터 분리**: 업무 상태는 별도 테이블(work_status)에 저장

---

## ✅ 엑셀 데이터 행 체크/해제

### PUT `/api/work/excel/:rowId/check`

특정 엑셀 행에 대해 완료 상태를 토글하고 처리 정보를 저장합니다.

#### Path Parameters
- `rowId`: 엑셀 데이터 행 ID (number)

#### Request Body
```json
{
  "isCompleted": true,
  "notes": "고객 연락 완료"
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "message": "업무가 완료로 변경되었습니다.",
  "data": {
    "workStatus": {
      "id": 1,
      "excel_data_id": 123,
      "file_id": 1,
      "user_id": 2,
      "is_completed": true,
      "completed_at": "2024-01-15T14:30:00.000Z",
      "completed_by": 2,
      "notes": "고객 연락 완료",
      "created_at": "2024-01-15T14:30:00.000Z",
      "updated_at": "2024-01-15T14:30:00.000Z"
    },
    "action": "completed"
  }
}
```

#### 처리 과정
1. **기존 상태 확인**: 해당 행의 현재 완료 상태 조회
2. **상태 토글**: 완료/미완료 상태 변경
3. **처리 정보 저장**: 완료 시간, 처리자, 메모 저장
4. **활동 로그**: 상태 변경 이력 기록

---

## 📊 완료된 업무 목록 조회

### GET `/api/work/completed`

완료된 업무 목록을 다양한 필터와 함께 조회합니다.

#### Query Parameters
- `page`: 페이지 번호 (기본값: 1)
- `limit`: 페이지당 항목 수 (기본값: 20, 최대: 100)
- `startDate`: 시작 날짜 (YYYY-MM-DD)
- `endDate`: 종료 날짜 (YYYY-MM-DD)
- `userId`: 처리자 ID (optional)
- `fileId`: 파일 ID (optional)
- `search`: 검색어 (업무 내용, 처리자명, 파일명)

#### Example Request
```
GET /api/work/completed?page=1&limit=20&startDate=2024-01-01&endDate=2024-01-15&userId=2&search=고객
```

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "workStatuses": [
      {
        "id": 1,
        "excel_data_id": 123,
        "file_id": 1,
        "user_id": 2,
        "is_completed": true,
        "completed_at": "2024-01-15T14:30:00.000Z",
        "completed_by": 2,
        "notes": "고객 연락 완료",
        "created_at": "2024-01-15T14:30:00.000Z",
        "updated_at": "2024-01-15T14:30:00.000Z",
        "excel_data": {
          "id": 123,
          "row_index": 1,
          "row_data": {
            "name": "홍길동",
            "email": "hong@example.com",
            "phone": "010-1234-5678",
            "department": "개발팀"
          },
          "is_valid": true
        },
        "user": {
          "id": 2,
          "name": "김철수",
          "email": "kim@example.com"
        },
        "file": {
          "id": 1,
          "original_name": "고객데이터_2024.xlsx",
          "description": "2024년 고객 데이터"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8,
      "hasNext": true,
      "hasPrev": false
    },
    "summary": {
      "totalCompleted": 150,
      "todayCompleted": 12,
      "thisWeekCompleted": 45,
      "thisMonthCompleted": 120
    }
  }
}
```

---

## 📅 오늘 업무 날짜 설정

### PUT `/api/work/today-date`

사용자가 지정한 "오늘" 날짜로 체크 작업을 수행할 날짜를 설정합니다.

#### Request Body
```json
{
  "todayDate": "2024-01-15"
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "message": "오늘 날짜가 설정되었습니다.",
  "data": {
    "todayDate": "2024-01-15"
  }
}
```

### GET `/api/work/today-date`

현재 설정된 "오늘" 날짜를 조회합니다.

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "todayDate": "2024-01-15"
  }
}
```

---

## 📈 특정 날짜의 완료된 업무 조회

### GET `/api/work/completed/:date`

특정 날짜에 완료된 업무 목록을 조회합니다.

#### Path Parameters
- `date`: 조회할 날짜 (YYYY-MM-DD)

#### Query Parameters
- `page`: 페이지 번호 (기본값: 1)
- `limit`: 페이지당 항목 수 (기본값: 20)

#### Example Request
```
GET /api/work/completed/2024-01-15?page=1&limit=20
```

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "workStatuses": [
      {
        "id": 1,
        "excel_data_id": 123,
        "file_id": 1,
        "user_id": 2,
        "is_completed": true,
        "completed_at": "2024-01-15T14:30:00.000Z",
        "completed_by": 2,
        "notes": "고객 연락 완료",
        "excel_data": {
          "id": 123,
          "row_index": 1,
          "row_data": {
            "name": "홍길동",
            "email": "hong@example.com"
          },
          "is_valid": true
        },
        "user": {
          "id": 2,
          "name": "김철수",
          "email": "kim@example.com"
        },
        "file": {
          "id": 1,
          "original_name": "고객데이터_2024.xlsx"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 12,
      "totalPages": 1,
      "hasNext": false,
      "hasPrev": false
    },
    "date": "2024-01-15"
  }
}
```

---

## 📊 업무 통계 조회

### GET `/api/work/stats`

전체 업무 통계 정보를 조회합니다.

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalCompleted": 150,
      "todayCompleted": 12,
      "thisWeekCompleted": 45,
      "thisMonthCompleted": 120
    },
    "userStats": [
      {
        "userId": 2,
        "userName": "김철수",
        "totalCompleted": 45,
        "todayCompleted": 5,
        "thisWeekCompleted": 15,
        "thisMonthCompleted": 35,
        "averageCompletionTime": 25,
        "lastCompletedAt": "2024-01-15T16:30:00.000Z"
      }
    ],
    "fileStats": [
      {
        "fileId": 1,
        "fileName": "고객데이터_2024.xlsx",
        "totalRows": 14564,
        "completedRows": 1200,
        "pendingRows": 13364,
        "completionRate": 8.24,
        "lastActivityAt": "2024-01-15T16:30:00.000Z"
      }
    ]
  }
}
```

---

## 🔄 대량 체크/해제

### POST `/api/work/bulk-check`

여러 행을 한 번에 체크/해제합니다.

#### Request Body
```json
{
  "rowIds": [123, 124, 125, 126, 127],
  "isCompleted": true,
  "notes": "일괄 처리 완료"
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "message": "대량 처리가 완료되었습니다. (성공: 5, 실패: 0)",
  "data": {
    "success": 5,
    "failed": 0,
    "errors": []
  }
}
```

#### 제한사항
- **최대 처리 개수**: 100개 행
- **배치 처리**: 개별 행별로 처리하여 일부 실패해도 나머지는 계속 처리

---

## 👤 사용자별 업무 현황 조회

### GET `/api/work/user-status`

현재 사용자의 업무 현황을 조회합니다.

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "todayDate": "2024-01-15",
    "totalItems": 150,
    "completedItems": 45,
    "pendingItems": 105,
    "completionRate": 30.0,
    "todayCompleted": 5,
    "recentWork": [
      {
        "id": 1,
        "excel_data_id": 123,
        "is_completed": true,
        "completed_at": "2024-01-15T16:30:00.000Z",
        "notes": "고객 연락 완료",
        "excel_data": {
          "id": 123,
          "row_index": 1,
          "row_data": {
            "name": "홍길동",
            "email": "hong@example.com"
          }
        }
      }
    ]
  }
}
```

---

## 📝 업무 활동 히스토리 조회

### GET `/api/work/history`

업무 활동 히스토리를 조회합니다.

#### Query Parameters
- `page`: 페이지 번호 (기본값: 1)
- `limit`: 페이지당 항목 수 (기본값: 20)
- `userId`: 사용자 ID (optional)
- `fileId`: 파일 ID (optional)
- `action`: 활동 유형 (completed/uncompleted/note_added)
- `startDate`: 시작 날짜 (YYYY-MM-DD)
- `endDate`: 종료 날짜 (YYYY-MM-DD)

#### Example Request
```
GET /api/work/history?page=1&limit=20&action=completed&startDate=2024-01-01
```

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "activities": [
      {
        "id": 1,
        "excel_data_id": 123,
        "user_id": 2,
        "action": "completed",
        "old_status": false,
        "new_status": true,
        "notes": "고객 연락 완료",
        "created_at": "2024-01-15T16:30:00.000Z",
        "user": {
          "id": 2,
          "name": "김철수"
        },
        "excel_data": {
          "row_index": 1,
          "row_data": {
            "name": "홍길동",
            "email": "hong@example.com"
          }
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

---

## 🔧 데이터베이스 스키마

### work_status 테이블
```sql
CREATE TABLE work_status (
  id INT PRIMARY KEY AUTO_INCREMENT,
  excel_data_id INT NOT NULL,
  file_id INT NOT NULL,
  user_id INT NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP NULL,
  completed_by INT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (excel_data_id) REFERENCES excel_data(id) ON DELETE CASCADE,
  FOREIGN KEY (file_id) REFERENCES excel_files(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (completed_by) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_excel (user_id, excel_data_id),
  INDEX idx_user_completed (user_id, is_completed),
  INDEX idx_completed_at (completed_at),
  INDEX idx_file_user (file_id, user_id)
);
```

### work_history 테이블
```sql
CREATE TABLE work_history (
  id INT PRIMARY KEY AUTO_INCREMENT,
  excel_data_id INT NOT NULL,
  user_id INT NOT NULL,
  action ENUM('completed', 'uncompleted', 'note_added') NOT NULL,
  old_status BOOLEAN NULL,
  new_status BOOLEAN NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (excel_data_id) REFERENCES excel_data(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_action (user_id, action),
  INDEX idx_created_at (created_at),
  INDEX idx_excel_data (excel_data_id)
);
```

### user_date_settings 테이블
```sql
CREATE TABLE user_date_settings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  today_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_date (user_id)
);
```

---

## 📝 사용 예시

### 1. 업무 체크/해제
```bash
# 업무 완료 처리
curl -X PUT http://localhost:5000/api/work/excel/123/check \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "isCompleted": true,
    "notes": "고객 연락 완료"
  }'

# 업무 미완료 처리
curl -X PUT http://localhost:5000/api/work/excel/123/check \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "isCompleted": false,
    "notes": "재검토 필요"
  }'
```

### 2. 완료된 업무 조회
```bash
# 전체 완료된 업무 조회
curl -X GET "http://localhost:5000/api/work/completed?page=1&limit=20" \
  -H "Authorization: Bearer {token}"

# 날짜별 완료된 업무 조회
curl -X GET "http://localhost:5000/api/work/completed?startDate=2024-01-01&endDate=2024-01-15" \
  -H "Authorization: Bearer {token}"

# 특정 사용자의 완료된 업무 조회
curl -X GET "http://localhost:5000/api/work/completed?userId=2" \
  -H "Authorization: Bearer {token}"
```

### 3. 오늘 날짜 설정
```bash
# 오늘 날짜 설정
curl -X PUT http://localhost:5000/api/work/today-date \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "todayDate": "2024-01-15"
  }'

# 현재 설정된 오늘 날짜 조회
curl -X GET http://localhost:5000/api/work/today-date \
  -H "Authorization: Bearer {token}"
```

### 4. 특정 날짜의 완료된 업무 조회
```bash
curl -X GET "http://localhost:5000/api/work/completed/2024-01-15?page=1&limit=20" \
  -H "Authorization: Bearer {token}"
```

### 5. 업무 통계 조회
```bash
curl -X GET http://localhost:5000/api/work/stats \
  -H "Authorization: Bearer {token}"
```

### 6. 대량 체크/해제
```bash
curl -X POST http://localhost:5000/api/work/bulk-check \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "rowIds": [123, 124, 125, 126, 127],
    "isCompleted": true,
    "notes": "일괄 처리 완료"
  }'
```

### 7. 사용자 업무 현황 조회
```bash
curl -X GET http://localhost:5000/api/work/user-status \
  -H "Authorization: Bearer {token}"
```

### 8. 업무 활동 히스토리 조회
```bash
curl -X GET "http://localhost:5000/api/work/history?action=completed&startDate=2024-01-01" \
  -H "Authorization: Bearer {token}"
```

---

## 🚨 에러 처리

### 일반적인 에러 코드
- `400`: 잘못된 요청 (유효성 검사 실패)
- `401`: 인증 필요
- `403`: 권한 없음
- `404`: 데이터 없음
- `500`: 서버 내부 오류

### 에러 응답 예시
```json
{
  "success": false,
  "message": "해당 엑셀 데이터를 찾을 수 없습니다.",
  "error": "DATA_NOT_FOUND"
}
```

---

## 🔒 보안 고려사항

### 데이터 접근 제어
- **사용자별 권한**: 본인 업무만 접근 가능
- **관리자 권한**: 모든 업무 접근 가능
- **API 인증**: JWT 토큰 필수

### 데이터 무결성
- **외래 키 제약**: 엑셀 데이터, 사용자, 파일과의 관계 보장
- **유니크 제약**: 사용자별 엑셀 데이터 중복 방지
- **트랜잭션 처리**: 상태 변경 시 데이터 일관성 보장

### 활동 추적
- **히스토리 로그**: 모든 상태 변경 이력 기록
- **감사 추적**: 누가, 언제, 무엇을 변경했는지 추적
- **데이터 보존**: 삭제된 데이터도 히스토리는 보존

---

## ⚡ 성능 최적화

### 인덱싱 전략
- **복합 인덱스**: 사용자별 완료 상태 조회 최적화
- **날짜 인덱스**: 날짜별 조회 성능 향상
- **파일별 인덱스**: 파일별 업무 현황 조회 최적화

### 쿼리 최적화
- **JOIN 최적화**: 필요한 테이블만 조인
- **페이지네이션**: 대용량 데이터 처리 최적화
- **캐싱**: 자주 조회되는 통계 정보 캐싱

### 배치 처리
- **대량 처리**: 여러 행을 한 번에 처리
- **트랜잭션 관리**: 일관성 있는 데이터 처리
- **에러 처리**: 일부 실패해도 나머지는 계속 처리 