import CommissionConfig from '../models/CommissionConfig.js';

export const getEffectiveCommission = async ({ serviceType, countryCode }) => {
  const cfg = await CommissionConfig.getSingleton();
  const mapKey = serviceType === 'video_call' ? 'videoCall' : serviceType === 'live_show' ? 'liveShow' : 'dedication';

  // country override
  if (countryCode) {
    const found = (cfg.countryOverrides || []).find(
      (c) => c.countryCode?.toUpperCase() === String(countryCode).toUpperCase()
    );
    if (found?.rates?.[mapKey] !== undefined) return Number(found.rates[mapKey]);
  }

  // service default
  if (cfg.serviceDefaults && cfg.serviceDefaults[mapKey] !== undefined) {
    return Number(cfg.serviceDefaults[mapKey]);
  }

  // global fallback
  return Number(cfg.globalDefault || 0);
};

export const applyCommission = (amount, rate) => {
  const commission = Math.round((Number(amount) * Number(rate)) * 100) / 100;
  const netAmount = Math.round((Number(amount) - commission) * 100) / 100;
  return { commission, netAmount };
};


