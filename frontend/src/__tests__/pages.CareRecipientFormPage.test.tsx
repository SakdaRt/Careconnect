import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CareRecipientFormPage from '../pages/hirer/CareRecipientFormPage';

const mockNavigate = vi.fn();
const mockCreateCareRecipient = vi.fn();

vi.mock('../contexts', () => ({
  useAuth: () => ({
    user: { id: 'hirer-1', role: 'hirer', email: 'hirer@test.com', trust_level: 'L1', name: 'Hirer' },
    logout: vi.fn(),
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<any>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({}),
  };
});

vi.mock('../services/appApi', () => ({
  appApi: {
    createCareRecipient: (...args: any[]) => mockCreateCareRecipient(...args),
    updateCareRecipient: vi.fn(),
    getCareRecipient: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('../components/location/GooglePlacesInput', () => ({
  GooglePlacesInput: ({ onChange }: { onChange: (v: any) => void }) => (
    <button
      type="button"
      onClick={() =>
        onChange({
          address_line1: 'Mock Address',
          district: 'Mock District',
          province: 'Mock Province',
          postal_code: '10110',
          lat: 13.7,
          lng: 100.5,
        })
      }
    >
      mock-place
    </button>
  ),
}));

describe('CareRecipientFormPage', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockCreateCareRecipient.mockReset();
  });

  it('keeps nickname when address changes', () => {
    render(
      <MemoryRouter initialEntries={['/hirer/care-recipients/new']}>
        <Routes>
          <Route path="/hirer/care-recipients/new" element={<CareRecipientFormPage />} />
        </Routes>
      </MemoryRouter>
    );

    const nameInput = screen.getByLabelText('ชื่อที่ใช้แสดง');
    fireEvent.change(nameInput, { target: { value: 'คุณแม่' } });
    fireEvent.click(screen.getByRole('button', { name: 'mock-place' }));

    expect((nameInput as HTMLInputElement).value).toBe('คุณแม่');
  });

  it('sends nickname on save and navigates after success', async () => {
    mockCreateCareRecipient.mockResolvedValue({ success: true, data: { id: 'patient-1' } });

    render(
      <MemoryRouter initialEntries={['/hirer/care-recipients/new']}>
        <Routes>
          <Route path="/hirer/care-recipients/new" element={<CareRecipientFormPage />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText('ชื่อที่ใช้แสดง'), { target: { value: 'คุณพ่อ' } });
    fireEvent.change(screen.getByLabelText('ปีเกิด'), { target: { value: '1955' } });
    fireEvent.click(screen.getByRole('button', { name: 'mock-place' }));
    fireEvent.click(screen.getByRole('button', { name: 'บันทึก' }));

    await waitFor(() => {
      expect(mockCreateCareRecipient).toHaveBeenCalled();
    });

    const payload = mockCreateCareRecipient.mock.calls[0]?.[0];
    expect(payload.patient_display_name).toBe('คุณพ่อ');
    expect(payload.address_line1).toBe('Mock Address');
    expect(mockNavigate).toHaveBeenCalledWith('/hirer/care-recipients');
  });

  it('shows validation error when nickname is empty', async () => {
    render(
      <MemoryRouter initialEntries={['/hirer/care-recipients/new']}>
        <Routes>
          <Route path="/hirer/care-recipients/new" element={<CareRecipientFormPage />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText('ปีเกิด'), { target: { value: '1955' } });
    fireEvent.click(screen.getByRole('button', { name: 'บันทึก' }));

    await waitFor(() => {
      expect(screen.getByText('กรุณากรอกชื่อที่ใช้แสดง')).toBeTruthy();
    });
  });
});
