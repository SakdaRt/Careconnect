import toast from 'react-hot-toast';

export type OtpDebugPayload = { _dev_code?: string } | null | undefined;
export type OtpDebugChannel = 'email' | 'sms';

const channelLabels: Record<OtpDebugChannel, string> = {
  email: 'OTP ทางอีเมล',
  sms: 'OTP ทาง SMS',
};

export const showDevOtpToast = (payload: OtpDebugPayload, channel: OtpDebugChannel) => {
  const code = payload?._dev_code;
  if (!import.meta.env.DEV || !code) return false;
  toast(`โหมดพัฒนา: ${channelLabels[channel]} สำหรับทดสอบคือ ${code}`, {
    icon: '🔑',
    duration: 15000,
  });
  return true;
};
