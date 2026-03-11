export const getIp = async (): Promise<string> => {
  try {
    const response = await fetch('https://cloudflare.com/cdn-cgi/trace');
    const text = await response.text();
    const match = text.match(/ip=([^\n]+)/);
    if (match) return match[1];
    
    // Fallback to ipify if cloudflare trace fails
    const ipifyResponse = await fetch('https://api.ipify.org?format=json');
    const ipifyData = await ipifyResponse.json();
    return ipifyData.ip;
  } catch (e) {
    console.warn('Failed to get IP, using Unknown');
    return 'Unknown';
  }
};
