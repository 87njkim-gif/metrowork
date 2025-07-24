export interface SMSService {
  sendSMS(phoneNumber: string, message: string): Promise<boolean>
  sendVerificationCode(phoneNumber: string, code: string): Promise<boolean>
}

// 개발 환경용 SMS 서비스 (콘솔 로그)
class DevelopmentSMSService implements SMSService {
  async sendSMS(phoneNumber: string, message: string): Promise<boolean> {
    console.log('📱 [개발 모드] SMS 발송:')
    console.log(`   수신자: ${phoneNumber}`)
    console.log(`   메시지: ${message}`)
    console.log('   ✅ SMS 발송 성공 (개발 모드)')
    return true
  }

  async sendVerificationCode(phoneNumber: string, code: string): Promise<boolean> {
    const message = `[MetroWork] 인증번호: ${code} (5분간 유효)`
    return this.sendSMS(phoneNumber, message)
  }
}

// Twilio SMS 서비스
class TwilioSMSService implements SMSService {
  private accountSid: string
  private authToken: string
  private fromNumber: string

  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID || ''
    this.authToken = process.env.TWILIO_AUTH_TOKEN || ''
    this.fromNumber = process.env.TWILIO_FROM_NUMBER || ''
  }

  async sendSMS(phoneNumber: string, message: string): Promise<boolean> {
    try {
      const twilio = require('twilio')(this.accountSid, this.authToken)
      
      await twilio.messages.create({
        body: message,
        from: this.fromNumber,
        to: phoneNumber
      })

      console.log(`✅ Twilio SMS 발송 성공: ${phoneNumber}`)
      return true
    } catch (error) {
      console.error('❌ Twilio SMS 발송 실패:', error)
      return false
    }
  }

  async sendVerificationCode(phoneNumber: string, code: string): Promise<boolean> {
    const message = `[MetroWork] 인증번호: ${code} (5분간 유효)`
    return this.sendSMS(phoneNumber, message)
  }
}

// AWS SNS SMS 서비스
class AWSSNSService implements SMSService {
  private sns: any
  private region: string

  constructor() {
    const AWS = require('aws-sdk')
    this.region = process.env.AWS_REGION || 'us-east-1'
    
    this.sns = new AWS.SNS({
      region: this.region,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    })
  }

  async sendSMS(phoneNumber: string, message: string): Promise<boolean> {
    try {
      await this.sns.publish({
        Message: message,
        PhoneNumber: phoneNumber
      }).promise()

      console.log(`✅ AWS SNS SMS 발송 성공: ${phoneNumber}`)
      return true
    } catch (error) {
      console.error('❌ AWS SNS SMS 발송 실패:', error)
      return false
    }
  }

  async sendVerificationCode(phoneNumber: string, code: string): Promise<boolean> {
    const message = `[MetroWork] 인증번호: ${code} (5분간 유효)`
    return this.sendSMS(phoneNumber, message)
  }
}

// Naver Cloud SMS 서비스
class NaverCloudSMSService implements SMSService {
  private accessKey: string
  private secretKey: string
  private serviceId: string
  private fromNumber: string

  constructor() {
    this.accessKey = process.env.NAVER_CLOUD_ACCESS_KEY || ''
    this.secretKey = process.env.NAVER_CLOUD_SECRET_KEY || ''
    this.serviceId = process.env.NAVER_CLOUD_SMS_SERVICE_ID || ''
    this.fromNumber = process.env.NAVER_CLOUD_SMS_FROM_NUMBER || ''
  }

  async sendSMS(phoneNumber: string, message: string): Promise<boolean> {
    try {
      const crypto = require('crypto')
      const timestamp = Date.now().toString()
      
      // 서명 생성
      const signature = crypto
        .createHmac('sha256', this.secretKey)
        .update(`POST /sms/v2/services/${this.serviceId}/messages\n${timestamp}\n${this.accessKey}`)
        .digest('base64')

      const response = await fetch(
        `https://sens.apigw.ntruss.com/sms/v2/services/${this.serviceId}/messages`,
        {
          method: 'POST',
          body: JSON.stringify(
            {
              type: 'SMS',
              from: this.fromNumber,
              content: message,
              messages: [
                {
                  to: phoneNumber
                }
              ]
            }
          ),
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'x-ncp-apigw-timestamp': timestamp,
            'x-ncp-iam-access-key': this.accessKey,
            'x-ncp-apigw-signature-v2': signature
          }
        }
      )

      console.log(`✅ Naver Cloud SMS 발송 성공: ${phoneNumber}`)
      return true
    } catch (error) {
      console.error('❌ Naver Cloud SMS 발송 실패:', error)
      return false
    }
  }

  async sendVerificationCode(phoneNumber: string, code: string): Promise<boolean> {
    const message = `[MetroWork] 인증번호: ${code} (5분간 유효)`
    return this.sendSMS(phoneNumber, message)
  }
}

// SMS 서비스 팩토리
export class SMSServiceFactory {
  static createService(): SMSService {
    const smsProvider = process.env.SMS_PROVIDER || 'development'

    switch (smsProvider.toLowerCase()) {
      case 'twilio':
        return new TwilioSMSService()
      case 'aws-sns':
        return new AWSSNSService()
      case 'naver-cloud':
        return new NaverCloudSMSService()
      case 'development':
      default:
        return new DevelopmentSMSService()
    }
  }
}

// 기본 SMS 서비스 인스턴스
const smsService = SMSServiceFactory.createService()

// 외부에서 사용할 함수들
export const sendSMS = async (phoneNumber: string, message: string): Promise<boolean> => {
  return smsService.sendSMS(phoneNumber, message)
}

export const sendVerificationCode = async (phoneNumber: string, code: string): Promise<boolean> => {
  return smsService.sendVerificationCode(phoneNumber, code)
}

// SMS 서비스 설정 확인
export const checkSMSServiceConfig = (): void => {
  const smsProvider = process.env.SMS_PROVIDER || 'development'
  
  console.log('📱 SMS 서비스 설정:')
  console.log(`   공급사: ${smsProvider}`)
  
  switch (smsProvider.toLowerCase()) {
    case 'twilio':
      console.log('   Twilio 설정 확인 중...')
      if (!process.env.TWILIO_ACCOUNT_SID) console.log('   ❌  TWILIO_ACCOUNT_SID 미설정')
      if (!process.env.TWILIO_AUTH_TOKEN) console.log('   ❌  TWILIO_AUTH_TOKEN 미설정')
      if (!process.env.TWILIO_FROM_NUMBER) console.log('   ❌  TWILIO_FROM_NUMBER 미설정')
      break
      
    case 'aws-sns':
      console.log('   AWS SNS 설정 확인 중...')
      if (!process.env.AWS_ACCESS_KEY_ID) console.log('   ❌  AWS_ACCESS_KEY_ID 미설정')
      if (!process.env.AWS_SECRET_ACCESS_KEY) console.log('   ❌  AWS_SECRET_ACCESS_KEY 미설정')
      if (!process.env.AWS_REGION) console.log('   ❌  AWS_REGION 미설정')
      break
      
    case 'naver-cloud':
      console.log('   Naver Cloud 설정 확인 중...')
      if (!process.env.NAVER_CLOUD_ACCESS_KEY) console.log('   ❌  NAVER_CLOUD_ACCESS_KEY 미설정')
      if (!process.env.NAVER_CLOUD_SECRET_KEY) console.log('   ❌  NAVER_CLOUD_SECRET_KEY 미설정')
      if (!process.env.NAVER_CLOUD_SMS_SERVICE_ID) console.log('   ❌  NAVER_CLOUD_SMS_SERVICE_ID 미설정')
      if (!process.env.NAVER_CLOUD_SMS_FROM_NUMBER) console.log('   ❌  NAVER_CLOUD_SMS_FROM_NUMBER 미설정')
      break
      
    default:
      console.log('   개발 환경 모드 (콘솔 로그)')
  }
} 
