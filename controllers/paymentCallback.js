import { validationResult } from 'express-validator';
import { getFirstValidationError } from '../utils/validationHelper.js';
import { 
  processPaymentCallback, 
  handlePaymentTimeout as processPaymentTimeout
} from '../services/paymentCallbackService.js';
import orangeMoneyService from '../services/orangeMoneyService.js';
import { preparePhoneForExternalAPI } from '../utils/normalizeContact.js';

/**
 * Handle Orange Money payment callback
 * POST /api/payment/callback
 */
export const handlePaymentCallback = async (req, res) => {
  try {
    // Log the complete callback request structure
    console.log('=== PAYMENT CALLBACK RECEIVED ===');
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Body:', JSON.stringify(req.body, null, 2));
    console.log('Query:', JSON.stringify(req.query, null, 2));
    console.log('Method:', req.method);
    console.log('URL:', req.url);
    console.log('IP:', req.ip);
    console.log('User-Agent:', req.get('User-Agent'));
    console.log('Content-Type:', req.get('Content-Type'));
    console.log('================================');

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      const errorMessage = getFirstValidationError(errors);
      return res.status(400).json({ 
        success: false, 
        message: errorMessage || 'Invalid callback data'
      });
    }

    const callbackData = req.body;
    console.log('Processing callback data:', callbackData);
    const result = await processPaymentCallback(callbackData);

    return res.status(200).json({
      success: true,
      message: 'Payment callback processed successfully',
      data: result
    });

  } catch (err) {
    console.error('Error processing payment callback:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Error processing payment callback',
      error: err.message 
    });
  }
};

/**
 * Handle payment timeout and refund
 * This endpoint can be called by a cron job or scheduler
 * POST /api/payment/timeout
 */
export const handlePaymentTimeout = async (req, res) => {
  try {
    const result = await processPaymentTimeout();
    
    return res.status(200).json({
      success: true,
      message: 'Payment timeout check completed',
      data: result
    });
  } catch (err) {
    console.error('Error handling payment timeout:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Error handling payment timeout',
      error: err.message 
    });
  }
};

/**
 * Test phone number processing for external APIs
 * POST /api/payment/test-phone
 */
export const testPhoneNumberProcessing = async (req, res) => {
  try {
    const { phoneNumber = '+237123456789' } = req.body;

    console.log('=== Phone Number Processing Test ===');
    
    // Test the phone number processing
    const originalPhone = phoneNumber;
    const processedPhone = preparePhoneForExternalAPI(phoneNumber);
    
    // Test Orange Money service phone processing
    let orangeMoneyTest;
    try {
      // This will test the phone processing without actually making the payment
      const testPaymentData = {
        msisdn: originalPhone,
        montant: 100,
        motif: 'VideoCall',
        nameStar: 'Test Star'
      };
      
      // Just test the phone processing part
      const cleanMsisdn = preparePhoneForExternalAPI(testPaymentData.msisdn);
      orangeMoneyTest = {
        success: true,
        originalMsisdn: testPaymentData.msisdn,
        cleanMsisdn: cleanMsisdn,
        hasPlusPrefix: testPaymentData.msisdn.startsWith('+')
      };
    } catch (error) {
      orangeMoneyTest = {
        success: false,
        error: error.message
      };
    }

    return res.status(200).json({
      success: true,
      message: 'Phone number processing test completed',
      data: {
        testParameters: { phoneNumber },
        phoneProcessing: {
          originalPhone,
          processedPhone,
          hasPlusPrefix: originalPhone.startsWith('+'),
          plusRemoved: originalPhone !== processedPhone
        },
        orangeMoneyTest,
        timestamp: new Date().toISOString()
      }
    });

  } catch (err) {
    console.error('Error in phone number processing test:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Error in phone number processing test',
      error: err.message 
    });
  }
};
