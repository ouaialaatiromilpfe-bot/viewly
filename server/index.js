import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, '../dist');

if (!process.env.YOUTUBE_API_KEY) {
  console.error('Missing YOUTUBE_API_KEY. Create a .env file and add your key (see README).');
  process.exit(1);
}

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const shortCheckCache = new Map();
const apiCache = new Map();

// Limit concurrent Shorts checks to 5 requests at once.
let shortsCheckInProgress = 0;
const MAX_CONCURRENT_SHORTS_CHECKS = 5;
const shortsCheckQueue = [];

app.use(express.json({ limit: '2mb' }));

const cacheKey = (label, params = {}) => `${label}:${JSON.stringify(params)}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForShortsCheckSlot = () => new Promise((resolve) => {
  if (shortsCheckInProgress < MAX_CONCURRENT_SHORTS_CHECKS) {
    shortsCheckInProgress += 1;
    resolve();
    return;
  }

  shortsCheckQueue.push(resolve);
});

const releaseShortsCheckSlot = () => {
  shortsCheckInProgress -= 1;
  const next = shortsCheckQueue.shift();
  if (next) {
    shortsCheckInProgress += 1;
    next();
  }
};

const youtubeRequest = async (endpoint, params = {}) => {
  const key = cacheKey(endpoint, params);
  const cached = apiCache.get(key);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.value;
  }

  const url = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`);
  Object.entries(params).forEach(([name, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(name, value);
    }
  });
  url.searchParams.set('key', YOUTUBE_API_KEY);

  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`YouTube API request failed for ${endpoint}: ${response.status}`);
  }

  const payload = await response.json();
  apiCache.set(key, {
    value: payload,
    expiresAt: Date.now() + 1000 * 60 * 5,
  });

  return payload;
};

const parseChannelReference = (input) => {
  if (!input || !input.trim()) return null;

  const value = input.trim();
  if (/^@\w/.test(value)) return { type: 'handle', value: value.slice(1) };
  if (/^UC[\w-]{22,}$/.test(value)) return { type: 'channelId', value };

  try {
    const url = new URL(value.includes('://') ? value : `https://${value}`);
    const host = url.hostname.replace(/^www\./, '');

    if (!host.includes('youtube.com') && !host.includes('youtu.be')) {
      return null;
    }

    const parts = url.pathname.split('/').filter(Boolean);
    if (parts[0]?.startsWith('@')) return { type: 'handle', value: parts[0].slice(1) };
    if (parts[0] === 'channel' && parts[1]) return { type: 'channelId', value: parts[1] };
    if (parts[0] === 'user' && parts[1]) return { type: 'username', value: parts[1] };
    if (parts[0] === 'c' && parts[1]) return { type: 'custom', value: parts[1] };
    if (parts[0] && /^UC/.test(parts[0])) return { type: 'channelId', value: parts[0] };
  } catch {
    return null;
  }

  return { type: 'custom', value };
};

const getChannelMeta = async (channelUrl) => {
  const ref = parseChannelReference(channelUrl);
  if (!ref) throw new Error('Invalid YouTube channel URL.');

  let channelData = null;

  if (ref.type === 'handle') {
    channelData = await youtubeRequest('channels', {
      part: 'id,snippet,statistics',
      forHandle: ref.value,
      maxResults: 1,
    });
  } else if (ref.type === 'channelId') {
    channelData = await youtubeRequest('channels', {
      part: 'id,snippet,statistics',
      id: ref.value,
      maxResults: 1,
    });
  } else if (ref.type === 'username') {
    channelData = await youtubeRequest('channels', {
      part: 'id,snippet,statistics',
      forUsername: ref.value,
      maxResults: 1,
    });
  } else if (ref.type === 'custom') {
    const searchResult = await youtubeRequest('search', {
      part: 'snippet',
      q: ref.value,
      type: 'channel',
      maxResults: 5,
    });

    const item = searchResult?.items?.find((entry) => entry?.snippet?.channelId);
    if (!item) throw new Error('Channel not found.');

    channelData = await youtubeRequest('channels', {
      part: 'id,snippet,statistics',
      id: item.snippet.channelId,
      maxResults: 1,
    });
  }

  const channel = channelData?.items?.[0];
  if (!channel?.id) throw new Error('Channel not found.');

  return {
    id: channel.id,
    title: channel.snippet?.title || 'Unknown channel',
    avatar: channel.snippet?.thumbnails?.high?.url || channel.snippet?.thumbnails?.medium?.url || '',
    customUrl: channel.snippet?.customUrl || '',
  };
};

const parseDuration = (isoDuration) => {
  if (!isoDuration) return 0;
  const match = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i.exec(isoDuration);
  if (!match) return 0;

  const days = Number(match[1] || 0);
  const hours = Number(match[2] || 0);
  const minutes = Number(match[3] || 0);
  const seconds = Number(match[4] || 0);
  return days * 86400 + hours * 3600 + minutes * 60 + seconds;
};

const normalizeVideo = (video) => {
  const snippet = video?.snippet || {};
  const stats = video?.statistics || {};
  const details = video?.contentDetails || {};

  return {
    id: video?.id,
    title: snippet.title || 'Untitled video',
    thumbnail: snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || '',
    url: `https://www.youtube.com/watch?v=${video?.id}`,
    publishedAt: snippet.publishedAt || null,
    durationSeconds: details.duration ? parseDuration(details.duration) : 0,
    views: Number(stats.viewCount || 0),
    liveStreamingDetails: video?.liveStreamingDetails || null,
    liveBroadcastContent: snippet.liveBroadcastContent || 'none',
  };
};

const fetchPlaylistVideos = async ({ channelId, startDate, endDate, maxVideos, playlistType = 'UULF' }) => {
  const playlistId = `${playlistType}${channelId.slice(2)}`;
  const collected = [];
  let nextPageToken = null;
  let stopped = false;

  while (!stopped) {
    const response = await youtubeRequest('playlistItems', {
      part: 'snippet,status,contentDetails',
      playlistId,
      maxResults: 50,
      pageToken: nextPageToken || undefined,
    });

    const items = response?.items || [];

    for (const item of items) {
      const videoId = item?.snippet?.resourceId?.videoId;
      const publishedAt = item?.snippet?.publishedAt;
      if (!videoId || !publishedAt) continue;

      const publishedTime = new Date(publishedAt).getTime();
      if (!Number.isFinite(publishedTime)) continue;

      if (publishedTime < new Date(startDate).getTime()) {
        stopped = true;
        break;
      }

      if (publishedTime > new Date(endDate).getTime()) {
        continue;
      }

      collected.push({ id: videoId, publishedAt });

      if (maxVideos && maxVideos !== 'all' && collected.length >= Number(maxVideos)) {
        stopped = true;
        break;
      }
    }

    if (!response.nextPageToken || stopped) break;
    nextPageToken = response.nextPageToken;
  }

  return collected;
};

const isShortVideo = async (videoId) => {
  if (shortCheckCache.has(videoId)) return shortCheckCache.get(videoId);

  await waitForShortsCheckSlot();

  try {
    const url = `https://www.youtube.com/shorts/${videoId}`;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);

        const response = await fetch(url, {
          method: 'HEAD',
          redirect: 'manual',
          signal: controller.signal,
        });
        clearTimeout(timeout);

        const isShort = response.status === 200;
        shortCheckCache.set(videoId, isShort);
        return isShort;
      } catch {
        if (attempt < 1) await sleep(250);
      }
    }

    shortCheckCache.set(videoId, false);
    return false;
  } finally {
    releaseShortsCheckSlot();
  }
};

const filterRegularLongFormVideos = async (videos, startDate, endDate) => {
  const startMs = new Date(startDate).getTime();
  const endMs = new Date(endDate).getTime();

  const kept = [];
  let skippedShorts = 0;
  let skippedLiveStreams = 0;

  for (const video of videos) {
    if (!video.publishedAt) continue;

    const publishedTime = new Date(video.publishedAt).getTime();
    if (publishedTime < startMs || publishedTime > endMs) continue;

    // Exclude any video that has liveStreamingDetails OR is not a normal video broadcast.
    if (video.liveStreamingDetails || video.liveBroadcastContent !== 'none') {
      skippedLiveStreams += 1;
      continue;
    }

    // Exclude Shorts for videos <= 3 minutes.
    if (video.durationSeconds <= 180) {
      const isShort = await isShortVideo(video.id);
      if (isShort) {
        skippedShorts += 1;
        continue;
      }
    }

    kept.push(video);
  }

  return { filtered: kept, skippedShorts, skippedLiveStreams };
};

const computeStats = (videos) => {
  const values = videos.map((video) => Number(video.views) || 0).sort((a, b) => a - b);
  const total = values.reduce((sum, item) => sum + item, 0);
  const average = values.length ? total / values.length : 0;

  let median = 0;
  const mid = Math.floor(values.length / 2);
  if (values.length % 2 === 0) {
    median = (values[mid - 1] + values[mid]) / 2;
  } else {
    median = values[mid];
  }

  const minimum = values.length ? values[0] : 0;
  return { average, median, minimum };
};

const analyzeChannel = async ({ channelUrl, maxVideos, period }) => {
  const channel = await getChannelMeta(channelUrl);
  const limit = maxVideos === 'all' ? null : Number(maxVideos);

  let candidateList = await fetchPlaylistVideos({
    channelId: channel.id,
    startDate: period.start,
    endDate: period.end,
    maxVideos: limit,
    playlistType: 'UULF',
  });

  if (candidateList.length === 0) {
    candidateList = await fetchPlaylistVideos({
      channelId: channel.id,
      startDate: period.start,
      endDate: period.end,
      maxVideos: limit,
      playlistType: 'UU',
    });
  }

  if (candidateList.length === 0) {
    return {
      channel,
      period: { label: period.label || 'Selection', start: period.start, end: period.end },
      videoCount: 0,
      skippedCount: 0,
      skippedShorts: 0,
      skippedLiveStreams: 0,
      stats: { average: 0, median: 0, minimum: 0 },
      videos: [],
      top5: [],
      bottom5: [],
      minVideo: null,
    };
  }

  const uniqueIds = [...new Set(candidateList.map((item) => item.id))];
  const videoDetails = [];

  for (let index = 0; index < uniqueIds.length; index += 50) {
    const batch = uniqueIds.slice(index, index + 50);
    const detailResponse = await youtubeRequest('videos', {
      part: 'snippet,statistics,contentDetails,liveStreamingDetails',
      id: batch.join(','),
    });

    videoDetails.push(...(detailResponse?.items || []));
  }

  const normalized = videoDetails.map(normalizeVideo);
  const { filtered, skippedShorts, skippedLiveStreams } = await filterRegularLongFormVideos(
    normalized,
    period.start,
    period.end
  );

  const sorted = [...filtered].sort((a, b) => b.views - a.views);
  const stats = sorted.length ? computeStats(sorted) : { average: 0, median: 0, minimum: 0 };

  const top5 = sorted.slice(0, 5);
  const remainingLowest = [...sorted].sort((a, b) => a.views - b.views);
  const bottom5 = remainingLowest.slice(0, 5);

  const minVideo = [...sorted].sort((a, b) => a.views - b.views)[0] || null;

  return {
    channel,
    period: { label: period.label || 'Selection', start: period.start, end: period.end },
    videoCount: sorted.length,
    skippedCount: skippedShorts + skippedLiveStreams,
    skippedShorts,
    skippedLiveStreams,
    stats,
    videos: sorted,
    top5,
    bottom5,
    minVideo: minVideo ? {
      id: minVideo.id,
      title: minVideo.title,
      thumbnail: minVideo.thumbnail,
      url: minVideo.url,
      publishedAt: minVideo.publishedAt,
      views: minVideo.views,
    } : null,
  };
};

app.post('/api/analyze', async (req, res) => {
  try {
    const { channelUrl, maxVideos, period } = req.body || {};

    if (!channelUrl) {
      return res.status(400).json({ error: 'Please paste a valid YouTube channel URL.' });
    }

    if (!period || !period.start || !period.end) {
      return res.status(400).json({ error: 'A valid period is required.' });
    }

    const result = await analyzeChannel({ channelUrl, maxVideos, period });
    return res.json(result);
  } catch (error) {
    const message = error?.message || 'There was a problem analyzing the channel.';

    if (message.includes('quota') || message.toLowerCase().includes('forbidden')) {
      return res.status(429).json({ error: 'YouTube API quota exceeded. Please try again in a few minutes.' });
    }

    if (message.toLowerCase().includes('channel not found')) {
      return res.status(404).json({ error: 'Channel not found. Please check the link and try again.' });
    }

    return res.status(400).json({ error: message });
  }
});

app.use(express.static(distPath));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Viewly backend running on http://localhost:${PORT}`);
});
