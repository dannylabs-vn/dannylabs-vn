export default async function handler(req, res) {
  const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REFRESH_TOKEN } = process.env;

  const basic = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
  
  // 1. Get Access Token
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

  const { access_token } = await tokenResponse.json();

  // 2. Get Now Playing
  const nowPlayingResponse = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
    headers: {
      Authorization: `Bearer ${access_token}`,
    },
  });

  if (nowPlayingResponse.status === 204 || nowPlayingResponse.status > 400) {
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.status(200).send(`
      <svg width="400" height="100" xmlns="http://www.w3.org/2000/svg">
        <rect width="400" height="100" fill="#181818" rx="10"/>
        <text x="200" y="55" fill="#b3b3b3" font-family="Arial" font-size="16" text-anchor="middle">Not currently playing</text>
      </svg>
    `);
  }

  const song = await nowPlayingResponse.json();
  const isPlaying = song.is_playing;
  
  if (!isPlaying) {
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.status(200).send(`
      <svg width="400" height="100" xmlns="http://www.w3.org/2000/svg">
        <rect width="400" height="100" fill="#181818" rx="10"/>
        <text x="200" y="55" fill="#b3b3b3" font-family="Arial" font-size="16" text-anchor="middle">Not currently playing</text>
      </svg>
    `);
  }

  const title = song.item.name;
  const artist = song.item.artists.map((_artist) => _artist.name).join(', ');
  
  // To avoid CORS issues with SVG images, we fetch the image and convert to base64
  const albumImageUrl = song.item.album.images[0].url;
  const imageResponse = await fetch(albumImageUrl);
  const arrayBuffer = await imageResponse.arrayBuffer();
  const base64Image = Buffer.from(arrayBuffer).toString('base64');
  const imageMimeType = imageResponse.headers.get('content-type') || 'image/jpeg';
  const dataUri = `data:${imageMimeType};base64,${base64Image}`;

  res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=15');
  res.setHeader('Content-Type', 'image/svg+xml');
  
  const svg = `
  <svg width="400" height="120" xmlns="http://www.w3.org/2000/svg">
    <rect width="400" height="120" fill="#181818" rx="10"/>
    <image href="${dataUri}" x="20" y="20" height="80" width="80"/>
    <text x="120" y="45" fill="white" font-family="Arial" font-size="18" font-weight="bold">${title}</text>
    <text x="120" y="70" fill="#b3b3b3" font-family="Arial" font-size="14">${artist}</text>
    <text x="120" y="95" fill="#1db954" font-family="Arial" font-size="13">▶ Now Playing on Spotify</text>
  </svg>
  `;
  return res.status(200).send(svg);
}
