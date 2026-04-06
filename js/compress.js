const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1920;
const QUALITY = 0.85;

export async function compressImage(file, { maxWidth = MAX_WIDTH, maxHeight = MAX_HEIGHT, quality = QUALITY, format = 'webp' } = {}) {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
    return { file, converted: false };
  }

  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;

  // Scale down if needed
  if (width > maxWidth || height > maxHeight) {
    const ratio = Math.min(maxWidth / width, maxHeight / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const mimeType = `image/${format}`;
  const blob = await canvas.convertToBlob({ type: mimeType, quality });

  // Only use compressed version if it's actually smaller
  if (blob.size >= file.size) {
    return { file, converted: false };
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
