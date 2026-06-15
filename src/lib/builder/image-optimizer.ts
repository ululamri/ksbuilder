export const IMAGE_OPTIMIZER_MAX_SIDE = 1920;
export const IMAGE_OPTIMIZER_MIN_SAVE_RATIO = 0.92;

export type OptimizedImageResult = {
  file: File;
  optimized: boolean;
  originalSize: number;
  optimizedSize: number;
};

export function shouldOptimizeImage(file: File) {
  return file.type.startsWith('image/') && file.type !== 'image/gif';
}

export async function optimizeImageForUpload(file: File): Promise<OptimizedImageResult> {
  if (!shouldOptimizeImage(file) || typeof document === 'undefined' || typeof createImageBitmap !== 'function') {
    return { file, optimized: false, originalSize: file.size, optimizedSize: file.size };
  }

  try {
    const bitmap = await createImageBitmap(file);
    const largestSide = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, IMAGE_OPTIMIZER_MAX_SIDE / largestSide);

    if (scale >= 1 && file.size < 900_000) {
      bitmap.close?.();
      return { file, optimized: false, originalSize: file.size, optimizedSize: file.size };
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));

    const context = canvas.getContext('2d', { alpha: true });
    if (!context) {
      bitmap.close?.();
      return { file, optimized: false, originalSize: file.size, optimizedSize: file.size };
    }

    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.84));
    if (!blob || blob.size >= file.size * IMAGE_OPTIMIZER_MIN_SAVE_RATIO) {
      return { file, optimized: false, originalSize: file.size, optimizedSize: file.size };
    }

    const name = file.name.replace(/\.[^.]+$/, '') || 'image';
    const optimizedFile = new File([blob], `${name}.webp`, { type: 'image/webp', lastModified: file.lastModified });
    return {
      file: optimizedFile,
      optimized: true,
      originalSize: file.size,
      optimizedSize: blob.size
    };
  } catch {
    return { file, optimized: false, originalSize: file.size, optimizedSize: file.size };
  }
}

