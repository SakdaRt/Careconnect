import { jest } from '@jest/globals';

await jest.unstable_mockModule('../../models/PatientProfile.js', () => ({
  default: {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    updateById: jest.fn(),
  },
}));

const careRecipientController = await import('../careRecipientController.js');
const { default: PatientProfile } = await import('../../models/PatientProfile.js');

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('careRecipientController', () => {
  beforeEach(() => {
    PatientProfile.findAll.mockReset();
    PatientProfile.findOne.mockReset();
  });

  test('listCareRecipients normalizes lat/lng to numbers', async () => {
    PatientProfile.findAll.mockResolvedValue([
      {
        id: 'patient-1',
        hirer_id: 'hirer-1',
        is_active: true,
        address_line1: 'Saved Address',
        lat: '13.7000000',
        lng: '100.5000000',
      },
    ]);

    const req = { userId: 'hirer-1' };
    const res = createRes();

    await careRecipientController.default.listCareRecipients(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.data[0].lat).toBe(13.7);
    expect(payload.data[0].lng).toBe(100.5);
  });

  test('getCareRecipient returns lat/lng as numbers when stored as strings', async () => {
    PatientProfile.findOne.mockResolvedValue({
      id: 'patient-1',
      hirer_id: 'hirer-1',
      is_active: true,
      address_line1: 'Saved Address',
      lat: '13.7000000',
      lng: '100.5000000',
    });

    const req = { userId: 'hirer-1', params: { id: 'patient-1' } };
    const res = createRes();

    await careRecipientController.default.getCareRecipient(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.data.lat).toBe(13.7);
    expect(payload.data.lng).toBe(100.5);
  });
});
