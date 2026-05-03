import { useEffect, useState } from 'react';
import { Box, Paper, Typography, Button, Chip } from '@mui/material';
import { getUPNews, getChannelLive } from '../../api';
import type { NewsItem } from '../../types';

const TV_CHANNELS = [
  { name: 'Aaj Tak',        desc: 'Hindi · #1 live news India',         handle: 'aajtak',          color: '#e63946' },
  { name: 'NDTV India',     desc: 'Hindi · National · UP coverage',     handle: 'NDTVIndia',       color: '#457b9d' },
  { name: 'ABP News',       desc: 'Hindi · Politics · Ground reports',  handle: 'abpnewsabhitak',  color: '#2a9d8f' },
  { name: 'Zee News',       desc: 'Hindi · Breaking · UP focus',        handle: 'zeenews',         color: '#6a0572' },
  { name: 'India TV',       desc: 'Hindi · Live breaking news',         handle: 'IndiaTV',         color: '#f4a261' },
  { name: 'TV9 Bharatvarsh',desc: 'Hindi · UP & Bihar · Ground news',   handle: 'tv9bharatvarsh',  color: '#e9c46a' },
  { name: 'News18 India',   desc: 'Hindi/English · National coverage',  handle: 'News18India',     color: '#264653' },
  { name: 'Republic Bharat',desc: 'Hindi · Debates · Investigative',    handle: 'RepublicBharat',  color: '#8338ec' },
  { name: 'NDTV 24x7',      desc: 'English · India · International',    handle: 'ndtv',            color: '#3a86ff' },
  { name: 'DD News',        desc: 'Hindi/English · Official Govt news', handle: 'DDNewsofficial',  color: '#fb5607' },
];

function timeAgo(dateStr?: string) {
  if (!dateStr) return '';
  try {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return `${Math.floor(diff / 1440)}d ago`;
  } catch { return ''; }
}

export default function SocialMedia() {
  const [tab, setTab]             = useState<'news' | 'tv'>('news');
  const [news, setNews]           = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [liveVideoId, setLiveVideoId] = useState<string | null>(null);
  const [liveEmbedUrl, setLiveEmbedUrl] = useState('');
  const [liveChannelName, setLiveChannelName] = useState('');
  const [watchLoading, setWatchLoading] = useState<number | null>(null);
  const [notLive, setNotLive]     = useState<{ name: string; url: string } | null>(null);

  useEffect(() => {
    getUPNews()
      .then(d => setNews(d.results || []))
      .finally(() => setNewsLoading(false));
  }, []);

  const watchChannel = async (i: number) => {
    const ch = TV_CHANNELS[i];
    setWatchLoading(i); setNotLive(null);
    try {
      const data = await getChannelLive(ch.handle);
      if (data.videoId) {
        setLiveVideoId(data.videoId);
        setLiveEmbedUrl(data.embedUrl!);
        setLiveChannelName(ch.name);
      } else {
        setNotLive({ name: ch.name, url: data.channelUrl || `https://www.youtube.com/@${ch.handle}/live` });
      }
    } catch {
      setNotLive({ name: ch.name, url: `https://www.youtube.com/@${ch.handle}/live` });
    } finally {
      setWatchLoading(null);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Header */}
      <Paper elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 2, p: 0, overflow: 'hidden' }}>
        <Box sx={{ p: 2.5, pb: 0, borderBottom: '1px solid #e2e8f0' }}>
          <Typography fontWeight={800} fontSize="1.2rem" mb={0.3}>UP Social Media</Typography>
          <Typography color="text.secondary" fontSize="0.875rem" mb={1.5}>Real-time Uttar Pradesh news and live TV channels</Typography>
          <Box sx={{ display: 'flex', gap: 0 }}>
            {(['news', 'tv'] as const).map(t => (
              <Button key={t} onClick={() => setTab(t)}
                sx={{ borderRadius: t === 'news' ? '8px 0 0 0' : '0 8px 0 0', textTransform: 'none', fontWeight: 700, px: 3,
                  background: tab === t ? '#FF6B35' : 'transparent', color: tab === t ? '#fff' : '#64748b',
                  '&:hover': { background: tab === t ? '#e85d2a' : '#f8fafc' }, border: '1px solid #e2e8f0', borderBottom: 'none' }}>
                {t === 'news' ? '📰 UP News' : '📺 Live TV'}
              </Button>
            ))}
          </Box>
        </Box>

        <Box sx={{ p: 2.5 }}>
          {tab === 'news' && (
            newsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><div className="loading-spinner" /></Box>
            ) : (
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 1.5 }}>
                {news.map((item, i) => (
                  <Box key={i} onClick={() => window.open(item.link, '_blank')}
                    sx={{ border: '1px solid #e2e8f0', borderRadius: 1.5, overflow: 'hidden', cursor: 'pointer', '&:hover': { borderColor: '#FF6B35', boxShadow: '0 4px 12px rgba(255,107,53,0.12)' }, transition: '0.18s' }}>
                    {item.image_url
                      ? <Box component="img" src={item.image_url} alt="" sx={{ width: '100%', height: 140, objectFit: 'cover' }} onError={(e: any) => e.target.style.display = 'none'} />
                      : <Box sx={{ height: 5, background: 'linear-gradient(90deg, #FF9933, #138808, #000080)' }} />}
                    <Box sx={{ p: 1.5 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="caption" color="#FF6B35" fontWeight={700} textTransform="uppercase">{item.source_id || 'News'}</Typography>
                        <Typography variant="caption" color="text.secondary">{timeAgo(item.pubDate)}</Typography>
                      </Box>
                      <Typography fontWeight={600} fontSize="0.875rem" lineHeight={1.45}>{item.title}</Typography>
                      {item.description && <Typography variant="caption" color="text.secondary" display="block" mt={0.5} sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.description.replace(/<[^>]*>/g, '')}</Typography>}
                    </Box>
                  </Box>
                ))}
              </Box>
            )
          )}

          {tab === 'tv' && (
            <Box>
              {liveVideoId && (
                <Box sx={{ mb: 2.5, border: '1px solid #e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, py: 1, background: '#1a1a2e' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', animation: 'pulse 1.2s infinite' }} />
                      <Typography fontWeight={700} color="#FF6B35" fontSize="0.9rem">LIVE — {liveChannelName}</Typography>
                    </Box>
                    <Button size="small" onClick={() => setLiveVideoId(null)} sx={{ color: '#fff', minWidth: 0 }}>✕ Close</Button>
                  </Box>
                  <Box sx={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
                    <iframe src={liveEmbedUrl} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                  </Box>
                </Box>
              )}

              {notLive && (
                <Box sx={{ mb: 2, p: 1.5, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="error">{notLive.name} is not live right now.</Typography>
                  <Button size="small" href={notLive.url} target="_blank" sx={{ color: '#FF6B35', textTransform: 'none', fontWeight: 700 }}>Open on YouTube →</Button>
                </Box>
              )}

              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 1.5 }}>
                {TV_CHANNELS.map((ch, i) => (
                  <Box key={i} sx={{ border: '1px solid #e2e8f0', borderRadius: 1.5, p: 1.5, '&:hover': { borderColor: '#FF6B35' }, transition: '0.18s' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                      <Typography fontWeight={700} fontSize="0.9rem">{ch.name}</Typography>
                      <Chip label="LIVE" size="small" sx={{ background: '#fef2f2', color: '#ef4444', fontSize: '0.6rem', fontWeight: 700 }} />
                    </Box>
                    <Box sx={{ height: 3, borderRadius: 1, background: ch.color, mb: 1, opacity: 0.7 }} />
                    <Typography variant="caption" color="text.secondary" display="block" mb={1}>{ch.desc}</Typography>
                    <Button fullWidth size="small" onClick={() => watchChannel(i)} disabled={watchLoading === i}
                      sx={{ background: '#fff7ed', border: '1px solid rgba(255,107,53,0.35)', color: '#FF6B35', fontWeight: 700, textTransform: 'none', '&:hover': { background: 'rgba(255,107,53,0.15)' } }}>
                      {watchLoading === i ? '⏳ Loading...' : '▶ WATCH'}
                    </Button>
                  </Box>
                ))}
              </Box>
            </Box>
          )}
        </Box>
      </Paper>
    </Box>
  );
}
