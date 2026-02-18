import { can } from '../../middleware/auth.js';

describe('policy gate can()', () => {
  test('allows caregiver L1 to access job feed', () => {
    const result = can({ role: 'caregiver', trust_level: 'L1' }, 'job:feed');
    expect(result.allowed).toBe(true);
  });

  test('denies caregiver L0 to access job feed', () => {
    const result = can({ role: 'caregiver', trust_level: 'L0' }, 'job:feed');
    expect(result.allowed).toBe(false);
  });

  test('allows caregiver L2 to withdraw', () => {
    const result = can({ role: 'caregiver', trust_level: 'L2' }, 'wallet:withdraw');
    expect(result.allowed).toBe(true);
  });

  test('allows hirer L0 to manage bank accounts', () => {
    const result = can({ role: 'hirer', trust_level: 'L0' }, 'wallet:bank-add');
    expect(result.allowed).toBe(true);
  });

  test('denies caregiver L0 to manage bank accounts', () => {
    const result = can({ role: 'caregiver', trust_level: 'L0' }, 'wallet:bank-add');
    expect(result.allowed).toBe(false);
  });

  test('allows admin for any action', () => {
    const result = can({ role: 'admin', trust_level: 'L0' }, 'job:feed');
    expect(result.allowed).toBe(true);
  });
});
