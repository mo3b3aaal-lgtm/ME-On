/**
 * Lightweight Client-Side Image Compressor
 * Resizes images to max 256x256 and iteratively reduces quality/dimensions
 * to guarantee an ultra-lightweight WebP/JPEG Data URL (<= 30KB)
 * for snappy performance, Android compatibility, and instant Firestore sync.
 */
export async function compressProfilePhoto(
  fileOrUrl: File | Blob | string,
  maxWidth = 256,
  maxHeight = 256,
  initialQuality = 0.80
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        let currentWidth = img.width;
        let currentHeight = img.height;

        // Calculate aspect ratio
        if (currentWidth > maxWidth || currentHeight > maxHeight) {
          const ratio = Math.min(maxWidth / currentWidth, maxHeight / currentHeight);
          currentWidth = Math.max(32, Math.round(currentWidth * ratio));
          currentHeight = Math.max(32, Math.round(currentHeight * ratio));
        }

        const MAX_SIZE_BYTES = 30 * 1024; // 30KB limit

        const generateDataUrl = (w: number, h: number, q: number): string => {
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;

          const ctx = canvas.getContext('2d');
          if (!ctx) return '';

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, w, h);

          let url = canvas.toDataURL('image/webp', q);
          if (!url.startsWith('data:image/webp')) {
            url = canvas.toDataURL('image/jpeg', q);
          }
          return url;
        };

        const getByteSize = (dataUrl: string): number => {
          const base64Str = dataUrl.split(',')[1] || '';
          return Math.round((base64Str.length * 3) / 4);
        };

        // Iterative compression loop
        let quality = initialQuality;
        let w = currentWidth;
        let h = currentHeight;
        let finalDataUrl = generateDataUrl(w, h, quality);

        // Step 1: Reduce quality progressively if over 30KB
        const qualitySteps = [0.75, 0.65, 0.55, 0.45, 0.35, 0.25];
        for (const q of qualitySteps) {
          if (getByteSize(finalDataUrl) <= MAX_SIZE_BYTES) break;
          quality = q;
          finalDataUrl = generateDataUrl(w, h, quality);
        }

        // Step 2: If still over 30KB, progressively downscale dimensions
        const dimensionSteps = [0.85, 0.7, 0.55, 0.45];
        for (const scale of dimensionSteps) {
          if (getByteSize(finalDataUrl) <= MAX_SIZE_BYTES) break;
          w = Math.max(48, Math.round(currentWidth * scale));
          h = Math.max(48, Math.round(currentHeight * scale));
          finalDataUrl = generateDataUrl(w, h, 0.45);
        }

        resolve(finalDataUrl);
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = (err) => {
      reject(err);
    };

    if (typeof fileOrUrl === 'string') {
      img.src = fileOrUrl;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (typeof e.target?.result === 'string') {
          img.src = e.target.result;
        } else {
          reject(new Error('Failed to read image file'));
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(fileOrUrl);
    }
  });
}

export const compressImage = compressProfilePhoto;
