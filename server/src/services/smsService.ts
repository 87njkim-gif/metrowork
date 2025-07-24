// SMS ?úÎπÑ???∏ÌÑ∞?òÏù¥??
export interface SMSService {
  sendSMS(phoneNumber: string, message: string): Promise<boolean>
  sendVerificationCode(phoneNumber: string, code: string): Promise<boolean>
}

// Í∞úÎ∞ú ?òÍ≤Ω??SMS ?úÎπÑ??(ÏΩòÏÜî Î°úÍ∑∏)
class DevelopmentSMSService implements SMSService {
  async sendSMS(phoneNumber: string, message: string): Promise<boolean> {
    try {
      console.log('?ì± [SMS Î∞úÏÜ°]')
      console.log(`?ìû ?òÏã†Î≤àÌò∏: ${phoneNumber}`)
      console.log(`?ìù Î©îÏãúÏßÄ: ${message}`)
      console.log('??SMS Î∞úÏÜ° ?±Í≥µ (Í∞úÎ∞ú ?òÍ≤Ω)')
      
      // Í∞úÎ∞ú ?òÍ≤Ω?êÏÑú????ÉÅ ?±Í≥µ?ºÎ°ú Ï≤òÎ¶¨
      return true
    } catch (error) {
      console.error('??SMS Î∞úÏÜ° ?§Ìå®:', error)
      return false
    }
  }

  async sendVerificationCode(phoneNumber: string, code: string): Promise<boolean> {
    const message = `[MetroWork] ?∏Ï¶ùÎ≤àÌò∏: ${code} (5Î∂ÑÍ∞Ñ ?†Ìö®)`
    return this.sendSMS(phoneNumber, message)
  }
}

// Twilio SMS ?úÎπÑ??
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
      // Twilio ?¥Îùº?¥Ïñ∏??Ï¥àÍ∏∞??
      const twilio = require('twilio')
      const client = twilio(this.accountSid, this.authToken)

      // SMS Î∞úÏÜ°
      await client.messages.create({
        body: message,
        from: this.fromNumber,
        to: phoneNumber
      })

      console.log(`??Twilio SMS Î∞úÏÜ° ?±Í≥µ: ${phoneNumber}`)
      return true
    } catch (error) {
      console.error('??Twilio SMS Î∞úÏÜ° ?§Ìå®:', error)
      return false
    }
  }

  async sendVerificationCode(phoneNumber: string, code: string): Promise<boolean> {
    const message = `[MetroWork] ?∏Ï¶ùÎ≤àÌò∏: ${code} (5Î∂ÑÍ∞Ñ ?†Ìö®)`
    return this.sendSMS(phoneNumber, message)
  }
}

// AWS SNS SMS ?úÎπÑ??
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
      console.log(`??AWS SNS SMS Î∞úÏÜ° ?±Í≥µ: ${phoneNumber}`)
      return true
    } catch (error) {
      console.error('??AWS SNS SMS Î∞úÏÜ° ?§Ìå®:', error)
      return false
    }
  }

  async sendVerificationCode(phoneNumber: string, code: string): Promise<boolean> {
    const message = `[MetroWork] ?∏Ï¶ùÎ≤àÌò∏: ${code} (5Î∂ÑÍ∞Ñ ?†Ìö®)`
    return this.sendSMS(phoneNumber, message)
  }
}

// ?§Ïù¥Î≤??¥Îùº?∞Îìú ?åÎû´??SMS ?úÎπÑ??
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

      console.log(`??Naver Cloud SMS Î∞úÏÜ° ?±Í≥µ: ${phoneNumber}`)
      return true
    } catch (error) {
      console.error('??Naver Cloud SMS Î∞úÏÜ° ?§Ìå®:', error)
      return false
    }
  }

  async sendVerificationCode(phoneNumber: string, code: string): Promise<boolean> {
    const message = `[MetroWork] ?∏Ï¶ùÎ≤àÌò∏: ${code} (5Î∂ÑÍ∞Ñ ?†Ìö®)`
    return this.sendSMS(phoneNumber, message)
  }
}

// SMS ?úÎπÑ???©ÌÜ†Î¶?
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

// Í∏∞Î≥∏ SMS ?úÎπÑ???∏Ïä§?¥Ïä§
const smsService = SMSServiceFactory.createService()

// ?∏Î??êÏÑú ?¨Ïö©???®Ïàò??
export const sendSMS = async (phoneNumber: string, message: string): Promise<boolean> => {
  return smsService.sendSMS(phoneNumber, message)
}

export const sendVerificationCode = async (phoneNumber: string, code: string): Promise<boolean> => {
  return smsService.sendVerificationCode(phoneNumber, code)
}

// SMS ?úÎπÑ???§Ï†ï ?ïÏù∏
export const checkSMSServiceConfig = (): void => {
  const smsProvider = process.env.SMS_PROVIDER || 'development'
  
  console.log('?ì± SMS ?úÎπÑ???§Ï†ï:')
  console.log(`   ?úÍ≥µ?? ${smsProvider}`)
  
  switch (smsProvider.toLowerCase()) {
    case 'twilio':
      console.log('   Twilio ?§Ï†ï ?ïÏù∏ Ï§?..')
      if (!process.env.TWILIO_ACCOUNT_SID) console.log('   ?†Ô∏è  TWILIO_ACCOUNT_SID ÎØ∏ÏÑ§??)
      if (!process.env.TWILIO_AUTH_TOKEN) console.log('   ?†Ô∏è  TWILIO_AUTH_TOKEN ÎØ∏ÏÑ§??)
      if (!process.env.TWILIO_FROM_NUMBER) console.log('   ?†Ô∏è  TWILIO_FROM_NUMBER ÎØ∏ÏÑ§??)
      break
      
    case 'aws-sns':
      console.log('   AWS SNS ?§Ï†ï ?ïÏù∏ Ï§?..')
      if (!process.env.AWS_ACCESS_KEY_ID) console.log('   ?†Ô∏è  AWS_ACCESS_KEY_ID ÎØ∏ÏÑ§??)
      if (!process.env.AWS_SECRET_ACCESS_KEY) console.log('   ?†Ô∏è  AWS_SECRET_ACCESS_KEY ÎØ∏ÏÑ§??)
      if (!process.env.AWS_REGION) console.log('   ?†Ô∏è  AWS_REGION ÎØ∏ÏÑ§??)
      break
      
    case 'naver-cloud':
      console.log('   Naver Cloud ?§Ï†ï ?ïÏù∏ Ï§?..')
      if (!process.env.NAVER_CLOUD_ACCESS_KEY) console.log('   ?†Ô∏è  NAVER_CLOUD_ACCESS_KEY ÎØ∏ÏÑ§??)
      if (!process.env.NAVER_CLOUD_SECRET_KEY) console.log('   ?†Ô∏è  NAVER_CLOUD_SECRET_KEY ÎØ∏ÏÑ§??)
      if (!process.env.NAVER_CLOUD_SMS_SERVICE_ID) console.log('   ?†Ô∏è  NAVER_CLOUD_SMS_SERVICE_ID ÎØ∏ÏÑ§??)
      if (!process.env.NAVER_CLOUD_SMS_FROM_NUMBER) console.log('   ?†Ô∏è  NAVER_CLOUD_SMS_FROM_NUMBER ÎØ∏ÏÑ§??)
      break
      
    default:
      console.log('   Í∞úÎ∞ú ?òÍ≤Ω Î™®Îìú (ÏΩòÏÜî Î°úÍ∑∏)')
  }
} 
