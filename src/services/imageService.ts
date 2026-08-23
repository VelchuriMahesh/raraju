/**
 * Image Upload Service with client-side compression and ImgBB integration
 */

export interface UploadImageResult {
  url: string;
  thumbnailUrl?: string;
  deleteUrl?: string;
}

/**
 * Resizes and compresses an image file before upload using HTML5 Canvas
 */
export const compressImage = (
  file: File,
  maxWidth = 1000,
  maxHeight = 1000,
  quality = 0.85
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    // If it's already small enough or SVG, return as is
    if (file.type === 'image/svg+xml' || file.size < 100 * 1024) {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

/**
 * Uploads an image to ImgBB or returns a local base64/object URL if no key configured
 */
export const uploadProductImage = async (
  file: File,
  onProgress?: (progress: number) => void
): Promise<UploadImageResult> => {
  // Validate file type
  if (!file.type.startsWith('image/')) {
    throw new Error('Selected file is not an image. Please choose a JPG, PNG, or WebP file.');
  }

  // Validate size (max 10MB original)
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('Image file is too large (Maximum 10MB allowed).');
  }

  onProgress?.(20);

  // Compress image
  const compressedBlob = await compressImage(file, 1000, 1000, 0.85);
  onProgress?.(50);

  const apiKey = import.meta.env.VITE_IMGBB_API_KEY;

  if (!apiKey || apiKey.trim() === '' || apiKey === 'your_new_key') {
    // If no ImgBB key is provided, convert compressed image to a persistent Data URL for instant testing
    console.warn('No ImgBB API key provided in VITE_IMGBB_API_KEY. Using base64 Data URL fallback.');
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        onProgress?.(100);
        resolve({
          url: reader.result as string,
          thumbnailUrl: reader.result as string
        });
      };
      reader.readAsDataURL(compressedBlob);
    });
  }

  // Upload to ImgBB API
  const formData = new FormData();
  formData.append('image', compressedBlob, file.name.replace(/\.[^/.]+$/, "") + '.jpg');

  onProgress?.(70);

  const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
    method: 'POST',
    body: formData
  });

  onProgress?.(90);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData?.error?.message || `Image upload failed with status ${response.status}`
    );
  }

  const json = await response.json();

  if (!json.success || !json.data?.url) {
    throw new Error('Invalid response from ImgBB image hosting service.');
  }

  onProgress?.(100);

  return {
    url: json.data.url,
    thumbnailUrl: json.data.thumb?.url || json.data.display_url || json.data.url,
    deleteUrl: json.data.delete_url
  };
};
