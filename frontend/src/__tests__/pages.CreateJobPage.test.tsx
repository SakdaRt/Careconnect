import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CreateJobPage from '../pages/hirer/CreateJobPage';

const mockNavigate = vi.fn();
const mockGetCareRecipients = vi.fn();

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
  };
});

vi.mock('../services/appApi', () => ({
  appApi: {
    getCareRecipients: (...args: any[]) => mockGetCareRecipients(...args),
    createJob: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('../components/location/GooglePlacesInput', () => ({
  GooglePlacesInput: ({ label, value, onChange, disabled }: any) => (
    <div>
      {label ? <label>{label}</label> : null}
      <input aria-label={label} value={value} disabled={disabled} onChange={() => undefined} />
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
        mock-pin
      </button>
    </div>
  ),
}));

describe('CreateJobPage', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockGetCareRecipients.mockReset();
  });

  it('keeps form values when pinning location', async () => {
    mockGetCareRecipients.mockResolvedValue({
      success: true,
      data: [
        {
          id: 'patient-1',
          is_active: true,
          patient_display_name: 'คุณแม่',
          address_line1: 'Saved Address',
          district: 'Saved District',
          province: 'Saved Province',
          postal_code: '10110',
          lat: 13.7,
          lng: 100.5,
        },
      ],
    });

    render(
      <MemoryRouter initialEntries={['/hirer/create-job']}>
        <Routes>
          <Route path="/hirer/create-job" element={<CreateJobPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockGetCareRecipients).toHaveBeenCalled();
    });

    const titleInput = screen.getByPlaceholderText('เช่น ดูแลผู้สูงอายุช่วงเช้า');
    fireEvent.change(titleInput, { target: { value: 'ดูแลผู้สูงอายุ' } });
    fireEvent.click(screen.getByRole('button', { name: 'mock-pin' }));

    expect((titleInput as HTMLInputElement).value).toBe('ดูแลผู้สูงอายุ');
  });

  it('uses saved address when checkbox is checked', async () => {
    mockGetCareRecipients.mockResolvedValue({
      success: true,
      data: [
        {
          id: 'patient-1',
          is_active: true,
          patient_display_name: 'คุณแม่',
          address_line1: 'Saved Address',
          district: 'Saved District',
          province: 'Saved Province',
          postal_code: '10110',
          lat: 13.7,
          lng: 100.5,
        },
      ],
    });

    render(
      <MemoryRouter initialEntries={['/hirer/create-job']}>
        <Routes>
          <Route path="/hirer/create-job" element={<CreateJobPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockGetCareRecipients).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByLabelText('ใช้ที่อยู่เดิมของผู้รับการดูแล'));

    await waitFor(() => {
      expect((screen.getByLabelText('ที่อยู่') as HTMLInputElement).value).toBe('Saved Address');
    });

    expect((screen.getByLabelText('ที่อยู่') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByPlaceholderText('เช่น วัฒนา') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByPlaceholderText('เช่น Bangkok') as HTMLInputElement).disabled).toBe(true);
  });

  it('shows validation when saved address is missing', async () => {
    mockGetCareRecipients.mockResolvedValue({
      success: true,
      data: [
        {
          id: 'patient-1',
          is_active: true,
          patient_display_name: 'คุณแม่',
          address_line1: '',
          district: '',
          province: '',
          postal_code: '',
        },
      ],
    });

    render(
      <MemoryRouter initialEntries={['/hirer/create-job']}>
        <Routes>
          <Route path="/hirer/create-job" element={<CreateJobPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockGetCareRecipients).toHaveBeenCalled();
    });

    const checkbox = screen.getByLabelText('ใช้ที่อยู่เดิมของผู้รับการดูแล') as HTMLInputElement;
    fireEvent.click(checkbox);

    expect(checkbox.checked).toBe(false);
    expect(screen.getByText('ไม่พบข้อมูลที่อยู่ของผู้รับการดูแล')).toBeTruthy();
  });

  it('allows pinning when saved address has no coords', async () => {
    mockGetCareRecipients.mockResolvedValue({
      success: true,
      data: [
        {
          id: 'patient-1',
          is_active: true,
          patient_display_name: 'คุณแม่',
          address_line1: 'Saved Address',
          district: 'Saved District',
          province: 'Saved Province',
          postal_code: '10110',
          lat: null,
          lng: null,
        },
      ],
    });

    render(
      <MemoryRouter initialEntries={['/hirer/create-job']}>
        <Routes>
          <Route path="/hirer/create-job" element={<CreateJobPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockGetCareRecipients).toHaveBeenCalled();
    });

    const checkbox = screen.getByLabelText('ใช้ที่อยู่เดิมของผู้รับการดูแล') as HTMLInputElement;
    fireEvent.click(checkbox);

    expect(checkbox.checked).toBe(true);
    expect(screen.getByText('ที่อยู่เดิมยังไม่มีพิกัด กรุณาปักหมุดเพื่อบันทึกพิกัด')).toBeTruthy();
    expect((screen.getByLabelText('ที่อยู่') as HTMLInputElement).disabled).toBe(true);
  });
});
