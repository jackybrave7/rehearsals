export const IMAGE_CROP_VIEWPORT_SIZE = 280;
export const IMAGE_CROP_OUTPUT_SIZE = 512;

export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('IMAGE_LOAD_FAILED'));
    };
    image.src = url;
  });
}

export function getImageDrawMetrics(
  image: HTMLImageElement,
  scale: number,
  offsetX: number,
  offsetY: number,
  viewportSize = IMAGE_CROP_VIEWPORT_SIZE
) {
  const iw = image.naturalWidth;
  const ih = image.naturalHeight;
  const baseScale = Math.max(viewportSize / iw, viewportSize / ih);
  const drawScale = baseScale * scale;
  const drawW = iw * drawScale;
  const drawH = ih * drawScale;
  const x = (viewportSize - drawW) / 2 + offsetX;
  const y = (viewportSize - drawH) / 2 + offsetY;

  return { iw, ih, drawScale, drawW, drawH, x, y, viewportSize };
}

export function clampImageCropOffset(
  offset: number,
  drawSize: number,
  viewportSize = IMAGE_CROP_VIEWPORT_SIZE
): number {
  const slack = Math.abs(drawSize - viewportSize) / 2;
  return Math.min(slack, Math.max(-slack, offset));
}

export async function cropImageToBlob(
  image: HTMLImageElement,
  options: {
    scale: number;
    offsetX: number;
    offsetY: number;
    viewportSize?: number;
    outputSize?: number;
    mimeType?: string;
    quality?: number;
  }
): Promise<Blob> {
  const viewportSize = options.viewportSize ?? IMAGE_CROP_VIEWPORT_SIZE;
  const outputSize = options.outputSize ?? IMAGE_CROP_OUTPUT_SIZE;
  const { drawScale, x, y } = getImageDrawMetrics(
    image,
    options.scale,
    options.offsetX,
    options.offsetY,
    viewportSize
  );

  const sx = (0 - x) / drawScale;
  const sy = (0 - y) / drawScale;
  const sSize = viewportSize / drawScale;

  const canvas = document.createElement('canvas');
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('CROP_CANVAS_FAILED');

  ctx.drawImage(image, sx, sy, sSize, sSize, 0, 0, outputSize, outputSize);

  const mimeType = options.mimeType ?? 'image/jpeg';
  const quality = options.quality ?? 0.92;

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('CROP_BLOB_FAILED'))),
      mimeType,
      quality
    );
  });
}

export function croppedBlobToFile(blob: Blob, originalName: string): File {
  const baseName = originalName.replace(/\.[^.]+$/, '') || 'image';
  return new File([blob], `${baseName}-thumb.jpg`, { type: blob.type || 'image/jpeg' });
}
