export const formatDateWIB = (date: string | Date) => {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta'
  }).format(new Date(date)) + ' WIB';
};

export const formatDateOnlyWIB = (date: string | Date) => {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Jakarta'
  }).format(new Date(date));
};

export const formatTimeWIB = (date: string | Date) => {
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta'
  }).format(new Date(date)) + ' WIB';
};

export const compressImage = (file: File, maxWidth = 800, quality = 0.6): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
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
        ctx?.drawImage(img, 0, 0, width, height);
        
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
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};
