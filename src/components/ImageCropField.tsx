import { useId, useState, type ReactNode } from 'react';
import { ImageCropModal } from './ImageCropModal';

type ImageCropFieldProps = {
  onCropped: (file: File) => void | Promise<void>;
  children: ReactNode;
  title?: string;
  accept?: string;
  className?: string;
  disabled?: boolean;
  onPickError?: (message: string) => void;
};

export function ImageCropField({
  onCropped,
  children,
  title,
  accept = 'image/png,image/jpeg,image/webp,image/gif',
  className = '',
  disabled = false,
  onPickError,
}: ImageCropFieldProps) {
  const inputId = useId();
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      onPickError?.('Выберите изображение (PNG, JPG, WebP).');
      return;
    }

    setCropFile(file);
    setModalOpen(true);
  };

  return (
    <>
      <label htmlFor={inputId} className={className}>
        {children}
        <input
          id={inputId}
          type="file"
          accept={accept}
          className="hidden"
          disabled={disabled}
          onChange={handleChange}
        />
      </label>

      <ImageCropModal
        open={modalOpen}
        file={cropFile}
        title={title}
        onClose={() => {
          setModalOpen(false);
          setCropFile(null);
        }}
        onConfirm={onCropped}
      />
    </>
  );
}
