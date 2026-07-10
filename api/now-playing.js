const escapeXml = (value = '') =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const truncate = (value = '', max = 42) =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value;

export default async function handler(req, res) {
  const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REFRESH_TOKEN } = process.env;

  const basic = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');

  const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: SPOTIFY_REFRESH_TOKEN,
    }),
  });

  const tokenData = await tokenResponse.json();

  if (!tokenResponse.ok || !tokenData.access_token) {
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.status(200).send(`
      <svg width="520" height="120" xmlns="http://www.w3.org/2000/svg">
        <rect width="520" height="120" fill="#0d1117" rx="12"/>
        <text x="260" y="60" fill="#f85149" font-family="Inter, Arial" font-size="15" text-anchor="middle">Spotify token error</text>
      </svg>
    `);
  }

  const recentResponse = await fetch('https://api.spotify.com/v1/me/player/recently-played?limit=6', {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
    },
  });

  if (!recentResponse.ok) {
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.status(200).send(`
      <svg width="520" height="120" xmlns="http://www.w3.org/2000/svg">
        <rect width="520" height="120" fill="#0d1117" rx="12"/>
        <text x="260" y="60" fill="#8b949e" font-family="Inter, Arial" font-size="15" text-anchor="middle">No Spotify history yet</text>
      </svg>
    `);
  }

  const recentData = await recentResponse.json();
  const tracks = (recentData.items || []).slice(0, 6);

  const rows = tracks
    .map(({ track }, index) => {
      const y = 64 + index * 26;
      const title = escapeXml(truncate(track?.name || 'Unknown song', 34));
      const artist = escapeXml(truncate((track?.artists || []).map((artist) => artist.name).join(', ') || 'Unknown artist', 28));

      return `
        <text x="28" y="${y}" fill="#8b949e" font-family="Inter, Arial" font-size="13">${index + 1}.</text>
        <text x="55" y="${y}" fill="#f0f6fc" font-family="Inter, Arial" font-size="14" font-weight="600">${title}</text>
        <text x="310" y="${y}" fill="#8b949e" font-family="Inter, Arial" font-size="13">${artist}</text>
      `;
    })
    .join('');

  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=30');
  res.setHeader('Content-Type', 'image/svg+xml');

  return res.status(200).send(`
    <svg width="520" height="230" viewBox="0 0 520 230" xmlns="http://www.w3.org/2000/svg">
      <rect width="520" height="230" fill="#0d1117" rx="16"/>
      <rect x="1" y="1" width="518" height="228" fill="none" stroke="#30363d" rx="16"/>
      <text x="28" y="35" fill="#1db954" font-family="Inter, Arial" font-size="15" font-weight="700">♪ Spotify Playlist</text>
      <text x="28" y="53" fill="#8b949e" font-family="Inter, Arial" font-size="12">Recently played tracks</text>
      ${rows || `<text x="260" y="125" fill="#8b949e" font-family="Inter, Arial" font-size="15" text-anchor="middle">No songs found</text>`}
    </svg>
  `);
}
