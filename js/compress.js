export const FORMATS = [
  { id: 'original', label: 'Original', lossy: false },
  { id: 'webp', label: 'WebP', mime: 'image/webp', lossy: true },
  { id: 'jpeg', label: 'JPEG', mime: 'image/jpeg', lossy: true },
  { id: 'png', label: 'PNG', mime: 'image/png', lossy: false },
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

export async function compressImage(file, { quality = 0.85, format = 'webp', maxWidth = 0, maxHeight = 0, scale = 100 } = {}) {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
    return { file, converted: false };
  }

  if (format === 'original' && scale === 100 && !maxWidth && !maxHeight) {
    return { file, converted: false };
  }

  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;

  // Apply scale
  if (scale > 0 && scale < 100) {
    const s = scale / 100;
    width = Math.round(width * s);
    height = Math.round(height * s);
  }

  // Apply max dimensions (maintain aspect ratio)
  if (maxWidth > 0 && width > maxWidth) {
    height = Math.round(height * (maxWidth / width));
    width = maxWidth;
  }
  if (maxHeight > 0 && height > maxHeight) {
    width = Math.round(width * (maxHeight / height));
    height = maxHeight;
  }

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const fmt = FORMATS.find((f) => f.id === format);
  const mimeType = format === 'original' ? (file.type || 'image/png') : (fmt?.mime || 'image/webp');
  const opts = fmt?.lossy ? { type: mimeType, quality } : { type: mimeType };
  const blob = await canvas.convertToBlob(opts);

  // Only use compressed version if it's actually smaller (skip check if resized)
  const resized = scale < 100 || maxWidth > 0 || maxHeight > 0;
  if (!resized && blob.size >= file.size) {
    return { file, converted: false, originalSize: file.size, compressedSize: file.size, savings: 0, width, height };
  }

  let ext, newName;
  if (format === 'original') {
    newName = file.name;
  } else {
    ext = format === 'jpeg' ? 'jpg' : format;
    const baseName = file.name.replace(/\.[^.]+$/, '');
    newName = `${baseName}.${ext}`;
  }
  const newFile = new File([blob], newName, { type: mimeType });

  return {
    file: newFile,
    converted: true,
    originalSize: file.size,
    compressedSize: newFile.size,
    savings: Math.round((1 - newFile.size / file.size) * 100),
    width,
    height,
  };
}

// Generate a preview blob for comparison (returns object URL)
export async function compressPreview(file, opts = {}) {
  const result = await compressImage(file, { quality: 0.85, format: 'webp', ...opts });
  return {
    url: URL.createObjectURL(result.file),
    size: result.file.size,
    originalSize: file.size,
    converted: result.converted,
    savings: result.savings || 0,
    width: result.width,
    height: result.height,
    file: result.file,
  };
}
