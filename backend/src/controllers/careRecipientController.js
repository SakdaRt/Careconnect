import PatientProfile from '../models/PatientProfile.js';

const uniq = (arr) => {
  if (!Array.isArray(arr)) return null;
  const out = [];
  const seen = new Set();
  for (const raw of arr) {
    const v = String(raw || '').trim();
    if (!v) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out.length ? out : null;
};

const validatePatientProfilePayload = (payload) => {
  const ageBands = new Set(['0_12', '13_17', '18_59', '60_74', '75_89', '90_plus']);
  const genders = new Set(['female', 'male', 'other']);
  const mobility = new Set(['walk_independent', 'walk_assisted', 'wheelchair', 'bedbound']);
  const comm = new Set(['normal', 'hearing_impaired', 'speech_impaired', 'nonverbal']);
  const cognitive = new Set(['normal', 'mild_impairment', 'dementia', 'delirium', 'psychiatric']);

  const chronic = new Set([
    'hypertension',
    'diabetes',
    'heart_disease',
    'stroke_history',
    'copd_asthma',
    'kidney_disease',
    'cancer',
    'pressure_ulcer',
    'fall_history',
  ]);
  const symptoms = new Set([
    'shortness_of_breath',
    'chest_pain',
    'seizure',
    'altered_consciousness',
    'high_fever',
    'uncontrolled_bleeding',
    'severe_pain',
    'frequent_vomiting',
  ]);
  const devices = new Set(['oxygen', 'tracheostomy', 'ventilator', 'feeding_tube', 'urinary_catheter', 'wound_dressing']);
  const needs = new Set([
    'bathing',
    'dressing',
    'toileting',
    'transfer_assist',
    'feeding',
    'tube_feeding',
    'medication_reminder',
    'medication_administration',
    'vitals_check',
  ]);
  const behaviors = new Set(['fall_risk', 'wandering', 'aggression', 'choking_risk', 'infection_control']);
  const allergies = new Set(['no_known_allergies', 'food_allergy', 'drug_allergy', 'latex_allergy', 'other_allergy']);

  const errors = [];
  const currentYear = new Date().getFullYear();

  const checkEnum = (key, value, allowed) => {
    if (value === null || value === undefined || String(value).trim() === '') return;
    if (!allowed.has(String(value))) errors.push(`${key} is invalid`);
  };

  const checkFlags = (key, value, allowed) => {
    if (value === null || value === undefined) return;
    if (!Array.isArray(value)) {
      errors.push(`${key} must be an array`);
      return;
    }
    for (const raw of value) {
      const v = String(raw || '').trim();
      if (!v) continue;
      if (!allowed.has(v)) errors.push(`${key} contains invalid value`);
    }
  };

  checkEnum('age_band', payload.age_band, ageBands);
  checkEnum('gender', payload.gender, genders);
  checkEnum('mobility_level', payload.mobility_level, mobility);
  checkEnum('communication_style', payload.communication_style, comm);
  checkEnum('cognitive_status', payload.cognitive_status, cognitive);

  if (payload.birth_year !== null && payload.birth_year !== undefined && String(payload.birth_year).trim() !== '') {
    const year = Number(payload.birth_year);
    if (!Number.isInteger(year) || year < 1900 || year > currentYear) {
      errors.push('birth_year is invalid');
    }
  }

  checkFlags('chronic_conditions_flags', payload.chronic_conditions_flags, chronic);
  checkFlags('symptoms_flags', payload.symptoms_flags, symptoms);
  checkFlags('medical_devices_flags', payload.medical_devices_flags, devices);
  checkFlags('care_needs_flags', payload.care_needs_flags, needs);
  checkFlags('behavior_risks_flags', payload.behavior_risks_flags, behaviors);
  checkFlags('allergies_flags', payload.allergies_flags, allergies);

  const mobilityValue = String(payload.mobility_level || '');
  const careNeeds = new Set(Array.isArray(payload.care_needs_flags) ? payload.care_needs_flags.map((v) => String(v)) : []);
  const medicalDevices = new Set(Array.isArray(payload.medical_devices_flags) ? payload.medical_devices_flags.map((v) => String(v)) : []);

  if ((mobilityValue === 'wheelchair' || mobilityValue === 'bedbound') && !careNeeds.has('transfer_assist')) {
    errors.push('transfer_assist is required for wheelchair/bedbound');
  }
  if (careNeeds.has('tube_feeding') && !medicalDevices.has('feeding_tube')) {
    errors.push('feeding_tube is required when tube_feeding is selected');
  }
  const allergiesArr = Array.isArray(payload.allergies_flags) ? payload.allergies_flags.map((v) => String(v)) : [];
  if (allergiesArr.includes('no_known_allergies') && allergiesArr.some((v) => v !== 'no_known_allergies')) {
    errors.push('no_known_allergies cannot be combined with other allergies');
  }

  return errors;
};

const listCareRecipients = async (req, res) => {
  const hirerId = req.userId;
  const rows = await PatientProfile.findAll({ hirer_id: hirerId, is_active: true });
  res.json({ success: true, data: rows });
};

const getCareRecipient = async (req, res) => {
  const hirerId = req.userId;
  const { id } = req.params;
  const profile = await PatientProfile.findOne({ id, hirer_id: hirerId });
  if (!profile || profile.is_active === false) {
    return res.status(404).json({ success: false, error: 'Care recipient not found' });
  }
  res.json({ success: true, data: profile });
};

const createCareRecipient = async (req, res) => {
  try {
    const hirerId = req.userId;
    const {
      patient_display_name,
      address_line1,
      address_line2,
      district,
      province,
      postal_code,
      lat,
      lng,
      birth_year,
      age_band,
      gender,
      mobility_level,
      communication_style,
      cognitive_status,
      general_health_summary,
      chronic_conditions_flags,
      symptoms_flags,
      medical_devices_flags,
      care_needs_flags,
      behavior_risks_flags,
      allergies_flags,
    } = req.body || {};

    if (!patient_display_name || !String(patient_display_name).trim()) {
      return res.status(400).json({ success: false, error: 'patient_display_name is required' });
    }

    const validationErrors = validatePatientProfilePayload(req.body || {});
    if (validationErrors.length) {
      return res.status(400).json({ success: false, error: validationErrors.join(', ') });
    }

    const created = await PatientProfile.create({
      hirer_id: hirerId,
      patient_display_name: String(patient_display_name).trim(),
      address_line1: address_line1 ? String(address_line1).trim() : null,
      address_line2: address_line2 ? String(address_line2).trim() : null,
      district: district ? String(district).trim() : null,
      province: province ? String(province).trim() : null,
      postal_code: postal_code ? String(postal_code).trim() : null,
      lat: Number.isFinite(Number(lat)) ? Number(lat) : null,
      lng: Number.isFinite(Number(lng)) ? Number(lng) : null,
      birth_year: Number.isInteger(Number(birth_year)) ? Number(birth_year) : null,
      age_band: age_band ? String(age_band).trim() : null,
      gender: gender ? String(gender).trim() : null,
      mobility_level: mobility_level ? String(mobility_level).trim() : null,
      communication_style: communication_style ? String(communication_style).trim() : null,
      cognitive_status: cognitive_status ? String(cognitive_status).trim() : null,
      general_health_summary: general_health_summary ? String(general_health_summary).trim() : null,
      chronic_conditions_flags: uniq(chronic_conditions_flags),
      symptoms_flags: uniq(symptoms_flags),
      medical_devices_flags: uniq(medical_devices_flags),
      care_needs_flags: uniq(care_needs_flags),
      behavior_risks_flags: uniq(behavior_risks_flags),
      allergies_flags: uniq(allergies_flags),
      is_active: true,
      updated_at: new Date(),
    });

    res.status(201).json({ success: true, data: created });
  } catch (error) {
    console.error('[Care Recipient] Create error:', error);
    res.status(500).json({ success: false, error: 'Failed to create care recipient' });
  }
};

const updateCareRecipient = async (req, res) => {
  try {
    const hirerId = req.userId;
    const { id } = req.params;

    const existing = await PatientProfile.findOne({ id, hirer_id: hirerId });
    if (!existing || existing.is_active === false) {
      return res.status(404).json({ success: false, error: 'Care recipient not found' });
    }

    const patch = {};
    const fields = [
      'patient_display_name',
      'address_line1',
      'address_line2',
      'district',
      'province',
      'postal_code',
      'lat',
      'lng',
      'birth_year',
      'age_band',
      'gender',
      'mobility_level',
      'communication_style',
      'cognitive_status',
      'general_health_summary',
      'chronic_conditions_flags',
      'symptoms_flags',
      'medical_devices_flags',
      'care_needs_flags',
      'behavior_risks_flags',
      'allergies_flags',
    ];
    for (const field of fields) {
      if (field in (req.body || {})) {
        const value = req.body[field];
        if (field.endsWith('_flags')) {
          patch[field] = uniq(value);
        } else if (field === 'lat' || field === 'lng') {
          const parsed = Number(value);
          patch[field] = Number.isFinite(parsed) ? parsed : null;
        } else if (field === 'birth_year') {
          const parsed = Number(value);
          patch[field] = Number.isInteger(parsed) ? parsed : null;
        } else if (value === null || value === undefined || String(value).trim() === '') {
          patch[field] = null;
        } else {
          patch[field] = String(value).trim();
        }
      }
    }

    if ('patient_display_name' in patch && (!patch.patient_display_name || !String(patch.patient_display_name).trim())) {
      return res.status(400).json({ success: false, error: 'patient_display_name is required' });
    }

    const validationErrors = validatePatientProfilePayload({ ...existing, ...patch });
    if (validationErrors.length) {
      return res.status(400).json({ success: false, error: validationErrors.join(', ') });
    }

    const updated = await PatientProfile.updateById(id, { ...patch, updated_at: new Date() });
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('[Care Recipient] Update error:', error);
    res.status(500).json({ success: false, error: 'Failed to update care recipient' });
  }
};

const deactivateCareRecipient = async (req, res) => {
  const hirerId = req.userId;
  const { id } = req.params;
  const existing = await PatientProfile.findOne({ id, hirer_id: hirerId });
  if (!existing || existing.is_active === false) {
    return res.status(404).json({ success: false, error: 'Care recipient not found' });
  }
  const updated = await PatientProfile.updateById(id, { is_active: false, updated_at: new Date() });
  res.json({ success: true, data: updated });
};

export default {
  listCareRecipients,
  getCareRecipient,
  createCareRecipient,
  updateCareRecipient,
  deactivateCareRecipient,
};
