import { validationResult, body, param } from 'express-validator';
import CommissionConfig from '../models/CommissionConfig.js';

export const getCommissionConfig = async (req, res) => {
  try {
    const cfg = await CommissionConfig.getSingleton();
    return res.json({ success: true, data: cfg });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const updateGlobalCommission = async (req, res) => {
  try {
    const { globalDefault } = req.body;
    if (typeof globalDefault !== 'number' || globalDefault < 0 || globalDefault > 1) {
      return res.status(400).json({ success: false, message: 'globalDefault must be between 0 and 1' });
    }
    const cfg = await CommissionConfig.getSingleton();
    cfg.globalDefault = globalDefault;
    cfg.updatedBy = req.user?._id;
    await cfg.save();
    return res.json({ success: true, data: cfg });
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
    for (const key of Object.keys(serviceDefaults)) {
      if (!allowed.includes(key)) return res.status(400).json({ success: false, message: `Invalid key ${key}` });
      const v = Number(serviceDefaults[key]);
      if (Number.isNaN(v) || v < 0 || v > 1) return res.status(400).json({ success: false, message: `Invalid rate for ${key}` });
    }
    const cfg = await CommissionConfig.getSingleton();
    cfg.serviceDefaults = { ...cfg.serviceDefaults?.toObject?.() || {}, ...serviceDefaults };
    cfg.updatedBy = req.user?._id;
    await cfg.save();
    return res.json({ success: true, data: cfg });
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
    for (const k of allowed) {
      if (rates[k] !== undefined) {
        const v = Number(rates[k]);
        if (Number.isNaN(v) || v < 0 || v > 1) return res.status(400).json({ success: false, message: `Invalid rate for ${k}` });
      }
    }
    const cfg = await CommissionConfig.getSingleton();
    const list = cfg.countryOverrides || [];
    const idx = list.findIndex((c) => c.countryCode === norm);
    const mergedRates = idx >= 0 ? { ...list[idx].rates?.toObject?.() || list[idx].rates, ...rates } : rates;
    if (idx >= 0) {
      list[idx] = { country: country || list[idx].country, countryCode: norm, rates: mergedRates };
    } else {
      list.push({ country, countryCode: norm, rates: mergedRates });
    }
    cfg.countryOverrides = list;
    cfg.updatedBy = req.user?._id;
    await cfg.save();
    return res.status(idx >= 0 ? 200 : 201).json({ success: true, data: cfg });
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


