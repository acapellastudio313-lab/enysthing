import heic2any from 'heic2any';

export const formatDateWIB = (date: string | Date | number) => {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Jakarta'
    }).format(new Date(date)) + ' WIB';
  } catch (e) {
    return '';
  }
};

export const formatDateOnlyWIB = (date: string | Date | number) => {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Jakarta'
    }).format(new Date(date));
  } catch (e) {
    return '';
  }
};

export const formatTimeWIB = (date: string | Date | number) => {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Jakarta'
    }).format(new Date(date)) + ' WIB';
  } catch (e) {
    return '';
  }
};

export const compressImage = async (file: File, maxWidth = 800, quality = 0.6): Promise<string> => {
  let imageFile = file;
  
  // Handle HEIC files
  if (file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic')) {
    try {
      const convertedBlob = await heic2any({
        blob: file,
        toType: 'image/jpeg',
        quality: 0.8
      });
      
      const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
      imageFile = new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), { type: 'image/jpeg' });
    } catch (e) {
      console.error('HEIC conversion failed, trying to proceed with original file:', e);
      // If conversion fails, we can try to proceed with the original file, 
      // but it might not work if the browser doesn't support HEIC.
      // Let's not throw an error here to avoid breaking the upload.
      // However, if it's a HEIC file and conversion failed, it's safer to reject or warn.
      // But for now, we'll try to fall back.
      // Actually, let's try to rename it to .jpg just in case the backend handles it, 
      // but the browser canvas won't be able to read it if it's still HEIC bytes.
      // So if conversion fails, we should probably fail gracefully if we rely on canvas compression.
      
      // Attempt to continue but warn
    }
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(imageFile);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        
        // Initial compression
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        
        // Check size and compress further if needed (target < 700KB for Firestore safety)
        // Base64 string length * 0.75 is approx byte size
        let attempts = 0;
        while (dataUrl.length * 0.75 > 700 * 1024 && attempts < 3) {
            quality -= 0.1;
            dataUrl = canvas.toDataURL('image/jpeg', Math.max(0.1, quality));
            attempts++;
        }
        
        resolve(dataUrl);
      };
      img.onerror = (error) => {
          console.error("Image load error:", error);
          // If it was a HEIC file that failed conversion, this is where it will likely fail to load
          if (file.name.toLowerCase().endsWith('.heic')) {
              reject(new Error("Gagal memproses format HEIC. Silakan gunakan format JPG/PNG atau coba lagi."));
          } else {
              reject(new Error("Gagal memuat gambar. File mungkin rusak."));
          }
      };
    };
    reader.onerror = (error) => reject(error);
  });
};
