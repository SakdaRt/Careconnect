import { ChangeEvent, useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import toast from 'react-hot-toast';
import { Avatar, type AvatarSize } from './Avatar';
import { CropModal } from './CropModal';
import { cn } from '../../utils/cn';

interface AvatarUploadProps {
  userId?: string | null;
  avatarVersion?: number | null;
  name?: string;
  size?: AvatarSize;
  onUpload: (blob: Blob) => Promise<void>;
  loading?: boolean;
  className?: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const SUPPORTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function AvatarUpload({
  userId,
  avatarVersion,
  name,
  size = '3xl',
  onUpload,
  loading = false,
  className,
}: AvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const isLoading = loading || uploading;

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!SUPPORTED_TYPES.includes(file.type)) {
      toast.error('อนุญาตเฉพาะไฟล์ JPEG, PNG หรือ WebP');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error('รูปโปรไฟล์ต้องมีขนาดไม่เกิน 10 MB');
      return;
    }

    const url = URL.createObjectURL(file);
    setCropSrc(url);
  };

  const handleCropConfirm = async (blob: Blob) => {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    setUploading(true);
    try {
      await onUpload(blob);
    } finally {
      setUploading(false);
    }
  };

  const handleCropCancel = () => {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={isLoading}
        className={cn(
          'relative group focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-full',
          isLoading && 'opacity-60 cursor-not-allowed',
          className,
        )}
        aria-label="เปลี่ยนรูปโปรไฟล์"
      >
        <Avatar
          userId={userId}
          avatarVersion={avatarVersion}
          name={name}
          size={size}
        />
        <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
          <Camera
            className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity"
            aria-hidden="true"
          />
        </div>
        {isLoading && (
          <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />
      <p className="text-xs text-gray-400 mt-1 text-center">JPEG, PNG, WebP ไม่เกิน 10 MB</p>

      {cropSrc && (
        <CropModal
          imageSrc={cropSrc}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}
    </>
  );
}
