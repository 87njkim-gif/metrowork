# MetroWork Excel API Documentation

## 📊 대용량 엑셀 데이터 처리 API

### 기본 정보
- **Base URL**: `http://localhost:5000/api/excel`
- **Content-Type**: `application/json` (업로드 제외)
- **Authorization**: `Bearer {token}` (모든 라우트)
- **최대 파일 크기**: 100MB
- **지원 형식**: .xlsx, .xls, .csv

---

## 📤 엑셀 파일 업로드

### POST `/api/excel/upload`

대용량 엑셀 파일을 업로드하고 청크 단위로 처리합니다.

#### Request (multipart/form-data)
```
Content-Type: multipart/form-data

file: [엑셀 파일]
description: "고객 데이터 2024년"
tags: ["고객", "2024", "분석"]
chunkSize: 1000
validateData: true
```

#### Response (201 Created)
```json
{
  "success": true,
  "message": "파일이 업로드되었습니다. 처리 중입니다.",
  "data": {
    "fileId": 1,
    "filename": "customer_data_2024.xlsx",
    "fileSize": 5242880,
    "status": "processing"
  }
}
```

#### 처리 과정
1. **파일 검증**: 형식, 크기 체크
2. **메타데이터 저장**: 파일 정보 DB 저장
3. **비동기 처리**: 청크 단위로 데이터 처리
4. **진행률 추적**: 실시간 처리 상태 모니터링

---

## 📈 업로드 진행률 조회

### GET `/api/excel/upload/:fileId/progress`

파일 처리 진행률을 실시간으로 조회합니다.

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "fileId": 1,
    "filename": "customer_data_2024.xlsx",
    "isProcessed": false,
    "totalRows": 14564,
    "processedRows": 8500,
    "progress": 58,
    "totalColumns": 10,
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

---

## 📋 파일 목록 조회

### GET `/api/excel/files`

업로드된 엑셀 파일 목록을 조회합니다.

#### Query Parameters
- `page`: 페이지 번호 (기본값: 1)
- `limit`: 페이지당 항목 수 (기본값: 20)
- `search`: 검색어 (파일명, 설명)

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "files": [
      {
        "id": 1,
        "filename": "customer_data_2024.xlsx",
        "original_name": "고객데이터_2024.xlsx",
        "file_size": 5242880,
        "file_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "total_rows": 14564,
        "total_columns": 10,
        "description": "2024년 고객 데이터",
        "tags": ["고객", "2024", "분석"],
        "is_processed": true,
        "uploaded_by": 2,
        "created_at": "2024-01-15T10:30:00.000Z",
        "updated_at": "2024-01-15T10:35:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5,
      "totalPages": 1
    }
  }
}
```

---

## 📊 페이지네이션된 데이터 조회

### GET `/api/excel/data/:fileId`

처리된 엑셀 데이터를 페이지네이션으로 조회합니다.

#### Query Parameters
- `page`: 페이지 번호 (기본값: 1)
- `limit`: 페이지당 행 수 (기본값: 50, 최대: 100)
- `search`: 전체 텍스트 검색
- `sortBy`: 정렬 컬럼명
- `sortOrder`: 정렬 순서 (asc/desc)

#### Example Request
```
GET /api/excel/data/1?page=1&limit=50&search=홍길동&sortBy=name&sortOrder=asc
```

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": 1,
        "file_id": 1,
        "row_index": 1,
        "row_data": {
          "name": "홍길동",
          "email": "hong@example.com",
          "phone": "010-1234-5678",
          "department": "개발팀",
          "position": "개발자",
          "salary": 5000000,
          "hire_date": "2020-01-15",
          "status": "active"
        },
        "is_valid": true,
        "validation_errors": null,
        "created_at": "2024-01-15T10:30:00.000Z",
        "updated_at": "2024-01-15T10:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 14564,
      "totalPages": 292,
      "hasNext": true,
      "hasPrev": false
    },
    "columns": [
      {
        "id": 1,
        "file_id": 1,
        "column_index": 0,
        "column_name": "name",
        "column_type": "string",
        "is_required": false,
        "is_searchable": true,
        "is_sortable": true,
        "display_name": "이름",
        "description": "직원 이름"
      }
    ],
    "summary": {
      "totalRows": 14564,
      "validRows": 14560,
      "invalidRows": 4
    }
  }
}
```

---

## 🔍 고급 검색 API

### POST `/api/excel/search/:fileId`

다중 조건 검색을 지원하는 고급 검색 API입니다.

#### Request Body
```json
{
  "searchTerm": "홍길동",
  "columnFilters": {
    "department": "개발팀",
    "status": "active"
  },
  "rangeFilters": {
    "salary": {
      "min": 3000000,
      "max": 7000000,
      "type": "number"
    },
    "hire_date": {
      "min": "2020-01-01",
      "max": "2023-12-31",
      "type": "date"
    }
  },
  "booleanFilters": {
    "is_manager": true
  },
  "sortBy": "salary",
  "sortOrder": "desc",
  "page": 1,
  "limit": 50
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": 1,
        "file_id": 1,
        "row_index": 1,
        "row_data": {
          "name": "홍길동",
          "email": "hong@example.com",
          "department": "개발팀",
          "salary": 5000000,
          "hire_date": "2020-01-15",
          "status": "active"
        },
        "is_valid": true
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 125,
      "totalPages": 3,
      "hasNext": true,
      "hasPrev": false
    },
    "searchInfo": {
      "searchTerm": "홍길동",
      "appliedFilters": {
        "columnFilters": {
          "department": "개발팀",
          "status": "active"
        },
        "rangeFilters": {
          "salary": {
            "min": 3000000,
            "max": 7000000,
            "type": "number"
          }
        }
      },
      "processingTime": 245
    }
  }
}
```

---

## 📈 컬럼별 요약 정보

### GET `/api/excel/summary/:fileId`

각 컬럼의 데이터 타입, 통계 정보를 제공합니다.

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "file_id": 1,
    "total_rows": 14564,
    "total_columns": 10,
    "columns": [
      {
        "column_name": "name",
        "column_type": "string",
        "total_values": 14564,
        "unique_values": 14564,
        "null_values": 0,
        "min_value": "김철수",
        "max_value": "홍길동",
        "sample_values": ["김철수", "이영희", "박민수", "정수진"],
        "value_counts": [
          {
            "value": "김철수",
            "count": 1
          },
          {
            "value": "이영희",
            "count": 1
          }
        ]
      },
      {
        "column_name": "salary",
        "column_type": "number",
        "total_values": 14564,
        "unique_values": 1245,
        "null_values": 0,
        "min_value": 2500000,
        "max_value": 15000000,
        "sample_values": [3000000, 4500000, 6000000, 8000000],
        "value_counts": [
          {
            "value": 3000000,
            "count": 1250
          },
          {
            "value": 4500000,
            "count": 980
          }
        ]
      }
    ],
    "processing_time": 0,
    "last_updated": "2024-01-15T10:35:00.000Z"
  }
}
```

---

## 💾 저장된 검색 관리

### 저장된 검색 목록 조회
#### GET `/api/search/:fileId/saved`

### 검색 조건 저장
#### POST `/api/search/:fileId/saved`
```json
{
  "name": "개발팀 고급 개발자",
  "criteria": {
    "searchTerm": "",
    "columnFilters": {
      "department": "개발팀",
      "position": "고급개발자"
    },
    "rangeFilters": {
      "salary": {
        "min": 5000000,
        "max": 10000000,
        "type": "number"
      }
    },
    "sortBy": "salary",
    "sortOrder": "desc"
  }
}
```

### 저장된 검색 실행
#### GET `/api/search/:fileId/saved/:searchId/execute`

### 저장된 검색 수정
#### PUT `/api/search/:fileId/saved/:searchId`

### 저장된 검색 삭제
#### DELETE `/api/search/:fileId/saved/:searchId`

### 검색 히스토리 조회
#### GET `/api/search/:fileId/history`

---

## 🗑️ 파일 삭제

### DELETE `/api/excel/files/:fileId`

업로드된 엑셀 파일과 관련 데이터를 삭제합니다.

#### Response (200 OK)
```json
{
  "success": true,
  "message": "파일이 삭제되었습니다."
}
```

---

## ⚡ 성능 최적화 특징

### 🚀 **청크 단위 처리**
- **청크 크기**: 기본 1,000행 (설정 가능)
- **메모리 효율성**: 대용량 파일도 안정적 처리
- **진행률 추적**: 실시간 처리 상태 모니터링

### 📱 **모바일 최적화**
- **응답 크기 제한**: 한 번에 최대 100행
- **데이터 최적화**: 불필요한 메타데이터 제거
- **캐싱 시스템**: 자주 조회되는 데이터 캐싱

### 🔍 **고급 검색 기능**
- **전체 텍스트 검색**: 모든 컬럼에서 검색
- **다중 조건 검색**: AND/OR 조건 조합
- **범위 검색**: 숫자, 날짜 범위 지정
- **정렬 기능**: 다중 컬럼 정렬 지원

### 💾 **캐싱 시스템**
- **메모리 캐시**: 빠른 응답 속도
- **TTL 관리**: 데이터 타입별 만료 시간
- **자동 정리**: 만료된 캐시 자동 삭제

### 📊 **데이터 분석**
- **자동 타입 감지**: 컬럼 데이터 타입 자동 분석
- **통계 정보**: 각 컬럼별 상세 통계
- **유효성 검사**: 데이터 품질 검증

---

## 🔧 데이터베이스 스키마

### excel_files 테이블
```sql
CREATE TABLE excel_files (
  id INT PRIMARY KEY AUTO_INCREMENT,
  filename VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size BIGINT NOT NULL,
  file_type VARCHAR(100) NOT NULL,
  sheet_name VARCHAR(100),
  total_rows INT DEFAULT 0,
  total_columns INT DEFAULT 0,
  uploaded_by INT NOT NULL,
  description TEXT,
  tags JSON,
  is_processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
);
```

### excel_columns 테이블
```sql
CREATE TABLE excel_columns (
  id INT PRIMARY KEY AUTO_INCREMENT,
  file_id INT NOT NULL,
  column_index INT NOT NULL,
  column_name VARCHAR(255) NOT NULL,
  column_type ENUM('string', 'number', 'date', 'boolean', 'json') DEFAULT 'string',
  is_required BOOLEAN DEFAULT FALSE,
  is_searchable BOOLEAN DEFAULT TRUE,
  is_sortable BOOLEAN DEFAULT TRUE,
  display_name VARCHAR(255),
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (file_id) REFERENCES excel_files(id) ON DELETE CASCADE
);
```

### excel_data 테이블
```sql
CREATE TABLE excel_data (
  id INT PRIMARY KEY AUTO_INCREMENT,
  file_id INT NOT NULL,
  row_index INT NOT NULL,
  row_data JSON NOT NULL,
  is_valid BOOLEAN DEFAULT TRUE,
  validation_errors JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (file_id) REFERENCES excel_files(id) ON DELETE CASCADE,
  INDEX idx_file_row (file_id, row_index),
  INDEX idx_row_data ((CAST(row_data AS CHAR(1000))))
);
```

### saved_searches 테이블
```sql
CREATE TABLE saved_searches (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  file_id INT NOT NULL,
  user_id INT NOT NULL,
  criteria JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (file_id) REFERENCES excel_files(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_search (user_id, file_id, name)
);
```

### search_history 테이블
```sql
CREATE TABLE search_history (
  id INT PRIMARY KEY AUTO_INCREMENT,
  file_id INT NOT NULL,
  user_id INT NOT NULL,
  search_term VARCHAR(500),
  filters JSON,
  result_count INT NOT NULL,
  processing_time INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (file_id) REFERENCES excel_files(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

---

## 📝 사용 예시

### 1. 파일 업로드 및 처리
```bash
# 파일 업로드
curl -X POST http://localhost:5000/api/excel/upload \
  -H "Authorization: Bearer {token}" \
  -F "file=@customer_data.xlsx" \
  -F "description=2024년 고객 데이터" \
  -F "tags=고객,2024,분석" \
  -F "chunkSize=1000"

# 진행률 확인
curl -X GET http://localhost:5000/api/excel/upload/1/progress \
  -H "Authorization: Bearer {token}"
```

### 2. 데이터 조회 및 검색
```bash
# 기본 데이터 조회
curl -X GET "http://localhost:5000/api/excel/data/1?page=1&limit=50" \
  -H "Authorization: Bearer {token}"

# 고급 검색
curl -X POST http://localhost:5000/api/excel/search/1 \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "searchTerm": "홍길동",
    "columnFilters": {"department": "개발팀"},
    "rangeFilters": {
      "salary": {"min": 3000000, "max": 7000000, "type": "number"}
    },
    "page": 1,
    "limit": 50
  }'
```

### 3. 요약 정보 조회
```bash
# 컬럼별 요약 정보
curl -X GET http://localhost:5000/api/excel/summary/1 \
  -H "Authorization: Bearer {token}"
```

### 4. 저장된 검색 관리
```bash
# 검색 조건 저장
curl -X POST http://localhost:5000/api/search/1/saved \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "개발팀 고급 개발자",
    "criteria": {
      "columnFilters": {"department": "개발팀", "position": "고급개발자"},
      "rangeFilters": {"salary": {"min": 5000000, "max": 10000000, "type": "number"}}
    }
  }'

# 저장된 검색 실행
curl -X GET http://localhost:5000/api/search/1/saved/1/execute \
  -H "Authorization: Bearer {token}"
```

---

## 🚨 에러 처리

### 일반적인 에러 코드
- `400`: 잘못된 요청 (파일 형식, 크기 등)
- `401`: 인증 필요
- `403`: 권한 없음
- `404`: 파일/데이터 없음
- `413`: 파일 크기 초과
- `500`: 서버 내부 오류

### 에러 응답 예시
```json
{
  "success": false,
  "message": "지원하지 않는 파일 형식입니다.",
  "error": "INVALID_FILE_TYPE"
}
```

---

## 🔒 보안 고려사항

### 파일 업로드 보안
- **파일 형식 검증**: 허용된 형식만 업로드
- **파일 크기 제한**: 100MB 이하
- **바이러스 스캔**: 업로드 파일 검증
- **저장 경로 보안**: 안전한 디렉토리에 저장

### 데이터 접근 제어
- **사용자별 권한**: 본인 파일만 접근
- **관리자 권한**: 모든 파일 접근 가능
- **API 인증**: JWT 토큰 필수

### 캐시 보안
- **사용자별 캐시**: 개인 데이터 분리
- **캐시 만료**: 자동 만료 처리
- **민감 데이터 제외**: 중요 정보 캐싱 제외 