// SMS ?�비???�터?�이??
export interface SMSService {
  sendSMS(phoneNumber: string, message: string): Promise<boolean>
  sendVerificationCode(phoneNumber: string, code: string): Promise<boolean>
}

// 개발 ?�경??SMS ?�비??(콘솔 로그)
class DevelopmentSMSService implements SMSService {
  async sendSMS(phoneNumber: string, message: string): Promise<boolean> {
    try {
      console.log('?�� [SMS 발송]')
      console.log(`?�� ?�신번호: ${phoneNumber}`)
      console.log(`?�� 메시지: ${message}`)
      console.log('??SMS 발송 ?�공 (개발 ?�경)')
      
      // 개발 ?�경?�서????�� ?�공?�로 처리
      return true
    } catch (error) {
      console.error('??SMS 발송 ?�패:', error)
      return false
    }
  }

  async sendVerificationCode(phoneNumber: string, code: string): Promise<boolean> {
    const message = `[MetroWork] ?�증번호: ${code} (5분간 ?�효)`
    return this.sendSMS(phoneNumber, message)
  }
}

// Twilio SMS ?�비??
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
      // Twilio ?�라?�언??초기??
      const twilio = require('twilio')
      const client = twilio(this.accountSid, this.authToken)

      // SMS 발송
      await client.messages.create({
        body: message,
        from: this.fromNumber,
        to: phoneNumber
      })

      console.log(`??Twilio SMS 발송 ?�공: ${phoneNumber}`)
      return true
    } catch (error) {
      console.error('??Twilio SMS 발송 ?�패:', error)
      return false
    }
  }

  async sendVerificationCode(phoneNumber: string, code: string): Promise<boolean> {
    const message = `[MetroWork] ?�증번호: ${code} (5분간 ?�효)`
    return this.sendSMS(phoneNumber, message)
  }
}

// AWS SNS SMS ?�비??
class AWSSNSService implements SMSService {
  private sns: any
  private region: string

  constructor() {
    const AWS = require('aws-sdk')
    this.region = process.env.AWS_REGION || 'ap-northeast-2'
    
    AWS.config.update({
      region: this.region,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    })

    this.sns = new AWS.SNS()
  }

  async sendSMS(phoneNumber: string, message: string): Promise<boolean> {
    try {
      const params = {
        Message: message,
        PhoneNumber: phoneNumber
      }

      await this.sns.publish(params).promise()
      console.log(`??AWS SNS SMS 발송 ?�공: ${phoneNumber}`)
      return true
    } catch (error) {
      console.error('??AWS SNS SMS 발송 ?�패:', error)
      return false
    }
  }

  async sendVerificationCode(phoneNumber: string, code: string): Promise<boolean> {
    const message = `[MetroWork] ?�증번호: ${code} (5분간 ?�효)`
    return this.sendSMS(phoneNumber, message)
  }
}

// ?�이�??�라?�드 ?�랫??SMS ?�비??
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
      const axios = require('axios')

      const timestamp = Date.now().toString()
      const signature = crypto
        .createHmac('sha256', this.secretKey)
        .update(`POST /sms/v2/services/${this.serviceId}/messages\n${timestamp}\n${this.accessKey}`)
        .digest('base64')

      const response = await axios.post(
        `https://sens.apigw.ntruss.com/sms/v2/services/${this.serviceId}/messages`,
        {
          type: 'SMS',
          from: this.fromNumber,
          content: message,
          messages: [
            {
              to: phoneNumber
            }
          ]
        },
        {
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'x-ncp-apigw-timestamp': timestamp,
            'x-ncp-iam-access-key': this.accessKey,
            'x-ncp-apigw-signature-v2': signature
          }
        }
      )

      console.log(`??Naver Cloud SMS 발송 ?�공: ${phoneNumber}`)
      return true
    } catch (error) {
      console.error('??Naver Cloud SMS 발송 ?�패:', error)
      return false
    }
  }

  async sendVerificationCode(phoneNumber: string, code: string): Promise<boolean> {
    const message = `[MetroWork] ?�증번호: ${code} (5분간 ?�효)`
    return this.sendSMS(phoneNumber, message)
  }
}

// SMS ?�비???�토�?
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

// 기본 SMS ?�비???�스?�스
const smsService = SMSServiceFactory.createService()

// ?��??�서 ?�용???�수??
export const sendSMS = async (phoneNumber: string, message: string): Promise<boolean> => {
  return smsService.sendSMS(phoneNumber, message)
}

export const sendVerificationCode = async (phoneNumber: string, code: string): Promise<boolean> => {
  return smsService.sendVerificationCode(phoneNumber, code)
}

// SMS ?�비???�정 ?�인
export const checkSMSServiceConfig = (): void => {
  const smsProvider = process.env.SMS_PROVIDER || 'development'
  
  console.log('?�� SMS ?�비???�정:')
  console.log(`   ?�공?? ${smsProvider}`)
  
  switch (smsProvider.toLowerCase()) {
    case 'twilio':
      console.log('   Twilio ?�정 ?�인 �?..')
      if (!process.env.TWILIO_ACCOUNT_SID) console.log('   ?�️  TWILIO_ACCOUNT_SID 미설??)
      if (!process.env.TWILIO_AUTH_TOKEN) console.log('   ?�️  TWILIO_AUTH_TOKEN 미설??)
      if (!process.env.TWILIO_FROM_NUMBER) console.log('   ?�️  TWILIO_FROM_NUMBER 미설??)
      break
      
    case 'aws-sns':
      console.log('   AWS SNS ?�정 ?�인 �?..')
      if (!process.env.AWS_ACCESS_KEY_ID) console.log('   ?�️  AWS_ACCESS_KEY_ID 미설??)
      if (!process.env.AWS_SECRET_ACCESS_KEY) console.log('   ?�️  AWS_SECRET_ACCESS_KEY 미설??)
      if (!process.env.AWS_REGION) console.log('   ?�️  AWS_REGION 미설??)
      break
      
    case 'naver-cloud':
      console.log('   Naver Cloud ?�정 ?�인 �?..')
      if (!process.env.NAVER_CLOUD_ACCESS_KEY) console.log('   ?�️  NAVER_CLOUD_ACCESS_KEY 미설??)
      if (!process.env.NAVER_CLOUD_SECRET_KEY) console.log('   ?�️  NAVER_CLOUD_SECRET_KEY 미설??)
      if (!process.env.NAVER_CLOUD_SMS_SERVICE_ID) console.log('   ?�️  NAVER_CLOUD_SMS_SERVICE_ID 미설??)
      if (!process.env.NAVER_CLOUD_SMS_FROM_NUMBER) console.log('   ?�️  NAVER_CLOUD_SMS_FROM_NUMBER 미설??)
      break
      
    default:
      console.log('   개발 ?�경 모드 (콘솔 로그)')
  }
} 
