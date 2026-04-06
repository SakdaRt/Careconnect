export type OtpDebugPayload = { _dev_code?: string } | null | undefined;
export type OtpDebugChannel = 'email' | 'sms';
export type OtpLogLevel = 'info' | 'warn' | 'error';

const channelLabels: Record<OtpDebugChannel, string> = {
  email: 'OTP ทางอีเมล',
  sms: 'OTP ทาง SMS',
};

export const logOtpEvent = (
  channel: OtpDebugChannel,
  message: string,
  meta?: unknown,
  level: OtpLogLevel = 'info'
) => {
  const prefix = `[OTP:${channel}] ${message}`;
  if (level === 'error') {
    if (meta === undefined) {
      console.error(prefix);
      return;
    }
    console.error(prefix, meta);
    return;
  }
  if (level === 'warn') {
    if (meta === undefined) {
      console.warn(prefix);
      return;
    }
    console.warn(prefix, meta);
    return;
  }
  if (meta === undefined) {
    console.info(prefix);
    return;
  }
  console.info(prefix, meta);
};

export const showDevOtpToast = (payload: OtpDebugPayload, channel: OtpDebugChannel) => {
  const code = payload?._dev_code;
  if (!code) return false;
  console.info(`[OTP:${channel}] ${channelLabels[channel]} สำหรับทดสอบคือ ${code}`);
  return true;
};
