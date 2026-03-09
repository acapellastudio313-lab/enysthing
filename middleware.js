export const config = {
  matcher: ['/((?!api|_vercel|assets|.*\\..*).*)', '/'],
};

export default async function middleware(request) {
  const url = new URL(request.url);
  const projectId = 'koys-92fd5';
  
  try {
    // Fetch settings from Firestore REST API
    const [titleRes, descRes, imageRes] = await Promise.all([
      fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/settings/seo_title`),
      fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/settings/seo_description`),
      fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/settings/seo_image`)
    ]);

    const titleData = await titleRes.json();
    const descData = await descRes.json();
    const imageData = await imageRes.json();

    let title = titleData.fields?.value?.stringValue || 'My Google AI Studio App';
    let description = descData.fields?.value?.stringValue || 'Aplikasi pemilihan yang adil dan transparan';
    let image = imageData.fields?.value?.stringValue || 'https://ui-avatars.com/api/?name=App&background=10b981&color=fff';

    // Dynamic SEO for candidate pages
    const candidateMatch = url.pathname.match(/^\/candidate\/([^/]+)$/);
    if (candidateMatch) {
      const candidateId = candidateMatch[1];
      try {
        const candidateRes = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/candidates/${candidateId}`);
        if (candidateRes.ok) {
          const candidateData = await candidateRes.json();
          if (candidateData.fields) {
            const name = candidateData.fields.name?.stringValue;
            const vision = candidateData.fields.vision?.stringValue;
            const photo = candidateData.fields.photo_url?.stringValue;
            
            if (name) title = `Dukung ${name} - ${title}`;
            if (vision) description = vision.substring(0, 150) + (vision.length > 150 ? '...' : '');
            if (photo) image = photo;
          }
        }
      } catch (e) {
        console.error('Error fetching candidate for SEO:', e);
      }
    }

    // Fetch the actual index.html
    const response = await fetch(`${url.origin}/index.html`);
    let html = await response.text();

    // Inject meta tags
    const metaTags = `
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${image}" />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${image}" />
    `;

    html = html.replace(/<title>.*?<\/title>/, metaTags);

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 's-maxage=60, stale-while-revalidate',
      },
    });
  } catch (error) {
    console.error('Error generating dynamic HTML:', error);
    return;
  }
}
