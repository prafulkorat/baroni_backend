import { validationResult, body, param } from 'express-validator';
import CommissionConfig from '../models/CommissionConfig.js';

export const getCommissionConfig = async (req, res) => {
  try {
    const cfg = await CommissionConfig.getSingleton();
    
    // Format response to match UI requirements
    return res.json({ 
      success: true, 
      data: {
        globalDefault: cfg.globalDefault ? Math.round(cfg.globalDefault * 100) : 15, // Convert to percentage
        serviceDefaults: {
          videoCall: cfg.serviceDefaults?.videoCall ? Math.round(cfg.serviceDefaults.videoCall * 100) : 16,
          liveShow: cfg.serviceDefaults?.liveShow ? Math.round(cfg.serviceDefaults.liveShow * 100) : 16,
          dedication: cfg.serviceDefaults?.dedication ? Math.round(cfg.serviceDefaults.dedication * 100) : 16
        },
        countryOverrides: (cfg.countryOverrides || []).map(override => ({
          country: override.country,
          countryCode: override.countryCode,
          rates: {
            videoCall: override.rates?.videoCall ? Math.round(override.rates.videoCall * 100) : null,
            liveShow: override.rates?.liveShow ? Math.round(override.rates.liveShow * 100) : null,
            dedication: override.rates?.dedication ? Math.round(override.rates.dedication * 100) : null
          }
        })),
        updatedAt: cfg.updatedAt,
        updatedBy: cfg.updatedBy
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const updateGlobalCommission = async (req, res) => {
  try {
    const { globalDefault } = req.body;
    // Accept percentage value (e.g., 15) and convert to decimal (0.15)
    const percentageValue = typeof globalDefault === 'number' ? globalDefault : Number(globalDefault);
    if (isNaN(percentageValue) || percentageValue < 0 || percentageValue > 100) {
      return res.status(400).json({ success: false, message: 'globalDefault must be between 0 and 100 (percentage)' });
    }
    const decimalValue = percentageValue / 100;
    const cfg = await CommissionConfig.getSingleton();
    cfg.globalDefault = decimalValue;
    cfg.updatedBy = req.user?._id;
    await cfg.save();
    return res.json({ success: true, data: { globalDefault: Math.round(decimalValue * 100) } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const updateServiceDefaults = async (req, res) => {
  try {
    const { serviceDefaults } = req.body;
    const allowed = ['videoCall', 'liveShow', 'dedication'];
    if (!serviceDefaults || typeof serviceDefaults !== 'object') {
      return res.status(400).json({ success: false, message: 'serviceDefaults required' });
    }
    const cfg = await CommissionConfig.getSingleton();
    const currentDefaults = cfg.serviceDefaults?.toObject?.() || cfg.serviceDefaults || {};
    const updatedDefaults = { ...currentDefaults };
    
    // Convert percentage values to decimals
    for (const key of Object.keys(serviceDefaults)) {
      if (!allowed.includes(key)) return res.status(400).json({ success: false, message: `Invalid key ${key}` });
      const percentageValue = Number(serviceDefaults[key]);
      if (Number.isNaN(percentageValue) || percentageValue < 0 || percentageValue > 100) {
        return res.status(400).json({ success: false, message: `Invalid rate for ${key} (must be 0-100)` });
      }
      updatedDefaults[key] = percentageValue / 100; // Convert percentage to decimal
    }
    
    cfg.serviceDefaults = updatedDefaults;
    cfg.updatedBy = req.user?._id;
    await cfg.save();
    
    // Return formatted response
    return res.json({ 
      success: true, 
      data: {
        serviceDefaults: {
          videoCall: Math.round((cfg.serviceDefaults.videoCall || 0) * 100),
          liveShow: Math.round((cfg.serviceDefaults.liveShow || 0) * 100),
          dedication: Math.round((cfg.serviceDefaults.dedication || 0) * 100)
        }
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const upsertCountryOverride = async (req, res) => {
  try {
    const { country, countryCode, rates } = req.body;
    if (!country || !countryCode || !rates) {
      return res.status(400).json({ success: false, message: 'country, countryCode and rates are required' });
    }
    const norm = String(countryCode).toUpperCase();
    const allowed = ['videoCall', 'liveShow', 'dedication'];
    const cfg = await CommissionConfig.getSingleton();
    const list = cfg.countryOverrides || [];
    const idx = list.findIndex((c) => c.countryCode === norm);
    
    // Convert percentage values to decimals
    const convertedRates = {};
    for (const k of allowed) {
      if (rates[k] !== undefined) {
        const percentageValue = Number(rates[k]);
        if (Number.isNaN(percentageValue) || percentageValue < 0 || percentageValue > 100) {
          return res.status(400).json({ success: false, message: `Invalid rate for ${k} (must be 0-100)` });
        }
        convertedRates[k] = percentageValue / 100; // Convert percentage to decimal
      }
    }
    
    const mergedRates = idx >= 0 ? { ...list[idx].rates?.toObject?.() || list[idx].rates, ...convertedRates } : convertedRates;
    if (idx >= 0) {
      list[idx] = { country: country || list[idx].country, countryCode: norm, rates: mergedRates };
    } else {
      list.push({ country, countryCode: norm, rates: mergedRates });
    }
    cfg.countryOverrides = list;
    cfg.updatedBy = req.user?._id;
    await cfg.save();
    
    // Return formatted response
    const updatedOverride = cfg.countryOverrides.find(c => c.countryCode === norm);
    return res.status(idx >= 0 ? 200 : 201).json({ 
      success: true, 
      data: {
        country: updatedOverride.country,
        countryCode: updatedOverride.countryCode,
        rates: {
          videoCall: updatedOverride.rates?.videoCall ? Math.round(updatedOverride.rates.videoCall * 100) : null,
          liveShow: updatedOverride.rates?.liveShow ? Math.round(updatedOverride.rates.liveShow * 100) : null,
          dedication: updatedOverride.rates?.dedication ? Math.round(updatedOverride.rates.dedication * 100) : null
        }
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteCountryOverride = async (req, res) => {
  try {
    const code = String(req.params.countryCode || '').toUpperCase();
    const cfg = await CommissionConfig.getSingleton();
    const before = cfg.countryOverrides?.length || 0;
    cfg.countryOverrides = (cfg.countryOverrides || []).filter((c) => c.countryCode !== code);
    if ((cfg.countryOverrides?.length || 0) === before) {
      return res.status(404).json({ success: false, message: 'Override not found' });
    }
    cfg.updatedBy = req.user?._id;
    await cfg.save();
    return res.json({ success: true, data: cfg });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};


