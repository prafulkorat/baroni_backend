import { validationResult } from 'express-validator';
import { getFirstValidationError } from '../utils/validationHelper.js';
import Config from '../models/Config.js';
import Category from '../models/Category.js';
import CountryServiceConfig from '../models/CountryServiceConfig.js';

const sanitizeConfig = (cfg) => ({
  id: cfg._id,
  // Existing fields
  liveShowPriceHide: cfg.liveShowPriceHide,
  videoCallPriceHide: cfg.videoCallPriceHide,
  becomeBaronistarPriceHide: cfg.becomeBaronistarPriceHide,
  isTestUser: cfg.isTestUser,
  
  // New fields
  serviceLimits: cfg.serviceLimits,
  idVerificationFees: cfg.idVerificationFees,
  liveShowFees: cfg.liveShowFees,
  contactSupport: cfg.contactSupport,
  hideElementsPrice: cfg.hideElementsPrice,
  hideApplyToBecomeStar: cfg.hideApplyToBecomeStar,
  
  createdAt: cfg.createdAt,
  updatedAt: cfg.updatedAt,
});

// Get Global Configuration
export const getGlobalConfig = async (_req, res) => {
  try {
    const cfg = await Config.getSingleton();
    return res.json({ 
      success: true, 
      message: 'Global configuration retrieved successfully',
      data: {
        config: sanitizeConfig(cfg)
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Update Global Configuration
export const updateGlobalConfig = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessage = getFirstValidationError(errors);
      return res.status(400).json({ success: false, message: errorMessage || 'Validation failed' });
    }

    const cfg = await Config.getSingleton();

    const {
      liveShowPriceHide,
      videoCallPriceHide,
      becomeBaronistarPriceHide,
      isTestUser,
      serviceLimits,
      idVerificationFees,
      liveShowFees,
      contactSupport,
      hideElementsPrice,
      hideApplyToBecomeStar
    } = req.body;

    const normalize = (val) => {
      if (typeof val === 'boolean') return val;
      if (typeof val === 'string') {
        const lower = val.toLowerCase();
        if (lower === 'true') return true;
        if (lower === 'false') return false;
      }
      return undefined;
    };

    // Update existing fields
    if (typeof normalize(liveShowPriceHide) === 'boolean') cfg.liveShowPriceHide = normalize(liveShowPriceHide);
    if (typeof normalize(videoCallPriceHide) === 'boolean') cfg.videoCallPriceHide = normalize(videoCallPriceHide);
    if (typeof normalize(becomeBaronistarPriceHide) === 'boolean') cfg.becomeBaronistarPriceHide = normalize(becomeBaronistarPriceHide);
    if (typeof normalize(isTestUser) === 'boolean') cfg.isTestUser = normalize(isTestUser);
    if (typeof normalize(hideApplyToBecomeStar) === 'boolean') cfg.hideApplyToBecomeStar = normalize(hideApplyToBecomeStar);

    // Update nested objects
    if (serviceLimits) {
      cfg.serviceLimits = { ...cfg.serviceLimits, ...serviceLimits };
    }
    if (idVerificationFees) {
      cfg.idVerificationFees = { ...cfg.idVerificationFees, ...idVerificationFees };
    }
    if (liveShowFees) {
      cfg.liveShowFees = { ...cfg.liveShowFees, ...liveShowFees };
    }
    if (contactSupport) {
      cfg.contactSupport = { ...cfg.contactSupport, ...contactSupport };
    }
    if (hideElementsPrice) {
      cfg.hideElementsPrice = { ...cfg.hideElementsPrice, ...hideElementsPrice };
    }

    const saved = await cfg.save();
    return res.json({ 
      success: true, 
      message: 'Global configuration updated successfully',
      data: {
        config: sanitizeConfig(saved)
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Category Management APIs (using existing Category model)
export const getCategories = async (req, res) => {
  try {
    const categories = await Category.find()
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      message: 'Categories retrieved successfully',
      data: {
        categories: categories.map(cat => ({
          id: cat._id,
          name: cat.name,
          image: cat.image,
          createdAt: cat.createdAt,
          updatedAt: cat.updatedAt
        }))
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Country Service Configuration APIs
export const getCountryServiceConfigs = async (req, res) => {
  try {
    const { isActive } = req.query;
    const filter = {};
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    const countryConfigs = await CountryServiceConfig.find(filter)
      .sort({ sortOrder: 1, country: 1 });

    return res.json({
      success: true,
      message: 'Country service configurations retrieved successfully',
      data: {
        countryConfigs: countryConfigs.map(config => ({
          id: config._id,
          country: config.country,
          countryCode: config.countryCode,
          services: config.services,
          isActive: config.isActive,
          sortOrder: config.sortOrder,
          createdAt: config.createdAt,
          updatedAt: config.updatedAt
        }))
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const createCountryServiceConfig = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessage = getFirstValidationError(errors);
      return res.status(400).json({ success: false, message: errorMessage || 'Validation failed' });
    }

    const { country, countryCode, services, sortOrder } = req.body;

    const countryConfig = new CountryServiceConfig({
      country,
      countryCode,
      services: services || { videoCall: true, dedication: true, liveShow: true },
      sortOrder: sortOrder || 0
    });

    await countryConfig.save();

    return res.status(201).json({
      success: true,
      message: 'Country service configuration created successfully',
      data: {
        countryConfig: {
          id: countryConfig._id,
          country: countryConfig.country,
          countryCode: countryConfig.countryCode,
          services: countryConfig.services,
          isActive: countryConfig.isActive,
          sortOrder: countryConfig.sortOrder,
          createdAt: countryConfig.createdAt,
          updatedAt: countryConfig.updatedAt
        }
      }
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'Country service configuration already exists' });
    }
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const updateCountryServiceConfig = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessage = getFirstValidationError(errors);
      return res.status(400).json({ success: false, message: errorMessage || 'Validation failed' });
    }

    const { configId } = req.params;
    const { country, countryCode, services, isActive, sortOrder } = req.body;

    const countryConfig = await CountryServiceConfig.findByIdAndUpdate(
      configId,
      { country, countryCode, services, isActive, sortOrder },
      { new: true, runValidators: true }
    );

    if (!countryConfig) {
      return res.status(404).json({ success: false, message: 'Country service configuration not found' });
    }

    return res.json({
      success: true,
      message: 'Country service configuration updated successfully',
      data: {
        countryConfig: {
          id: countryConfig._id,
          country: countryConfig.country,
          countryCode: countryConfig.countryCode,
          services: countryConfig.services,
          isActive: countryConfig.isActive,
          sortOrder: countryConfig.sortOrder,
          createdAt: countryConfig.createdAt,
          updatedAt: countryConfig.updatedAt
        }
      }
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'Country service configuration already exists' });
    }
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteCountryServiceConfig = async (req, res) => {
  try {
    const { configId } = req.params;

    const countryConfig = await CountryServiceConfig.findByIdAndDelete(configId);

    if (!countryConfig) {
      return res.status(404).json({ success: false, message: 'Country service configuration not found' });
    }

    return res.json({
      success: true,
      message: 'Country service configuration deleted successfully'
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Legacy methods for backward compatibility
export const getPublicConfig = getGlobalConfig;
export const upsertConfig = updateGlobalConfig;



