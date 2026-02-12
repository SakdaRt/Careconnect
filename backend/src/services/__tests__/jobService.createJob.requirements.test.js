import { jest } from '@jest/globals';

await jest.unstable_mockModule('../../utils/db.js', () => ({
  query: jest.fn(),
  transaction: jest.fn(),
}));

await jest.unstable_mockModule('../../models/User.js', () => ({
  default: {
    findById: jest.fn(),
  },
}));

await jest.unstable_mockModule('../../models/Job.js', () => ({
  default: {
    createJobPost: jest.fn(),
  },
}));

const jobService = await import('../jobService.js');
const { query } = await import('../../utils/db.js');
const { default: User } = await import('../../models/User.js');
const { default: Job } = await import('../../models/Job.js');

describe('jobService createJob requirements + risk reasons', () => {
  beforeEach(() => {
    query.mockReset();
    User.findById.mockReset();
    Job.createJobPost.mockReset();
  });

  const baseJob = () => ({
    title: 'test',
    description: 'desc',
    job_type: 'companionship',
    scheduled_start_at: '2099-01-01T10:00:00.000Z',
    scheduled_end_at: '2099-01-01T12:00:00.000Z',
    address_line1: 'addr',
    hourly_rate: 100,
    total_hours: 2,
    is_urgent: false,
    job_tasks_flags: ['companionship'],
  });

  test('throws when job_tasks_flags is empty', async () => {
    User.findById.mockResolvedValue({ id: 'hirer-1', role: 'hirer', status: 'active' });
    await expect(jobService.createJob('hirer-1', { ...baseJob(), job_tasks_flags: [] })).rejects.toThrow(
      'Please select at least one job task'
    );
  });

  test('throws when tube_feeding selected but patient has no feeding_tube', async () => {
    User.findById.mockResolvedValue({ id: 'hirer-1', role: 'hirer', status: 'active' });
    query.mockResolvedValueOnce({
      rows: [
        {
          id: 'patient-1',
          hirer_id: 'hirer-1',
          is_active: true,
          mobility_level: 'walk_independent',
          care_needs_flags: [],
          medical_devices_flags: [],
        },
      ],
    });

    await expect(
      jobService.createJob('hirer-1', { ...baseJob(), patient_profile_id: 'patient-1', job_tasks_flags: ['tube_feeding'] })
    ).rejects.toThrow('Selected tube feeding task but patient has no feeding tube');
  });

  test('creates job with risk_reason_codes when patient has feeding_tube', async () => {
    User.findById.mockResolvedValue({ id: 'hirer-1', role: 'hirer', status: 'active' });
    query.mockResolvedValueOnce({
      rows: [
        {
          id: 'patient-1',
          hirer_id: 'hirer-1',
          is_active: true,
          mobility_level: 'walk_independent',
          care_needs_flags: ['tube_feeding'],
          medical_devices_flags: ['feeding_tube'],
          symptoms_flags: [],
          behavior_risks_flags: [],
          cognitive_status: 'normal',
        },
      ],
    });

    Job.createJobPost.mockResolvedValue({ id: 'jobpost-1' });

    const res = await jobService.createJob('hirer-1', {
      ...baseJob(),
      patient_profile_id: 'patient-1',
      job_tasks_flags: ['tube_feeding'],
    });

    expect(res).toEqual({ id: 'jobpost-1' });

    const call = Job.createJobPost.mock.calls[0]?.[0];
    expect(call.risk_level).toBe('high_risk');
    expect(Array.isArray(call.risk_reason_codes)).toBeTruthy();
    expect(call.risk_reason_codes.join('|')).toContain('patient:device_feeding_tube');
    expect(call.risk_reason_detail).toBeTruthy();
    expect(call.job_tasks_flags).toEqual(['tube_feeding']);
  });

  test('sets high risk when medical task is selected even without patient criteria', async () => {
    User.findById.mockResolvedValue({ id: 'hirer-1', role: 'hirer', status: 'active' });
    query.mockResolvedValueOnce({
      rows: [
        {
          id: 'patient-1',
          hirer_id: 'hirer-1',
          is_active: true,
          mobility_level: 'walk_independent',
          care_needs_flags: [],
          medical_devices_flags: [],
          symptoms_flags: [],
          behavior_risks_flags: [],
          cognitive_status: 'normal',
        },
      ],
    });

    Job.createJobPost.mockResolvedValue({ id: 'jobpost-1' });

    await jobService.createJob('hirer-1', {
      ...baseJob(),
      patient_profile_id: 'patient-1',
      job_type: 'companionship',
      job_tasks_flags: ['medication_administration'],
    });

    const call = Job.createJobPost.mock.calls[0]?.[0];
    expect(call.risk_level).toBe('high_risk');
    expect(call.risk_reason_codes.join('|')).toContain('task:medication_administration');
  });
});

