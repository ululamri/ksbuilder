export const IMAGE_OPTIMIZER_MAX_SIDE = 1920;
export const IMAGE_OPTIMIZER_MIN_SAVE_RATIO = 0.92;
export const IMAGE_VARIANT_WIDTHS = [640, 1024, 1600] as const;

export type OptimizedImageResult = {
  file: File;
  optimized: boolean;
  originalSize: number;
  optimizedSize: number;
};

export type ImageUploadVariant = {
  file: File;
  width: number;
  role: string;
};

export type PreparedImageUpload = OptimizedImageResult & {
  variants: ImageUploadVariant[];
};

export function shouldOptimizeImage(file: File) {
  return file.type.startsWith('image/') && file.type !== 'image/gif';
}

export async function optimizeImageForUpload(file: File): Promise<OptimizedImageResult> {
  const result = await prepareImageUploadPlan(file);
  return {
    file: result.file,
    optimized: result.optimized,
    originalSize: result.originalSize,
    optimizedSize: result.optimizedSize
  };
}

export async function prepareImageUploadPlan(file: File): Promise<PreparedImageUpload> {
  if (!shouldOptimizeImage(file) || typeof document === 'undefined' || typeof createImageBitmap !== 'function') {
    return { file, optimized: false, originalSize: file.size, optimizedSize: file.size, variants: [] };
  }

  try {
    const bitmap = await createImageBitmap(file);
    const largestSide = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, IMAGE_OPTIMIZER_MAX_SIDE / largestSide);

    if (scale >= 1 && file.size < 900_000) {
      bitmap.close?.();
      return { file, optimized: false, originalSize: file.size, optimizedSize: file.size, variants: [] };
    }

    const blob = await renderBitmap(bitmap, Math.max(1, Math.round(bitmap.width * scale)), Math.max(1, Math.round(bitmap.height * scale)), 0.84);
    if (!blob || blob.size >= file.size * IMAGE_OPTIMIZER_MIN_SAVE_RATIO) {
      const variants = await createResponsiveVariants(bitmap, file);
      bitmap.close?.();
      return { file, optimized: false, originalSize: file.size, optimizedSize: file.size, variants };
    }

    const name = file.name.replace(/\.[^.]+$/, '') || 'image';
    const optimizedFile = new File([blob], `${name}.webp`, { type: 'image/webp', lastModified: file.lastModified });
    const variants = await createResponsiveVariants(bitmap, optimizedFile);
    bitmap.close?.();
    return {
      file: optimizedFile,
      optimized: true,
      originalSize: file.size,
      optimizedSize: blob.size,
      variants
    };
  } catch {
    return { file, optimized: false, originalSize: file.size, optimizedSize: file.size, variants: [] };
  }
}

async function createResponsiveVariants(bitmap: ImageBitmap, file: File): Promise<ImageUploadVariant[]> {
  const largestSide = Math.max(bitmap.width, bitmap.height);
  const variants: ImageUploadVariant[] = [];
  for (const width of IMAGE_VARIANT_WIDTHS) {
    if (width >= largestSide || width < 480) continue;
    const targetWidth = width;
    const targetHeight = Math.max(1, Math.round(bitmap.height * (targetWidth / bitmap.width)));
    const blob = await renderBitmap(bitmap, targetWidth, targetHeight, width <= 640 ? 0.8 : 0.82);
    if (!blob) continue;
    const name = file.name.replace(/\.[^.]+$/, '') || 'image';
    variants.push({
      width,
      role: `w${width}`,
      file: new File([blob], `${name}-${width}.webp`, { type: 'image/webp', lastModified: file.lastModified })
    });
  }
  return variants;
}

async function renderBitmap(bitmap: ImageBitmap, width: number, height: number, quality: number): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: true });
  if (!context) return null;
  context.drawImage(bitmap, 0, 0, width, height);
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
}
