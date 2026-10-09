import { useEffect, useMemo, useRef, useState } from 'react';

const greetingLines = [
  'Hello love, new talent to find?',
  'Hi sweety, who are we checking today?',
  'Hey darling, ready to discover a channel?',
  'Hello gorgeous, let\'s find some talent.',
];

const videoCountOptions = [5, 10, 20, 50, 100, 'all'];

const defaultCustomPeriod = {
  from: '',
  to: '',
  lastNumber: 30,
  lastUnit: 'days',
};

const formatNumber = (value) => {
  if (Number.isNaN(value) || value === null || value === undefined) return '0';
  return new Intl.NumberFormat('en-US').format(Math.round(value));
};

const toDateInputValue = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const localBoundaryToUTC = (date) => {
  const normalized = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds()
  );

  return new Date(normalized.getTime() - normalized.getTimezoneOffset() * 60000).toISOString();
};

const formatFullDate = (dateString) => {
  const value = new Date(dateString);
  if (Number.isNaN(value.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(value);
};

const formatShortDate = (dateString) => {
  const value = new Date(dateString);
  if (Number.isNaN(value.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(value);
};

const parseUrl = (value) => {
  if (!value || !value.trim()) return null;

  const input = value.trim();
  if (input.startsWith('http://') || input.startsWith('https://')) {
    try {
      return new URL(input);
    } catch {
      return null;
    }
  }

  try {
    return new URL(`https://${input}`);
  } catch {
    return null;
  }
};

const getRelativeTimePeriod = (type) => {
  const now = new Date();
  const endDate = new Date(now);

  const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  const endOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

  const today = startOfDay(now);
  const start = new Date(today);

  switch (type) {
    case '7d':
      start.setDate(start.getDate() - 6);
      return { start: localBoundaryToUTC(start), end: localBoundaryToUTC(endOfDay(endDate)) };
    case 'thisWeek': {
      const day = start.getDay();
      const diff = (day === 0 ? -6 : 1) - day;
      start.setDate(start.getDate() + diff);
      return { start: localBoundaryToUTC(start), end: localBoundaryToUTC(endOfDay(endDate)) };
    }
    case 'lastWeek': {
      const currentStart = new Date(today);
      let day = currentStart.getDay();
      const diff = (day === 0 ? -6 : 1) - day;
      currentStart.setDate(currentStart.getDate() + diff);
      const previousStart = new Date(currentStart);
      previousStart.setDate(previousStart.getDate() - 7);
      const previousEnd = new Date(currentStart);
      previousEnd.setDate(previousEnd.getDate() - 1);
      return {
        start: localBoundaryToUTC(new Date(previousStart.getFullYear(), previousStart.getMonth(), previousStart.getDate(), 0, 0, 0, 0)),
        end: localBoundaryToUTC(new Date(previousEnd.getFullYear(), previousEnd.getMonth(), previousEnd.getDate(), 23, 59, 59, 999)),
      };
    }
    case '2w':
      start.setDate(start.getDate() - 13);
      return { start: localBoundaryToUTC(start), end: localBoundaryToUTC(endOfDay(endDate)) };
    case '3m':
      start.setMonth(start.getMonth() - 2);
      return { start: localBoundaryToUTC(start), end: localBoundaryToUTC(endOfDay(endDate)) };
    case '6m':
      start.setMonth(start.getMonth() - 5);
      return { start: localBoundaryToUTC(start), end: localBoundaryToUTC(endOfDay(endDate)) };
    case 'all':
      return { start: new Date('2005-01-01T00:00:00.000Z').toISOString(), end: localBoundaryToUTC(endOfDay(endDate)) };
    default:
      return { start: localBoundaryToUTC(start), end: localBoundaryToUTC(endOfDay(endDate)) };
  }
};

const getMonthRange = (year, month) => {
  const start = new Date(year, month, 1, 0, 0, 0, 0);
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
  return { start: localBoundaryToUTC(start), end: localBoundaryToUTC(end) };
};

const getYearRange = (year) => {
  const start = new Date(year, 0, 1, 0, 0, 0, 0);
  const end = new Date(year, 11, 31, 23, 59, 59, 999);
  return { start: localBoundaryToUTC(start), end: localBoundaryToUTC(end) };
};

const getPresetSummary = (preset) => {
  const labels = {
    '7d': 'Last 7 days',
    thisWeek: 'This week',
    lastWeek: 'Last week',
    '2w': 'Last 2 weeks',
    '3m': 'Last 3 months',
    '6m': 'Last 6 months',
    all: 'All time',
  };
  return labels[preset] || 'Custom period';
};

const getMonthOptions = () => {
  const today = new Date();
  const options = [];
  const current = new Date(today.getFullYear(), today.getMonth(), 1);
  const currentLabel = `${new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(current)} (so far)`;

  options.push({ label: currentLabel, year: current.getFullYear(), month: current.getMonth() });

  for (let i = 1; i <= 120; i += 1) {
    const d = new Date(current.getFullYear(), current.getMonth() - i, 1);
    options.push({
      label: new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(d),
      year: d.getFullYear(),
      month: d.getMonth(),
    });
  }

  return options;
};

const getYearOptions = () => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const options = [{ label: `${currentYear} (so far)`, value: currentYear }];

  for (let year = currentYear - 1; year >= currentYear - 10; year -= 1) {
    options.push({ label: String(year), value: year });
  }

  return options;
};

const parseDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const buildPeriodPayload = ({ preset, selectedMonth, selectedYear, customPeriod, channelFirstVideoDate }) => {
  const now = new Date();

  if (preset && preset !== 'custom') {
    const period = getRelativeTimePeriod(preset);
    return { type: 'preset', label: getPresetSummary(preset), ...period };
  }

  if (selectedMonth !== null && selectedMonth !== undefined) {
    const { start, end } = getMonthRange(selectedMonth.year, selectedMonth.month);
    return {
      type: 'month',
      label: `${new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(new Date(selectedMonth.year, selectedMonth.month, 1))}`,
      start,
      end,
    };
  }

  if (selectedYear !== null && selectedYear !== undefined) {
    const { start, end } = getYearRange(selectedYear);
    return {
      type: 'year',
      label: String(selectedYear),
      start,
      end: now > new Date(selectedYear, 11, 31) ? end : localBoundaryToUTC(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)),
    };
  }

  if (customPeriod.from && customPeriod.to) {
    const fromDate = parseDate(customPeriod.from);
    const toDate = parseDate(customPeriod.to);

    if (fromDate && toDate) {
      const from = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate(), 0, 0, 0, 0);
      const to = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate(), 23, 59, 59, 999);
      return {
        type: 'custom',
        label: `${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(from)} - ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(to)}`,
        start: localBoundaryToUTC(from),
        end: localBoundaryToUTC(to),
      };
    }
  }

  const { start, end } = getRelativeTimePeriod('7d');
  return { type: 'preset', label: 'Last 7 days', start, end };
};

const formatDuration = (seconds) => {
  if (!seconds) return '—';
  const total = Number(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const getAnimatedCountValue = (value) => {
  if (!Number.isFinite(value)) return 0;
  return value;
};

function useCountUp(target, duration = 1400) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const end = Number.isFinite(target) ? target : 0;
    let frame;
    const start = performance.now();
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setValue(end); return undefined; }
    setValue(0);
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(end * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return value;
}

function StatValue({ value }) {
  const animated = useCountUp(Number(value) || 0);
  return <div className="stat-value">{formatNumber(animated)}</div>;
}

function App() {
  const [darkMode, setDarkMode] = useState(() => {
    const stored = localStorage.getItem('viewly-theme');
    if (stored) return stored === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const [greetingIndex, setGreetingIndex] = useState(() => Math.floor(Math.random() * greetingLines.length));
  const [channelUrl, setChannelUrl] = useState('https://www.youtube.com/@nasa');
  const [videoCount, setVideoCount] = useState(20);
  const [preset, setPreset] = useState('7d');
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [selectedYear, setSelectedYear] = useState(null);
  const [customPeriod, setCustomPeriod] = useState(defaultCustomPeriod);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toolVisible, setToolVisible] = useState(false);
  const [periodMode, setPeriodMode] = useState('preset');
  const [showMore, setShowMore] = useState(25);
  const [sortKey, setSortKey] = useState('views');
  const [sortDirection, setSortDirection] = useState('desc');
  const toolRef = useRef(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('viewly-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setGreetingIndex((current) => (current + 1) % greetingLines.length);
    }, 4000);

    return () => window.clearInterval(timer);
  }, []);

  const monthOptions = useMemo(() => getMonthOptions(), []);
  const yearOptions = useMemo(() => getYearOptions(), []);

  const handleScrollToTool = () => {
    if (toolRef.current) {
      setToolVisible(true);
      toolRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleAnalyze = async () => {
    if (!channelUrl || !channelUrl.trim()) {
      setError('Please paste a YouTube channel URL first.');
      return;
    }

    setLoading(true);
    setError('');

    const payload = {
      channelUrl: channelUrl.trim(),
      maxVideos: videoCount === 'all' ? 'all' : Number(videoCount),
      period: buildPeriodPayload({
        preset: periodMode === 'preset' ? preset : null,
        selectedMonth,
        selectedYear,
        customPeriod,
      }),
    };

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Something went wrong while analyzing this channel.');
      }

      setAnalysis(data);
      setToolVisible(true);
      setShowMore(25);
    } catch (err) {
      setError(err.message || 'An unexpected error occurred.');
      setAnalysis(null);
    } finally {
      setLoading(false);
    }
  };

  const videoList = useMemo(() => {
    if (!analysis?.videos) return [];

    const copy = [...analysis.videos];
    copy.sort((a, b) => {
      const direction = sortDirection === 'asc' ? 1 : -1;
      if (sortKey === 'views') return (a.views - b.views) * direction;
      return ((new Date(a.publishedAt) - new Date(b.publishedAt)) * direction || 0);
    });

    return copy;
  }, [analysis, sortKey, sortDirection]);

  const visibleTableVideos = videoList.slice(0, showMore);

  const average = analysis?.stats?.average || 0;
  const median = analysis?.stats?.median || 0;
  const minVideo = analysis?.minVideo || null;

  const topFive = analysis?.top5 || [];
  const bottomFive = analysis?.bottom5 || [];

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === 'desc' ? 'asc' : 'desc'));
      return;
    }

    setSortKey(key);
    setSortDirection(key === 'views' ? 'desc' : 'desc');
  };

  const periodLabel = analysis?.period?.label || '—';

  return (
    <div className="min-h-screen text-[color:var(--text)] selection:bg-[rgba(41,22,49,0.16)]">
      <div className="aurora" aria-hidden="true">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
        <div className="blob blob-4" />
        <div className="blob blob-5" />
      </div>

      <header className="fixed inset-x-0 top-0 z-40 flex items-center justify-between px-6 py-5 sm:px-10">
        <div className="text-xl font-semibold tracking-[0.08em] uppercase">Viewly</div>
        <button
          type="button"
          className="pill-button px-4 py-2 text-sm font-medium"
          onClick={() => setDarkMode((current) => !current)}
          aria-label="Toggle dark mode"
        >
          {darkMode ? 'Light' : 'Dark'}
        </button>
      </header>

      <main>
        <section className="flex min-h-screen items-center justify-center px-6 text-center">
          <div className="max-w-5xl">
            <div className="relative h-[120px] sm:h-[180px]">
              <div className="absolute inset-0 flex items-center justify-center">
                <h1 className="greeting text-balance leading-[0.92] tracking-[-0.06em] text-[color:var(--text)]">
                  {greetingLines[greetingIndex]}
                </h1>
              </div>
            </div>

            <p className="mt-8 text-sm uppercase tracking-[0.2em] text-[color:var(--muted)]">
              Paste a YouTube channel and see how its videos really perform.
            </p>

            <button
              type="button"
              className="mt-10 inline-flex items-center gap-3 rounded-full bg-[color:var(--plum)] px-8 py-4 text-base font-semibold text-white transition hover:scale-[1.02]"
              onClick={handleScrollToTool}
            >
              Start
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/70 text-lg">→</span>
            </button>
          </div>
        </section>

        <section ref={toolRef} className="px-6 pb-24 pt-16 sm:px-10 lg:px-20">
          <div className="mx-auto max-w-7xl">
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="font-serif text-xs uppercase tracking-[0.28em] text-[color:var(--muted)]">Analyze</div>
                <h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">Channel performance</h2>
              </div>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
              <div className="flex-1">
                <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">Channel URL</label>
                <input
                  value={channelUrl}
                  onChange={(e) => setChannelUrl(e.target.value)}
                  className="w-full rounded-full bg-white/40 px-5 py-3 text-base text-[color:var(--text)] outline-none placeholder:text-[color:var(--muted)] dark:bg-white/10"
                  placeholder="https://youtube.com/@handle"
                />
              </div>

              <div className="lg:w-40">
                <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">Videos</label>
                <select
                  value={videoCount}
                  onChange={(e) => setVideoCount(e.target.value)}
                  className="w-full rounded-full bg-white/40 px-5 py-3 text-base text-[color:var(--text)] outline-none dark:bg-white/10"
                >
                  {videoCountOptions.map((option) => (
                    <option key={option} value={option}>
                      {option === 'all' ? 'All' : option}
                    </option>
                  ))}
                </select>
              </div>

              <div className="lg:w-52">
                <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">Period</label>
                <select
                  value={preset}
                  onChange={(e) => setPreset(e.target.value)}
                  className="w-full rounded-full bg-white/40 px-5 py-3 text-base text-[color:var(--text)] outline-none dark:bg-white/10"
                >
                  <option value="7d">Last 7 days</option>
                  <option value="thisWeek">This week</option>
                  <option value="lastWeek">Last week</option>
                  <option value="2w">Last 2 weeks</option>
                  <option value="3m">Last 3 months</option>
                  <option value="6m">Last 6 months</option>
                  <option value="all">All time</option>
                </select>
              </div>

              <button
                type="button"
                onClick={handleAnalyze}
                className="inline-flex items-center justify-center rounded-full bg-[color:var(--plum)] px-7 py-3 text-base font-semibold text-white transition hover:scale-[1.01]"
                disabled={loading}
              >
                {loading ? 'Analyzing…' : 'Analyze'}
              </button>
            </div>

            <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-end">
              <div className="flex flex-col gap-2 lg:w-1/3">
                <label className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">Month</label>
                <select
                  value={selectedMonth ? `${selectedMonth.year}-${selectedMonth.month}` : ''}
                  onChange={(e) => {
                    const [year, month] = e.target.value.split('-').map(Number);
                    setSelectedMonth({ year, month });
                    setPeriodMode('month');
                    setPreset('7d');
                  }}
                  className="rounded-full bg-white/40 px-5 py-3 text-base text-[color:var(--text)] outline-none dark:bg-white/10"
                >
                  <option value="">Choose month</option>
                  {monthOptions.map((option, index) => (
                    <option key={`${option.year}-${option.month}-${index}`} value={`${option.year}-${option.month}`}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-2 lg:w-1/3">
                <label className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">Year</label>
                <select
                  value={selectedYear ?? ''}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setSelectedYear(value);
                    setPeriodMode('year');
                    setPreset('7d');
                  }}
                  className="rounded-full bg-white/40 px-5 py-3 text-base text-[color:var(--text)] outline-none dark:bg-white/10"
                >
                  <option value="">Choose year</option>
                  {yearOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-2 lg:w-1/3">
                <label className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">Custom</label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={customPeriod.from}
                    onChange={(e) => {
                      setCustomPeriod((current) => ({ ...current, from: e.target.value }));
                      setPeriodMode('custom');
                    }}
                    className="w-full rounded-full bg-white/40 px-4 py-3 text-base text-[color:var(--text)] outline-none dark:bg-white/10"
                  />
                  <input
                    type="date"
                    value={customPeriod.to}
                    onChange={(e) => {
                      setCustomPeriod((current) => ({ ...current, to: e.target.value }));
                      setPeriodMode('custom');
                    }}
                    className="w-full rounded-full bg-white/40 px-4 py-3 text-base text-[color:var(--text)] outline-none dark:bg-white/10"
                  />
                </div>
              </div>
            </div>

            {error && <div className="mt-6 text-sm text-[#9a1e38]">{error}</div>}

            {loading && (
              <div className="mt-8 flex items-center gap-3 text-sm uppercase tracking-[0.2em] text-[color:var(--muted)]">
                <span className="loading-dot" />
                <span>Loading channel stats</span>
              </div>
            )}

            {analysis && (
              <div className="mt-12 animate-fade-in">
                <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-center gap-4">
                    {analysis.channel.avatar ? (
                      <img src={analysis.channel.avatar} alt={analysis.channel.title} className="h-16 w-16 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(42,22,51,0.12)] text-lg font-semibold">
                        {analysis.channel.title?.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <h3 className="text-2xl font-semibold tracking-[-0.05em]">{analysis.channel.title}</h3>
                      <p className="mt-1 text-sm uppercase tracking-[0.18em] text-[color:var(--muted)]">{analysis.period.label}</p>
                    </div>
                  </div>
                  <div className="text-sm uppercase tracking-[0.18em] text-[color:var(--muted)]">
                    {analysis.videoCount} videos counted
                  </div>
                </div>

                <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="stat-block">
                    <div className="stat-label">Average views</div>
                    <StatValue value={Math.round(average)} />
                  </div>

                  <div className="stat-block">
                    <div className="stat-label">Median views</div>
                    <StatValue value={Math.round(median)} />
                  </div>

                  <div className="stat-block">
                    <div className="stat-label">Minimum views</div>
                    <StatValue value={analysis.stats?.minimum || 0} />
                    {minVideo && (
                      <div className="mt-3 flex items-center gap-3 text-left">
                        <img src={minVideo.thumbnail} alt={minVideo.title} className="h-12 w-20 rounded-lg object-cover" />
                        <div className="min-w-0">
                          <a href={minVideo.url} target="_blank" rel="noreferrer" className="block truncate text-sm font-medium text-[color:var(--text)] hover:underline">
                            {minVideo.title}
                          </a>
                          <p className="text-xs text-[color:var(--muted)]">{formatShortDate(minVideo.publishedAt)}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="stat-block">
                    <div className="stat-label">Videos counted</div>
                    <StatValue value={analysis.videoCount || 0} />
                    <div className="mt-3 text-sm text-[color:var(--muted)]">
                      {analysis.skippedCount || 0} skipped (Shorts / streams)
                    </div>
                  </div>
                </div>

                {average > median * 2 && (
                  <div className="mt-6 text-sm uppercase tracking-[0.18em] text-[color:var(--muted)]">
                    A few very popular videos are raising the average.
                  </div>
                )}

                {analysis.videoCount >= 3 && (
                  <div className="mt-12 grid gap-10 xl:grid-cols-2">
                    <div>
                      <div className="mb-4 text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">Top 5</div>
                      <ul className="space-y-3">
                        {topFive.map((video) => (
                          <li key={video.id} className="flex items-center gap-3">
                            <img src={video.thumbnail} alt={video.title} className="h-12 w-20 rounded-lg object-cover" />
                            <div className="min-w-0 flex-1">
                              <a href={video.url} target="_blank" rel="noreferrer" className="block truncate text-sm font-medium text-[color:var(--text)] hover:underline">
                                {video.title}
                              </a>
                              <div className="flex items-center justify-between gap-2 text-[11px] uppercase tracking-[0.1em] text-[color:var(--muted)]">
                                <span>{formatShortDate(video.publishedAt)}</span>
                                <span>{formatNumber(video.views)} views</span>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <div className="mb-4 text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">Bottom 5</div>
                      <ul className="space-y-3">
                        {bottomFive.map((video) => (
                          <li key={video.id} className="flex items-center gap-3">
                            <img src={video.thumbnail} alt={video.title} className="h-12 w-20 rounded-lg object-cover" />
                            <div className="min-w-0 flex-1">
                              <a href={video.url} target="_blank" rel="noreferrer" className="block truncate text-sm font-medium text-[color:var(--text)] hover:underline">
                                {video.title}
                              </a>
                              <div className="flex items-center justify-between gap-2 text-[11px] uppercase tracking-[0.1em] text-[color:var(--muted)]">
                                <span>{formatShortDate(video.publishedAt)}</span>
                                <span>{formatNumber(video.views)} views</span>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {analysis.videoCount > 0 && analysis.videoCount < 3 && (
                  <div className="mt-8 text-sm uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    Only {analysis.videoCount} long-form video{analysis.videoCount > 1 ? 's' : ''} fell in this period.
                  </div>
                )}

                {analysis.videos && analysis.videos.length > 0 && (
                  <div className="mt-14">
                    <div className="mb-4 flex items-center justify-between gap-4">
                      <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">Included videos</div>
                      <div className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">{visibleTableVideos.length} shown</div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[900px] border-collapse text-left">
                        <thead>
                          <tr className="border-b border-[rgba(42,22,51,0.15)] text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
                            <th className="pb-3 pr-4 font-medium">Thumb</th>
                            <th className="pb-3 pr-4 font-medium">Title</th>
                            <th className="pb-3 pr-4 font-medium">
                              <button type="button" className="hover:text-[color:var(--text)]" onClick={() => toggleSort('date')}>
                                Date
                              </button>
                            </th>
                            <th className="pb-3 pr-4 font-medium">Duration</th>
                            <th className="pb-3 pr-4 font-medium">
                              <button type="button" className="hover:text-[color:var(--text)]" onClick={() => toggleSort('views')}>
                                Views
                              </button>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleTableVideos.map((video) => (
                            <tr key={video.id} className="border-b border-[rgba(42,22,51,0.1)] align-middle">
                              <td className="py-3 pr-4"><img src={video.thumbnail} alt={video.title} className="h-14 w-24 rounded-lg object-cover" /></td>
                              <td className="py-3 pr-4">
                                <a href={video.url} target="_blank" rel="noreferrer" className="font-medium text-[color:var(--text)] hover:underline">
                                  {video.title}
                                </a>
                              </td>
                              <td className="py-3 pr-4 text-sm text-[color:var(--muted)]">{formatFullDate(video.publishedAt)}</td>
                              <td className="py-3 pr-4 text-sm text-[color:var(--muted)]">{formatDuration(video.durationSeconds)}</td>
                              <td className="py-3 pr-4 text-sm font-medium text-[color:var(--text)]">{formatNumber(video.views)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {visibleTableVideos.length < videoList.length && (
                      <button
                        type="button"
                        onClick={() => setShowMore((current) => current + 25)}
                        className="mt-6 inline-flex items-center rounded-full border border-[rgba(42,22,51,0.2)] px-5 py-2 text-sm uppercase tracking-[0.18em] text-[color:var(--text)] transition hover:bg-[rgba(255,255,255,0.3)] dark:hover:bg-[rgba(255,255,255,0.08)]"
                      >
                        Show more
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
