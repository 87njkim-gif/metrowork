# MetroWork 실시간 업무 체크 시스템 배포 가이드

## 🚀 개요

이 가이드는 MetroWork 실시간 업무 체크 시스템을 외부 서버에 배포하는 방법을 설명합니다. PC를 항상 켜둘 필요 없이 24/7 운영이 가능한 클라우드 서버 설정을 다룹니다.

---

## 📋 요구사항

### 시스템 요구사항
- **Node.js**: 18.x 이상
- **MySQL**: 8.0 이상
- **메모리**: 최소 2GB RAM
- **저장공간**: 최소 20GB
- **네트워크**: 고정 IP 또는 도메인

### 권장 클라우드 서비스
- **AWS EC2**: t3.medium 이상
- **Google Cloud Platform**: e2-medium 이상
- **Azure**: Standard_B2s 이상
- **Vultr**: 4GB RAM 이상
- **DigitalOcean**: 4GB RAM Droplet

---

## ☁️ 클라우드 서버 설정

### 1. AWS EC2 배포 (권장)

#### 1.1 EC2 인스턴스 생성
```bash
# Ubuntu 22.04 LTS 선택
# 인스턴스 타입: t3.medium (2 vCPU, 4GB RAM)
# 스토리지: 20GB GP3
# 보안 그룹: HTTP(80), HTTPS(443), SSH(22), Custom TCP(5000)
```

#### 1.2 보안 그룹 설정
```bash
# 인바운드 규칙
HTTP (80)     : 0.0.0.0/0
HTTPS (443)   : 0.0.0.0/0
SSH (22)      : 0.0.0.0/0 (또는 특정 IP)
Custom TCP (5000) : 0.0.0.0/0 (개발용)
MySQL (3306)  : 0.0.0.0/0 (또는 보안 그룹 내부)
```

#### 1.3 서버 접속 및 초기 설정
```bash
# SSH 접속
ssh -i your-key.pem ubuntu@your-server-ip

# 시스템 업데이트
sudo apt update && sudo apt upgrade -y

# 필수 패키지 설치
sudo apt install -y curl wget git nginx mysql-server
```

### 2. Google Cloud Platform 배포

#### 2.1 Compute Engine 인스턴스 생성
```bash
# 머신 타입: e2-medium (2 vCPU, 4GB RAM)
# 부팅 디스크: Ubuntu 22.04 LTS, 20GB
# 방화벽: HTTP, HTTPS, SSH 허용
```

#### 2.2 방화벽 규칙 설정
```bash
# VPC 네트워크 > 방화벽
# 규칙 추가:
# - HTTP (80)
# - HTTPS (443)
# - SSH (22)
# - Custom (5000) - 개발용
```

---

## 🗄️ 데이터베이스 설정

### 1. MySQL 설치 및 설정

#### 1.1 MySQL 설치
```bash
# Ubuntu/Debian
sudo apt install mysql-server -y

# 보안 설정
sudo mysql_secure_installation
```

#### 1.2 MySQL 사용자 생성
```sql
-- MySQL 접속
sudo mysql

-- 데이터베이스 생성
CREATE DATABASE metrowork CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 사용자 생성
CREATE USER 'metrowork_user'@'localhost' IDENTIFIED BY 'your_secure_password';
CREATE USER 'metrowork_admin'@'localhost' IDENTIFIED BY 'your_admin_password';

-- 권한 부여
GRANT ALL PRIVILEGES ON metrowork.* TO 'metrowork_admin'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON metrowork.* TO 'metrowork_user'@'localhost';

FLUSH PRIVILEGES;
EXIT;
```

#### 1.3 데이터베이스 스키마 적용
```bash
# 스키마 파일 업로드
scp -i your-key.pem WORK_CHECK_DATABASE_SCHEMA.sql ubuntu@your-server-ip:~/

# 스키마 적용
mysql -u metrowork_admin -p metrowork < WORK_CHECK_DATABASE_SCHEMA.sql
```

### 2. RDS 사용 (권장 - 프로덕션)

#### 2.1 AWS RDS 설정
```bash
# RDS 인스턴스 생성
# - 엔진: MySQL 8.0
# - 인스턴스: db.t3.micro (개발용) / db.t3.small (프로덕션)
# - 스토리지: 20GB
# - 백업: 자동 백업 활성화
# - 다중 AZ: 프로덕션에서 권장
```

#### 2.2 RDS 연결 설정
```bash
# 보안 그룹 설정
# - 인바운드: EC2 보안 그룹에서 MySQL(3306) 허용

# 연결 테스트
mysql -h your-rds-endpoint -u metrowork_admin -p
```

---

## 🔧 애플리케이션 배포

### 1. Node.js 설치

#### 1.1 Node.js 18.x 설치
```bash
# NodeSource 저장소 추가
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -

# Node.js 설치
sudo apt install -y nodejs

# 버전 확인
node --version
npm --version
```

#### 1.2 PM2 설치 (프로세스 관리)
```bash
# PM2 전역 설치
sudo npm install -g pm2

# PM2 설정
pm2 startup
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u ubuntu --hp /home/ubuntu
```

### 2. 애플리케이션 배포

#### 2.1 코드 업로드
```bash
# Git 클론 또는 파일 업로드
git clone https://github.com/your-repo/metrowork.git
cd metrowork

# 또는 SCP로 파일 업로드
scp -r -i your-key.pem ./metrowork ubuntu@your-server-ip:~/
```

#### 2.2 의존성 설치
```bash
# 서버 의존성 설치
cd server
npm install

# 클라이언트 의존성 설치 (필요시)
cd ../client
npm install
npm run build
```

#### 2.3 환경변수 설정
```bash
# .env 파일 생성
cd ~/metrowork/server
nano .env
```

```env
# 서버 설정
NODE_ENV=production
PORT=5000
CLIENT_URL=https://your-domain.com

# 데이터베이스 설정
DB_HOST=localhost
DB_PORT=3306
DB_NAME=metrowork
DB_USER=metrowork_admin
DB_PASSWORD=your_admin_password

# JWT 설정
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRES_IN=24h

# SMS 서비스 설정 (선택사항)
SMS_PROVIDER=development
# SMS_PROVIDER=twilio
# TWILIO_ACCOUNT_SID=your_twilio_sid
# TWILIO_AUTH_TOKEN=your_twilio_token
# TWILIO_FROM_NUMBER=+1234567890

# 파일 업로드 설정
UPLOAD_PATH=/home/ubuntu/metrowork/uploads
MAX_FILE_SIZE=10485760

# 로깅 설정
LOG_LEVEL=info
LOG_FILE=/home/ubuntu/metrowork/logs/app.log
```

#### 2.4 PM2로 애플리케이션 실행
```bash
# PM2 설정 파일 생성
nano ecosystem.config.js
```

```javascript
module.exports = {
  apps: [{
    name: 'metrowork-server',
    script: './src/index.ts',
    cwd: '/home/ubuntu/metrowork/server',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: '/home/ubuntu/metrowork/logs/err.log',
    out_file: '/home/ubuntu/metrowork/logs/out.log',
    log_file: '/home/ubuntu/metrowork/logs/combined.log',
    time: true,
    max_memory_restart: '1G',
    restart_delay: 4000,
    max_restarts: 10
  }]
};
```

```bash
# 로그 디렉토리 생성
mkdir -p /home/ubuntu/metrowork/logs

# 애플리케이션 시작
pm2 start ecosystem.config.js

# PM2 상태 확인
pm2 status
pm2 logs

# 시스템 부팅 시 자동 시작
pm2 save
pm2 startup
```

---

## 🌐 Nginx 설정

### 1. Nginx 설치 및 설정

#### 1.1 Nginx 설정 파일 생성
```bash
sudo nano /etc/nginx/sites-available/metrowork
```

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    # HTTP를 HTTPS로 리다이렉트
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    # SSL 인증서 설정
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # 보안 헤더
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # 클라이언트 최대 업로드 크기
    client_max_body_size 10M;

    # API 프록시
    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    # Socket.IO 프록시
    location /socket.io/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # 정적 파일 서빙
    location / {
        root /home/ubuntu/metrowork/client/build;
        try_files $uri $uri/ /index.html;
        
        # 캐싱 설정
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # 업로드 파일 서빙
    location /uploads/ {
        alias /home/ubuntu/metrowork/uploads/;
        expires 1d;
        add_header Cache-Control "public";
    }

    # 로그 설정
    access_log /var/log/nginx/metrowork_access.log;
    error_log /var/log/nginx/metrowork_error.log;
}
```

#### 1.2 Nginx 설정 활성화
```bash
# 심볼릭 링크 생성
sudo ln -s /etc/nginx/sites-available/metrowork /etc/nginx/sites-enabled/

# 기본 설정 제거
sudo rm /etc/nginx/sites-enabled/default

# 설정 테스트
sudo nginx -t

# Nginx 재시작
sudo systemctl restart nginx
sudo systemctl enable nginx
```

### 2. SSL 인증서 설정 (Let's Encrypt)

#### 2.1 Certbot 설치
```bash
# Certbot 설치
sudo apt install certbot python3-certbot-nginx -y

# SSL 인증서 발급
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# 자동 갱신 설정
sudo crontab -e
# 다음 줄 추가:
# 0 12 * * * /usr/bin/certbot renew --quiet
```

---

## 🔄 자동 배포 설정

### 1. GitHub Actions 설정

#### 1.1 GitHub Secrets 설정
```bash
# GitHub 저장소 > Settings > Secrets and variables > Actions
# 다음 시크릿 추가:
# - SERVER_HOST: your-server-ip
# - SERVER_USER: ubuntu
# - SSH_PRIVATE_KEY: your-private-key
# - DB_PASSWORD: your-database-password
```

#### 1.2 GitHub Actions 워크플로우
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: |
        cd server
        npm ci
    
    - name: Build application
      run: |
        cd server
        npm run build
    
    - name: Deploy to server
      uses: appleboy/ssh-action@v0.1.5
      with:
        host: ${{ secrets.SERVER_HOST }}
        username: ${{ secrets.SERVER_USER }}
        key: ${{ secrets.SSH_PRIVATE_KEY }}
        script: |
          cd ~/metrowork
          git pull origin main
          cd server
          npm ci
          npm run build
          pm2 restart metrowork-server
```

### 2. Docker 배포 (선택사항)

#### 2.1 Dockerfile 생성
```dockerfile
# server/Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 5000

CMD ["npm", "start"]
```

#### 2.2 Docker Compose 설정
```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: ./server
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - DB_HOST=db
    depends_on:
      - db
    volumes:
      - ./uploads:/app/uploads
      - ./logs:/app/logs

  db:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: your_root_password
      MYSQL_DATABASE: metrowork
      MYSQL_USER: metrowork_user
      MYSQL_PASSWORD: your_user_password
    volumes:
      - mysql_data:/var/lib/mysql
      - ./WORK_CHECK_DATABASE_SCHEMA.sql:/docker-entrypoint-initdb.d/init.sql

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - app

volumes:
  mysql_data:
```

---

## 📊 모니터링 및 로깅

### 1. PM2 모니터링
```bash
# PM2 대시보드
pm2 monit

# 로그 확인
pm2 logs metrowork-server

# 성능 모니터링
pm2 show metrowork-server
```

### 2. 시스템 모니터링
```bash
# 시스템 리소스 모니터링
htop
df -h
free -h

# 네트워크 모니터링
netstat -tulpn
ss -tulpn
```

### 3. 로그 관리
```bash
# 로그 로테이션 설정
sudo nano /etc/logrotate.d/metrowork

# 설정 내용:
/home/ubuntu/metrowork/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 ubuntu ubuntu
    postrotate
        pm2 reloadLogs
    endscript
}
```

---

## 🔒 보안 설정

### 1. 방화벽 설정
```bash
# UFW 방화벽 활성화
sudo ufw enable

# 기본 정책 설정
sudo ufw default deny incoming
sudo ufw default allow outgoing

# 필요한 포트 허용
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw allow 5000  # 개발용 (프로덕션에서는 제거)

# 방화벽 상태 확인
sudo ufw status
```

### 2. Fail2ban 설정
```bash
# Fail2ban 설치
sudo apt install fail2ban -y

# 설정 파일 생성
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
sudo nano /etc/fail2ban/jail.local

# SSH 보호 설정
[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 3600

# Nginx 보호 설정
[nginx-http-auth]
enabled = true
port = http,https
filter = nginx-http-auth
logpath = /var/log/nginx/error.log
maxretry = 3
bantime = 3600

# Fail2ban 재시작
sudo systemctl restart fail2ban
sudo systemctl enable fail2ban
```

### 3. 정기 보안 업데이트
```bash
# 자동 보안 업데이트 설정
sudo apt install unattended-upgrades -y
sudo dpkg-reconfigure -plow unattended-upgrades

# 설정 확인
sudo nano /etc/apt/apt.conf.d/50unattended-upgrades
```

---

## 📈 성능 최적화

### 1. Node.js 최적화
```bash
# PM2 클러스터 모드 설정
pm2 start ecosystem.config.js --instances max

# 메모리 제한 설정
pm2 start ecosystem.config.js --max-memory-restart 1G
```

### 2. MySQL 최적화
```bash
# MySQL 설정 파일 수정
sudo nano /etc/mysql/mysql.conf.d/mysqld.cnf

# 주요 설정:
[mysqld]
innodb_buffer_pool_size = 1G
innodb_log_file_size = 256M
innodb_flush_log_at_trx_commit = 2
max_connections = 200
query_cache_size = 64M
query_cache_type = 1

# MySQL 재시작
sudo systemctl restart mysql
```

### 3. Nginx 최적화
```bash
# Nginx 설정 최적화
sudo nano /etc/nginx/nginx.conf

# 주요 설정:
worker_processes auto;
worker_connections 1024;
keepalive_timeout 65;
gzip on;
gzip_types text/plain text/css application/json application/javascript;
```

---

## 🔄 백업 및 복구

### 1. 자동 백업 스크립트
```bash
# 백업 스크립트 생성
nano /home/ubuntu/backup.sh
```

```bash
#!/bin/bash

# 백업 디렉토리 생성
BACKUP_DIR="/home/ubuntu/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="metrowork_backup_$DATE.sql"

mkdir -p $BACKUP_DIR

# 데이터베이스 백업
mysqldump -u metrowork_admin -p'your_password' metrowork > $BACKUP_DIR/$BACKUP_FILE

# 업로드 파일 백업
tar -czf $BACKUP_DIR/uploads_backup_$DATE.tar.gz /home/ubuntu/metrowork/uploads

# 로그 파일 백업
tar -czf $BACKUP_DIR/logs_backup_$DATE.tar.gz /home/ubuntu/metrowork/logs

# 30일 이상 된 백업 삭제
find $BACKUP_DIR -name "*.sql" -mtime +30 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete

echo "Backup completed: $BACKUP_FILE"
```

```bash
# 실행 권한 부여
chmod +x /home/ubuntu/backup.sh

# crontab에 추가 (매일 새벽 2시)
crontab -e
# 0 2 * * * /home/ubuntu/backup.sh
```

### 2. 복구 절차
```bash
# 데이터베이스 복구
mysql -u metrowork_admin -p metrowork < backup_file.sql

# 파일 복구
tar -xzf uploads_backup.tar.gz -C /
tar -xzf logs_backup.tar.gz -C /

# 애플리케이션 재시작
pm2 restart metrowork-server
```

---

## 🚨 문제 해결

### 1. 일반적인 문제들

#### 1.1 포트 충돌
```bash
# 포트 사용 확인
sudo netstat -tulpn | grep :5000
sudo lsof -i :5000

# 프로세스 종료
sudo kill -9 <PID>
```

#### 1.2 메모리 부족
```bash
# 메모리 사용량 확인
free -h
ps aux --sort=-%mem | head

# 스왑 파일 생성
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

#### 1.3 디스크 공간 부족
```bash
# 디스크 사용량 확인
df -h
du -sh /home/ubuntu/metrowork/*

# 로그 파일 정리
sudo journalctl --vacuum-time=7d
```

### 2. 로그 분석
```bash
# 애플리케이션 로그
pm2 logs metrowork-server --lines 100

# Nginx 로그
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# 시스템 로그
sudo journalctl -u nginx -f
sudo journalctl -u mysql -f
```

---

## 📞 지원 및 유지보수

### 1. 정기 점검 체크리스트
- [ ] 시스템 리소스 사용량 확인
- [ ] 로그 파일 크기 확인
- [ ] 백업 상태 확인
- [ ] 보안 업데이트 적용
- [ ] SSL 인증서 만료일 확인
- [ ] 데이터베이스 성능 확인

### 2. 모니터링 도구
```bash
# 시스템 모니터링
sudo apt install htop iotop nethogs -y

# 네트워크 모니터링
sudo apt install iftop nethogs -y

# 로그 모니터링
sudo apt install logwatch -y
```

### 3. 알림 설정
```bash
# 디스크 사용량 알림
echo '#!/bin/bash
DISK_USAGE=$(df / | awk "NR==2 {print \$5}" | sed "s/%//")
if [ $DISK_USAGE -gt 80 ]; then
    echo "Disk usage is ${DISK_USAGE}%" | mail -s "Disk Usage Alert" admin@your-domain.com
fi' > /home/ubuntu/disk_check.sh

chmod +x /home/ubuntu/disk_check.sh
# crontab에 추가: */30 * * * * /home/ubuntu/disk_check.sh
```

---

## ✅ 배포 완료 확인

### 1. 기능 테스트
```bash
# API 엔드포인트 테스트
curl -X GET https://your-domain.com/api/health

# Socket.IO 연결 테스트
curl -X GET https://your-domain.com/socket.io/

# 데이터베이스 연결 테스트
mysql -u metrowork_admin -p -e "SELECT COUNT(*) FROM work_checks;"
```

### 2. 성능 테스트
```bash
# 부하 테스트 (Apache Bench)
ab -n 1000 -c 10 https://your-domain.com/api/health

# 메모리 사용량 확인
pm2 show metrowork-server
```

### 3. 보안 테스트
```bash
# SSL 설정 확인
curl -I https://your-domain.com

# 헤더 보안 확인
curl -I https://your-domain.com/api/health
```

---

## 🎉 배포 완료!

이제 MetroWork 실시간 업무 체크 시스템이 외부 서버에서 24/7 운영됩니다!

### 주요 특징:
- ✅ **실시간 업무 체크**: Socket.IO를 통한 실시간 공유
- ✅ **중복 체크 방지**: 이미 체크된 업무에 대한 안내
- ✅ **관리자 대시보드**: 실시간 통계 및 현황 모니터링
- ✅ **외부 서버 운영**: PC 켜둘 필요 없이 24/7 운영
- ✅ **자동 백업**: 데이터 안전성 보장
- ✅ **보안 설정**: SSL, 방화벽, Fail2ban 적용
- ✅ **성능 최적화**: PM2, MySQL, Nginx 최적화
- ✅ **모니터링**: 시스템 상태 실시간 모니터링

### 접속 정보:
- **웹사이트**: https://your-domain.com
- **API**: https://your-domain.com/api
- **관리자**: https://your-domain.com/admin
- **실시간 대시보드**: https://your-domain.com/dashboard

### 유지보수 명령어:
```bash
# 애플리케이션 재시작
pm2 restart metrowork-server

# 로그 확인
pm2 logs metrowork-server

# 시스템 상태 확인
pm2 monit

# 백업 실행
/home/ubuntu/backup.sh
``` 