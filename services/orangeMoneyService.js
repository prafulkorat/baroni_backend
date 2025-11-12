import axios from 'axios';
import { preparePhoneForExternalAPI } from '../utils/normalizeContact.js';

const ORANGE_MONEY_BASE_URL = process.env.ORANGE_MONEY_BASE_URL || 'http://35.242.129.85:80';
const PROJECT_CODE = 'BR';

class OrangeMoneyService {
  constructor() {
    this.token = null;
    this.tokenExpiry = null;
  }

  /**
   * Test connection to Orange Money API
   * @returns {Promise<Object>} Connection test result
   */
  async testConnection() {
    try {
      console.log('Testing Orange Money API connection...');
      console.log('Base URL:', ORANGE_MONEY_BASE_URL);
      
      // Test token endpoint
      const tokenResponse = await axios.get(`${ORANGE_MONEY_BASE_URL}/token`, {
        timeout: 10000 // 10 second timeout
      });
      
      console.log('Token endpoint test:', {
        status: tokenResponse.status,
        data: tokenResponse.data,
        dataType: typeof tokenResponse.data
      });
      
      return {
        success: true,
        message: 'Orange Money API connection successful',
        tokenEndpoint: {
          status: tokenResponse.status,
          dataType: typeof tokenResponse.data,
          hasData: !!tokenResponse.data
        }
      };
    } catch (error) {
      console.error('Orange Money API connection test failed:', {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        data: error.response?.data
      });
      
      return {
        success: false,
        message: 'Orange Money API connection failed',
        error: {
          message: error.message,
          code: error.code,
          status: error.response?.status,
          data: error.response?.data
        }
      };
    }
  }
  async getAccessToken() {
    try {
      // Check if we have a cached token
      if (this.token && this.tokenExpiry && Date.now() < this.tokenExpiry) {
        return this.token;
      }

      const response = await axios.get(`${ORANGE_MONEY_BASE_URL}/token`);
      console.log("Orange Money Token Response:", {
        status: response.status,
        data: response.data,
        dataType: typeof response.data
      });
      
      if (response.status !== 200) {
        throw new Error(`Token request failed with status ${response.status}`);
      }

      // Token is always returned directly in response.data as a string
      if (!response.data || typeof response.data !== 'string') {
        throw new Error('Invalid token response');
      }

      this.token = response.data;
      // Set token expiry to 1 hour from now (assuming token is valid for 1 hour)
      this.tokenExpiry = Date.now() + (60 * 60 * 1000);
      return this.token;
    } catch (error) {
      throw new Error('Failed to get Orange Money access token');
    }
  }

  /**
   * Initiate payment with Orange Money
   * @param {Object} paymentData - Payment data
   * @param {string} paymentData.msisdn - Phone number
   * @param {number} paymentData.montant - Payment amount
   * @param {string} paymentData.motif - Payment reason (BeStar, VideoCall, Dedication, LiveshowHost, LiveshowJoin)
   * @param {string} paymentData.nameStar - Name of the star (optional)
   * @param {string} paymentData.marchand - Merchant identifier (optional)
   * @returns {Promise<Object>} Payment response
   */
  async initiatePayment(paymentData) {
    try {
      const token = await this.getAccessToken();

      const { msisdn, montant, motif, nameStar, marchand } = paymentData;
      
      // Remove + prefix from phone number for Orange Money API (same as OTP flow)
      const cleanMsisdn = preparePhoneForExternalAPI(msisdn);
      
      console.log('Orange Money Payment - Phone Number Processing:', {
        originalMsisdn: msisdn,
        cleanMsisdn: cleanMsisdn,
        hasPlusPrefix: msisdn.startsWith('+')
      });
      
      const params = new URLSearchParams({
        msisdn: cleanMsisdn,
        montant: montant.toString(),
        prefixe: PROJECT_CODE,
        motif
      });

      if (nameStar) {
        params.append('nameStar', nameStar);
      }

      if (marchand) {
        params.append('marchand', marchand);
      }

      console.log('Orange Money Payment Request:', {
        url: `${ORANGE_MONEY_BASE_URL}/initierPaiementBaroniV2?${params.toString()}`,
        headers: {
          'Authorization': token?.toLowerCase?.().startsWith('bearer ') ? token : `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        params: {
          msisdn: cleanMsisdn,
          montant: montant.toString(),
          prefixe: PROJECT_CODE,
          motif,
          nameStar: nameStar || 'N/A',
          marchand: marchand || 'N/A'
        }
      });

      const response = await axios.post(
        `${ORANGE_MONEY_BASE_URL}/initierPaiementBaroniV2?${params.toString()}`,
        {},
        {
          headers: {
            // Support both raw token and pre-prefixed Bearer tokens
            'Authorization': token?.toLowerCase?.().startsWith('bearer ') ? token : `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('Orange Money Payment Response:', {
        status: response.status,
        data: response.data,
        headers: response.headers
      });

      if (response.status === 200 && (response.data.code === '200' || response.data.code === 200)) {
        return {
          success: true,
          transactionId: response.data.transactionId,
          message: response.data.data?.message || 'Payment initiated successfully'
        };
      } else {
        const errMsg = response.data?.error || response.data?.message || `Payment initiation failed with status ${response.status}`;
        console.error('Orange Money Payment Error Details:', {
          status: response.status,
          data: response.data,
          errorMessage: errMsg
        });
        throw new Error(errMsg);
      }
    } catch (error) {
      console.error('Error initiating Orange Money payment:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      // Bubble up the upstream message to aid debugging while keeping a generic outer message
      throw new Error(error.message || 'Failed to initiate Orange Money payment');
    }
  }

  /**
   * Map Baroni transaction types to Orange Money motifs
   * @param {string} transactionType - Baroni transaction type
   * @returns {string} Orange Money motif
   */
  mapTransactionTypeToMotif(transactionType) {
    const motifMap = {
      'appointment_payment': 'VideoCall',
      'dedication_request_payment': 'Dedicace',
      'dedication_payment': 'Dedicace',
      'live_show_attendance_payment': 'LiveshowJoin',
      'live_show_hosting_payment': 'LiveshowHost',
      'become_star_payment': 'BeStar',
      'service_payment': 'VideoCall' // Default to VideoCall for service payments
    };

    return motifMap[transactionType] || 'VideoCall';
  }

  /**
   * Validate payment callback data
   * @param {Object} callbackData - Callback data from Orange Money
   * @returns {Object} Validated callback data
   */
  validateCallbackData(callbackData) {
    console.log('=== ORANGE MONEY VALIDATION ===');
    console.log('Input callback data:', JSON.stringify(callbackData, null, 2));
    
    const { transactionId, status, motif, montant } = callbackData;
    
    console.log('Extracted fields:', {
      transactionId,
      status,
      motif,
      montant,
      transactionIdType: typeof transactionId,
      statusType: typeof status,
      motifType: typeof motif,
      montantType: typeof montant
    });

    if (!transactionId || !status || !montant) {
      console.log('Missing required fields:', {
        hasTransactionId: !!transactionId,
        hasStatus: !!status,
        hasMontant: !!montant
      });
      throw new Error('Missing required callback data');
    }

    if (!['OK', 'KO'].includes(status)) {
      console.log('Invalid status:', status);
      throw new Error('Invalid payment status');
    }

    const validatedResult = {
      transactionId,
      status: status === 'OK' ? 'completed' : 'failed',
      motif: motif || 'NA',
      amount: parseFloat(montant)
    };
    
    console.log('Validated result:', JSON.stringify(validatedResult, null, 2));
    console.log('================================');
    
    return validatedResult;
  }
}

export default new OrangeMoneyService();

