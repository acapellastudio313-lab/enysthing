// Simple in-memory cache for local media during upload
export const localMediaCache: Record<string, string> = {};

export const setLocalMedia = (id: string, url: string) => {
  localMediaCache[id] = url;
};

export const getLocalMedia = (id: string) => {
  return localMediaCache[id];
};

export const clearLocalMedia = (id: string) => {
  if (localMediaCache[id]) {
    // If it's an object URL, we should ideally revoke it, 
    // but we'll keep it simple for now.
    delete localMediaCache[id];
  }
};
