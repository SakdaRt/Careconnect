import BaseModel from './BaseModel.js';

class PatientProfile extends BaseModel {
  constructor() {
    super('patient_profiles');
  }
}

export default new PatientProfile();

