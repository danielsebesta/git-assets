export const FORMATS = [
  { id: 'original', label: 'Original', lossy: false },
  { id: 'webp', label: 'WebP', mime: 'image/webp', lossy: true },
  { id: 'jpeg', label: 'JPEG', mime: 'image/jpeg', lossy: true },
  { id: 'png', label: 'PNG', mime: 'image/png', lossy: false },
  { id: 'avif', label: 'AVIF', mime: 'image/avif', lossy: true },
];

// Check browser support for each format
let supportCache = null;
export async function getSupportedFormats() {
  if (supportCache) return supportCache;
  const canvas = new OffscreenCanvas(1, 1);
  const ctx = canvas.getContext('2d');
  ctx.fillRect(0, 0, 1, 1);

  const supported = [FORMATS[0]]; // 'original' always supported
  for (const fmt of FORMATS.slice(1)) {
    try {
      const blob = await canvas.convertToBlob({ type: fmt.mime, quality: 0.5 });
      // Some browsers return a PNG fallback silently
      if (blob.type === fmt.mime) supported.push(fmt);
    } catch {
      // Not supported
    }
  }
  supportCache = supported;
  return supported;
}

export async function compressImage(file, { quality = 0.85, format = 'webp' } = {}) {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
    return { file, converted: false };
  }

  if (format === 'original') {
    return { file, converted: false };
  }

  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const fmt = FORMATS.find((f) => f.id === format);
  const mimeType = fmt?.mime || 'image/webp';
  const opts = fmt?.lossy ? { type: mimeType, quality } : { type: mimeType };
  const blob = await canvas.convertToBlob(opts);

  // Only use compressed version if it's actually smaller
  if (blob.size >= file.size) {
    return { file, converted: false, originalSize: file.size, compressedSize: file.size, savings: 0 };
  }

  const ext = format === 'jpeg' ? 'jpg' : format;
  const baseName = file.name.replace(/\.[^.]+$/, '');
  const newName = `${baseName}.${ext}`;
  const newFile = new File([blob], newName, { type: mimeType });

  return {
    file: newFile,
    converted: true,
    originalSize: file.size,
    compressedSize: newFile.size,
    savings: Math.round((1 - newFile.size / file.size) * 100),
  };
}

// Generate a preview blob for comparison (returns object URL)
export async function compressPreview(file, { quality = 0.85, format = 'webp' } = {}) {
  const result = await compressImage(file, { quality, format });
  return {
    url: URL.createObjectURL(result.file),
    size: result.file.size,
    originalSize: file.size,
    converted: result.converted,
    savings: result.savings || 0,
    file: result.file,
  };
}
