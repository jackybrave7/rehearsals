import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from './Button';
import { Modal } from './Modal';
import {
  clampImageCropOffset,
  cropImageToBlob,
  croppedBlobToFile,
  getImageDrawMetrics,
  IMAGE_CROP_VIEWPORT_SIZE,
} from '../utils/imageCrop';

type ImageCropModalProps = {
  open: boolean;
  file: File | null;
  title?: string;
  onClose: () => void;
  onConfirm: (file: File) => void | Promise<void>;
};

export function ImageCropModal({
  open,
  file,
  title = 'Настройка миниатюры',
  onClose,
  onConfirm,
}: ImageCropModalProps) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(
    null
  );

  useEffect(() => {
    if (!open || !file) {
      setImage(null);
      setImageUrl(null);
      setScale(1);
      setOffset({ x: 0, y: 0 });
      setError(null);
      return;
    }

    const url = URL.createObjectURL(file);
    setImageUrl(url);
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setImage(img);
    };
    img.onerror = () => {
      if (!cancelled) setError('Не удалось открыть изображение.');
    };
    img.src = url;

    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
    };
  }, [open, file]);

  const metrics = useMemo(() => {
    if (!image) return null;
    return getImageDrawMetrics(image, scale, offset.x, offset.y);
  }, [image, offset.x, offset.y, scale]);

  useEffect(() => {
    if (!image || !open) {
      setPreviewUrl(null);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void cropImageToBlob(image, {
        scale,
        offsetX: offset.x,
        offsetY: offset.y,
        outputSize: 128,
        quality: 0.85,
      })
        .then((blob) => {
          if (cancelled) return;
          const url = URL.createObjectURL(blob);
          setPreviewUrl((current) => {
            if (current) URL.revokeObjectURL(current);
            return url;
          });
        })
        .catch(() => {
          if (!cancelled) setPreviewUrl(null);
        });
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [image, offset.x, offset.y, open, scale]);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl]
  );

  const updateOffset = (nextX: number, nextY: number) => {
    if (!metrics) return;
    setOffset({
      x: clampImageCropOffset(nextX, metrics.drawW),
      y: clampImageCropOffset(nextY, metrics.drawH),
    });
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!image) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: offset.x,
      originY: offset.y,
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const dx = event.clientX - dragRef.current.startX;
    const dy = event.clientY - dragRef.current.startY;
    updateOffset(dragRef.current.originX + dx, dragRef.current.originY + dy);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handleConfirm = async () => {
    if (!image || !file) return;
    setSaving(true);
    setError(null);
    try {
      const blob = await cropImageToBlob(image, { scale, offsetX: offset.x, offsetY: offset.y });
      const cropped = croppedBlobToFile(blob, file.name);
      await onConfirm(cropped);
      onClose();
    } catch {
      setError('Не удалось сохранить миниатюру.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Отмена
          </Button>
          <Button onClick={() => void handleConfirm()} disabled={!image || saving}>
            {saving ? 'Сохранение…' : 'Сохранить'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Перетащите изображение и отрегулируйте масштаб, чтобы лицо или символ оказались по центру
          круга.
        </p>

        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:justify-center">
          <div
            className="relative touch-none overflow-hidden rounded-2xl bg-black/50"
            style={{ width: IMAGE_CROP_VIEWPORT_SIZE, height: IMAGE_CROP_VIEWPORT_SIZE }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            {metrics && imageUrl && (
              <img
                src={imageUrl}
                alt=""
                draggable={false}
                className="absolute max-w-none select-none"
                style={{
                  width: metrics.drawW,
                  height: metrics.drawH,
                  left: metrics.x,
                  top: metrics.y,
                }}
              />
            )}
            <div className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] ring-2 ring-gold/70" />
          </div>

          <div className="flex flex-col items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-muted">Превью</span>
            <div className="h-20 w-20 overflow-hidden rounded-full bg-black/30 ring-2 ring-gold/30">
              {previewUrl ? (
                <img src={previewUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-muted">
                  …
                </div>
              )}
            </div>
          </div>
        </div>

        <label className="block space-y-2">
          <span className="text-sm text-muted">Масштаб</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={scale}
            onChange={(event) => {
              const nextScale = Number(event.target.value);
              if (!image) {
                setScale(nextScale);
                return;
              }
              const nextMetrics = getImageDrawMetrics(image, nextScale, offset.x, offset.y);
              setScale(nextScale);
              setOffset({
                x: clampImageCropOffset(offset.x, nextMetrics.drawW),
                y: clampImageCropOffset(offset.y, nextMetrics.drawH),
              });
            }}
            className="w-full accent-gold"
          />
        </label>

        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    </Modal>
  );
}
