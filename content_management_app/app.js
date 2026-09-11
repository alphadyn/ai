/**
 * Nexus CMS — Modern Content & Media Management System
 * Full-featured content management system with Supabase persistence,
 * rich media players, metadata editing, tags, multi-criteria search, sorting, and batch actions.
 */

(function () {
  'use strict';

  // ==========================================================================
  // 1. Persistent Supabase Database Client (No LocalStorage / IndexedDB Storage)
  // ==========================================================================
  const SUPABASE_CONFIG = window.NEXUS_SUPABASE || {};
  const SUPABASE_URL = SUPABASE_CONFIG.url;
  const SUPABASE_ANON_KEY = SUPABASE_CONFIG.anonKey;

  const db = {
    isConnected: false,
    dbName: 'Supabase media_items',
    connectionError: '',

    async request(path, options = {}) {
      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        throw new Error('Supabase is not configured. Add credentials to supabase-config.js.');
      }
      return fetch(`${SUPABASE_URL.replace(/\/$/, '')}${path}`, {
        ...options,
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          ...(options.headers || {})
        }
      });
    },

    mapRow(row) {
      return {
        ...row,
        mimeType: row.mime_type,
        customProps: row.custom_props || [],
        dataUrl: row.data_url,
        textContent: row.text_content,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        starred: Boolean(row.starred)
      };
    },

    mapItem(item) {
      return {
        id: item.id,
        title: item.title || 'Untitled',
        filename: item.filename || 'file.bin',
        type: item.type || 'other',
        mime_type: item.mimeType || item.mime_type || 'application/octet-stream',
        size: Number(item.size || 0),
        date: item.date || new Date().toISOString(),
        category: item.category || 'General',
        author: item.author || 'Anonymous',
        status: item.status || 'published',
        rating: Number(item.rating || 0),
        starred: Boolean(item.starred),
        tags: item.tags || [],
        description: item.description || '',
        custom_props: item.customProps || item.custom_props || [],
        data_url: item.dataUrl || item.data_url || null,
        text_content: item.textContent || item.text_content || null,
        created_at: item.createdAt || item.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    },

    async checkHealth() {
      try {
        const res = await this.request('/rest/v1/media_items?select=id&limit=1');
        this.isConnected = res.ok;
        this.connectionError = res.ok ? '' : `Supabase returned HTTP ${res.status}`;
        if (!res.ok) {
          try {
            const error = await res.json();
            this.connectionError = error.message || this.connectionError;
          } catch (err) {
            // Keep the HTTP status when the response is not JSON.
          }
        }
        return res.ok;
      } catch (err) {
        this.isConnected = false;
        this.connectionError = err.message || 'Supabase request failed';
        return false;
      }
    },

    async init() {
      return await this.checkHealth();
    },

    async getAll() {
      try {
        const res = await this.request('/rest/v1/media_items?select=*&order=date.desc');
        if (res.ok) {
          return (await res.json()).map((row) => this.mapRow(row));
        }
      } catch (err) {
        console.error('Failed to fetch from Supabase:', err);
      }
      return [];
    },

    async getById(id) {
      try {
        const res = await this.request(`/rest/v1/media_items?id=eq.${encodeURIComponent(id)}&select=*`);
        if (res.ok) return this.mapRow((await res.json())[0]);
      } catch (err) {
        console.error('Failed to get item from Supabase:', err);
      }
      return null;
    },

    async put(item) {
      try {
        const res = await this.request('/rest/v1/media_items?on_conflict=id', {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
          body: JSON.stringify(this.mapItem(item))
        });
        if (res.ok) return this.mapRow((await res.json())[0]);
      } catch (err) {
        console.error('Failed to save item to Supabase:', err);
        throw err;
      }
      return item;
    },

    async putMany(items) {
      try {
        const res = await this.request('/rest/v1/media_items?on_conflict=id', {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify(items.map((item) => this.mapItem(item)))
        });
        if (res.ok) return true;
      } catch (err) {
        console.error('Failed to batch save to Supabase:', err);
        throw err;
      }
      return false;
    },

    async delete(id) {
      try {
        const res = await this.request(`/rest/v1/media_items?id=eq.${encodeURIComponent(id)}`, {
          method: 'DELETE'
        });
        if (res.ok) return true;
      } catch (err) {
        console.error('Failed to delete item from Supabase:', err);
        throw err;
      }
      return false;
    },

    async deleteMany(ids) {
      try {
        const filter = ids.map((id) => encodeURIComponent(id)).join(',');
        const res = await this.request(`/rest/v1/media_items?id=in.(${filter})`, { method: 'DELETE' });
        if (res.ok) return true;
      } catch (err) {
        console.error('Failed to batch delete from Supabase:', err);
        throw err;
      }
      return false;
    },

    async clear() {
      try {
        const res = await this.request('/rest/v1/media_items?id=not.is.null', { method: 'DELETE' });
        if (res.ok) return true;
      } catch (err) {
        console.error('Failed to clear Supabase database:', err);
        throw err;
      }
      return false;
    }
  };

  // ==========================================================================
  // 2. State & Data Models
  // ==========================================================================
  const state = {
    items: [],
    selectedIds: new Set(),
    viewMode: 'grid',
    theme: 'dark',
    filter: {
      type: 'all',
      status: 'all',
      search: '',
      tags: new Set(),
      datePreset: 'all',
      sizePreset: 'all'
    },
    sortBy: 'date-desc',
    activeViewerIndex: -1,
    activeViewerList: [],
    pendingUploadFile: null,
    uploadTags: new Set(),
    editTags: new Set(),
    batchTags: new Set(),
    lastDeletedItems: [] // for undo toast
  };

  // ==========================================================================
  // 3. Helper Functions
  // ==========================================================================
  function generateId() {
    return 'item_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
  }

  function formatBytes(bytes, decimals = 1) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  function formatDateTime(isoString) {
    if (!isoString) return '—';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function formatDateInput(d = new Date()) {
    const pad = (n) => (n < 10 ? '0' + n : n);
    return (
      d.getFullYear() +
      '-' +
      pad(d.getMonth() + 1) +
      '-' +
      pad(d.getDate()) +
      'T' +
      pad(d.getHours()) +
      ':' +
      pad(d.getMinutes())
    );
  }

  function detectFileType(fileOrName, mimeType = '') {
    const name = typeof fileOrName === 'string' ? fileOrName : fileOrName.name || '';
    const ext = name.split('.').pop().toLowerCase();
    const mime = (mimeType || (fileOrName.type || '')).toLowerCase();

    if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'avif', 'ico'].includes(ext)) {
      return 'image';
    }
    if (mime.startsWith('video/') || ['mp4', 'webm', 'mov', 'avi', 'mkv', 'ogv'].includes(ext)) {
      return 'video';
    }
    if (mime.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext)) {
      return 'audio';
    }
    if (ext === 'pdf' || mime === 'application/pdf') {
      return 'document';
    }
    if (
      ['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'json', 'py', 'sh', 'sql', 'cpp', 'c', 'rs', 'go', 'xml', 'yaml', 'yml'].includes(ext) ||
      mime.includes('javascript') ||
      mime.includes('json') ||
      mime.includes('xml')
    ) {
      return 'code';
    }
    if (
      ['doc', 'docx', 'txt', 'md', 'rtf', 'csv', 'xlsx', 'xls', 'pptx', 'ppt'].includes(ext) ||
      mime.startsWith('text/') ||
      mime.includes('document') ||
      mime.includes('spreadsheet')
    ) {
      return 'document';
    }
    if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext)) {
      return 'archive';
    }
    return 'other';
  }

  function getFileExtension(filename = '') {
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop().toUpperCase() : 'FILE';
  }

  function escapeHtml(str) {
    if (typeof str !== 'string') return String(str || '');
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function getDirectItemUrl(itemOrId) {
    const id = typeof itemOrId === 'string' ? itemOrId : itemOrId.id;
    if (typeof window === 'undefined' || !window.location) return `/?item=${encodeURIComponent(id)}`;

    const loc = window.location;
    // Base URL without existing search params or hash
    const baseUrl = `${loc.protocol}//${loc.host}${loc.pathname}`;
    return `${baseUrl}?item=${encodeURIComponent(id)}`;
  }

  function copyItemDirectUrl(itemOrId) {
    const url = getDirectItemUrl(itemOrId);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        showToast(`Copied direct URL to clipboard`, 'success');
      }).catch(() => {
        prompt('Direct CMS URL:', url);
      });
    } else {
      prompt('Direct CMS URL:', url);
    }
  }

  // ==========================================================================
  // 4. Sample Media Preloading Data Generator
  // ==========================================================================
  function generateSampleAudioDataUrl() {
    // Generates a lightweight synthesized WAV melodic chirp in Base64
    const sampleRate = 22050;
    const duration = 2.5;
    const numSamples = Math.floor(sampleRate * duration);
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);

    // RIFF chunk descriptor
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + numSamples * 2, true);
    writeString(view, 8, 'WAVE');
    // "fmt " sub-chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    // "data" sub-chunk
    writeString(view, 36, 'data');
    view.setUint32(40, numSamples * 2, true);

    // Write musical arpeggio chords
    const notes = [440, 554.37, 659.25, 880, 659.25, 554.37];
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const noteIndex = Math.floor((t * 2.4) % notes.length);
      const freq = notes[noteIndex];
      const envelope = Math.sin((t / duration) * Math.PI) * Math.exp(-((t * 4) % 1) * 2);
      const sample = Math.sin(2 * Math.PI * freq * t) * envelope * 0.6;
      view.setInt16(44 + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    }

    function writeString(v, offset, string) {
      for (let i = 0; i < string.length; i++) {
        v.setUint8(offset + i, string.charCodeAt(i));
      }
    }

    const blob = new Blob([buffer], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
  }

  function getSampleDataset() {
    const now = new Date();
    const d1 = new Date(now.getTime() - 1000 * 60 * 60 * 2).toISOString();
    const d2 = new Date(now.getTime() - 1000 * 60 * 60 * 24).toISOString();
    const d3 = new Date(now.getTime() - 1000 * 60 * 60 * 48).toISOString();
    const d4 = new Date(now.getTime() - 1000 * 60 * 60 * 72).toISOString();
    const d5 = new Date(now.getTime() - 1000 * 60 * 60 * 96).toISOString();

    return [
      {
        id: 'sample_img_1',
        title: 'Cyberpunk Skyline Graphic',
        filename: 'cyberpunk_city_skyline.svg',
        type: 'image',
        mimeType: 'image/svg+xml',
        size: 2840,
        date: d1,
        category: 'Design & Media',
        author: 'Elena Rostova',
        status: 'published',
        rating: 5,
        starred: true,
        tags: ['vector', 'design', 'cyberpunk', 'featured', 'hero'],
        description: 'Modern neo-noir neon city isometric illustration crafted with sleek vector curves and vibrant gradients.',
        customProps: [
          { key: 'Resolution', value: 'Scalable Vector' },
          { key: 'Color Space', value: 'sRGB / Display P3' },
          { key: 'License', value: 'Creative Commons CC-BY 4.0' }
        ],
        dataUrl: `data:image/svg+xml;utf8,${encodeURIComponent(`
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="100%" height="100%">
            <defs>
              <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#090d16" />
                <stop offset="50%" stop-color="#14182b" />
                <stop offset="100%" stop-color="#2d124d" />
              </linearGradient>
              <linearGradient id="glow" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#00f0ff" />
                <stop offset="100%" stop-color="#ff007f" />
              </linearGradient>
            </defs>
            <rect width="800" height="500" fill="url(#bg)"/>
            <circle cx="400" cy="220" r="140" fill="#ff007f" opacity="0.35"/>
            <circle cx="400" cy="220" r="100" fill="#facc15" opacity="0.8"/>
            <!-- Skyline silhouettes -->
            <polygon points="40,500 40,280 90,280 90,500" fill="#0b0f19"/>
            <polygon points="100,500 100,200 160,200 160,500" fill="#111625"/>
            <polygon points="180,500 180,140 230,140 230,500" fill="#0f1523"/>
            <polygon points="240,500 240,240 310,240 310,500" fill="#141c30"/>
            <polygon points="320,500 320,100 380,80 440,100 440,500" fill="#18233c"/>
            <polygon points="460,500 460,180 520,180 520,500" fill="#121828"/>
            <polygon points="530,500 530,220 590,220 590,500" fill="#151e33"/>
            <polygon points="610,500 610,130 670,130 670,500" fill="#0d1320"/>
            <polygon points="690,500 690,270 760,270 760,500" fill="#090d16"/>
            <!-- Grid lines -->
            <line x1="0" y1="420" x2="800" y2="420" stroke="#00f0ff" stroke-width="2" opacity="0.8"/>
            <line x1="0" y1="450" x2="800" y2="450" stroke="#ff007f" stroke-width="2" opacity="0.6"/>
            <text x="400" y="470" font-family="sans-serif" font-weight="800" font-size="24" fill="#ffffff" text-anchor="middle" letter-spacing="4">NEXUS CITY • 2026</text>
          </svg>
        `)}`
      },
      {
        id: 'sample_audio_1',
        title: 'Cosmic Drift Ambient Synth Track',
        filename: 'cosmic_drift_ambient.wav',
        type: 'audio',
        mimeType: 'audio/wav',
        size: 110294,
        date: d2,
        category: 'Audio & Music',
        author: 'Kaelen Vance',
        status: 'published',
        rating: 4,
        starred: true,
        tags: ['audio', 'synth', 'ambient', 'soundtrack', 'master'],
        description: 'Atmospheric polyphonic synthesizer chord melody generated for ambient background playback and visualizer testing.',
        customProps: [
          { key: 'BPM', value: '118' },
          { key: 'Key', value: 'A Major' },
          { key: 'Audio Channels', value: '1 (Mono)' },
          { key: 'Sample Rate', value: '22,050 Hz' }
        ],
        dataUrl: generateSampleAudioDataUrl()
      },
      {
        id: 'sample_doc_1',
        title: 'Strategic System Architecture Blueprint',
        filename: 'system_architecture_spec.md',
        type: 'document',
        mimeType: 'text/markdown',
        size: 4210,
        date: d3,
        category: 'Engineering & Code',
        author: 'Marcus Chen',
        status: 'published',
        rating: 5,
        starred: false,
        tags: ['docs', 'architecture', 'spec', 'system-design'],
        description: 'Comprehensive specification document outlining distributed caching, SQLite database persistence, metadata indexing, and media pipelines.',
        customProps: [
          { key: 'Version', value: '2.5.0-RC1' },
          { key: 'Security Review', value: 'Approved' },
          { key: 'Target Release', value: 'Q4 2026' }
        ],
        textContent: `# Strategic System Architecture Blueprint

## Executive Overview
Nexus CMS provides a zero-latency, local-first content repository capable of handling diverse media formats, extensive metadata attributes, and responsive playback backed by SQLite.

### Core Modules
1. **Persistent SQLite Database Engine**: ACID-compliant relational transactions with WAL mode, indexing, and REST APIs.
2. **Dynamic Media Engine**: Custom playback controllers for video, frequency visualizer for audio, and interactive canvas zoom/pan for images.
3. **Omnisearch & Filter Pipeline**: Multi-dimensional token matching across display names, extensions, tag collections, and custom key-value pairs.

\`\`\`javascript
// Sample Storage Pipeline Execution
async function syncContent(item) {
  const record = await db.put({
    ...item,
    updatedAt: new Date().toISOString()
  });
  return record;
}
\`\`\`

### Performance Metrics
- **Search Latency**: < 4ms for 10,000 indexed records
- **Rendering Throughput**: 60fps layout transitions
- **Memory Footprint**: Minimal overhead with on-demand blob resolution
`
      },
      {
        id: 'sample_code_1',
        title: 'Audio Visualizer & DSP Pipeline',
        filename: 'dsp_visualizer_pipeline.js',
        type: 'code',
        mimeType: 'application/javascript',
        size: 3120,
        date: d4,
        category: 'Engineering & Code',
        author: 'Dev Core Team',
        status: 'review',
        rating: 4,
        starred: false,
        tags: ['code', 'webaudio', 'canvas', 'dsp', 'javascript'],
        description: 'Client-side Web Audio API frequency domain analyzer with FFT computation and smoothing canvas rendering.',
        customProps: [
          { key: 'Language', value: 'JavaScript (ES2024)' },
          { key: 'Dependencies', value: 'Native Web APIs (Zero Deps)' }
        ],
        textContent: `// Web Audio API Frequency Spectrum Visualizer
class SpectrumVisualizer {
  constructor(canvasElement, audioElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.audio = audioElement;
    this.audioCtx = null;
    this.analyser = null;
    this.source = null;
  }

  setup() {
    if (this.audioCtx) return;
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 128;
    this.source = this.audioCtx.createMediaElementSource(this.audio);
    this.source.connect(this.analyser);
    this.analyser.connect(this.audioCtx.destination);
    this.render();
  }

  render() {
    requestAnimationFrame(() => this.render());
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);

    const { width, height } = this.canvas;
    this.ctx.clearRect(0, 0, width, height);

    const barWidth = (width / bufferLength) * 2.2;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const barHeight = (dataArray[i] / 255) * height;
      const gradient = this.ctx.createLinearGradient(0, height, 0, 0);
      gradient.addColorStop(0, '#3b82f6');
      gradient.addColorStop(1, '#ec4899');

      this.ctx.fillStyle = gradient;
      this.ctx.fillRect(x, height - barHeight, barWidth, barHeight);
      x += barWidth + 2;
    }
  }
}`
      },
      {
        id: 'sample_video_1',
        title: 'Kinetic Particle Motion Demo',
        filename: 'particle_kinetic_flow.mp4',
        type: 'video',
        mimeType: 'video/mp4',
        size: 524000,
        date: d5,
        category: 'Video Production',
        author: 'Motion Lab',
        status: 'draft',
        rating: 3,
        starred: false,
        tags: ['video', 'motion', 'render', 'demo'],
        description: 'Simulated 60fps procedural particle flow loop with dynamic lighting and camera pans.',
        customProps: [
          { key: 'Framerate', value: '60 FPS' },
          { key: 'Codec', value: 'H.264 / AAC' },
          { key: 'Aspect Ratio', value: '16:9' }
        ],
        // Sample SVG poster / fallback video player simulation
        dataUrl: `data:image/svg+xml;utf8,${encodeURIComponent(`
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450" width="100%" height="100%">
            <rect width="800" height="450" fill="#0f172a"/>
            <circle cx="400" cy="225" r="90" fill="#3b82f6" opacity="0.2"/>
            <circle cx="400" cy="225" r="60" fill="#ec4899" opacity="0.4"/>
            <polygon points="380,195 440,225 380,255" fill="#ffffff"/>
            <text x="400" y="340" fill="#94a3b8" font-family="sans-serif" font-size="16" text-anchor="middle" font-weight="600">Sample Video Stream Preview</text>
          </svg>
        `)}`
      }
    ];
  }

  // ==========================================================================
  // 5. App Initialization & UI Setup
  // ==========================================================================
  let connectionRetryInterval = null;

  async function connectAndFetchItems() {
    const connected = await db.init();
    if (connected) {
      if (connectionRetryInterval) {
        clearInterval(connectionRetryInterval);
        connectionRetryInterval = null;
      }
      const stored = await db.getAll();
      if (!stored || stored.length === 0) {
        const samples = getSampleDataset();
        await db.putMany(samples);
        state.items = await db.getAll();
      } else {
        state.items = stored;
      }
      renderApp();
      return true;
    } else {
      state.items = [];
      renderApp();
      return false;
    }
  }

  function startDatabaseAutoReconnect() {
    if (connectionRetryInterval) return;
    connectionRetryInterval = setInterval(async () => {
      const connected = await db.checkHealth();
      if (connected) {
        const ok = await connectAndFetchItems();
        if (ok) {
          showToast(`Database connected successfully (${db.dbName})`, 'success');
        }
      }
    }, 2000);
  }

  async function initApp() {
    applyTheme(state.theme);
    bindGlobalEvents();
    bindUploadModalEvents();
    bindEditModalEvents();
    bindViewerEvents();
    bindBatchModalEvents();
    bindDeleteModalEvents();
    bindShortcutsModalEvents();

    const dbBadge = document.getElementById('dbStatusBadge');
    if (dbBadge) {
      dbBadge.addEventListener('click', async () => {
        showToast('Checking database server connection...', 'info');
        const isOk = await db.checkHealth();
        if (isOk) {
          await connectAndFetchItems();
          showToast(`Connected to Supabase (${db.dbName})`, 'success');
        } else {
          showToast(db.connectionError || 'Supabase is unreachable. Check supabase-config.js and your project status.', 'error');
        }
      });
    }

    const connected = await connectAndFetchItems();
    if (!connected) {
      showToast('Connecting to Supabase...', 'info');
      startDatabaseAutoReconnect();
    } else {
      setInterval(async () => {
        const stillOk = await db.checkHealth();
        renderSidebarCounts();
        if (!stillOk && !connectionRetryInterval) {
          startDatabaseAutoReconnect();
        }
      }, 10000);
    }

    // Check URL query parameter or hash for direct deep-link to item
    handleUrlRouting();
    window.addEventListener('popstate', () => handleUrlRouting());
    window.addEventListener('hashchange', () => handleUrlRouting());
  }

  function handleUrlRouting() {
    if (typeof window === 'undefined' || !window.location) return;
    const url = new URL(window.location.href);
    let targetId = url.searchParams.get('item') || url.searchParams.get('id');

    if (!targetId && window.location.hash) {
      const hash = window.location.hash.replace(/^#/, '');
      if (hash.startsWith('item=')) {
        targetId = hash.split('item=')[1];
      } else if (hash.startsWith('id=')) {
        targetId = hash.split('id=')[1];
      } else if (hash.length > 2) {
        targetId = hash;
      }
    }

    if (targetId) {
      const decoded = decodeURIComponent(targetId);
      const list = getFilteredAndSortedItems();
      const itemIdx = list.findIndex((i) => i.id === decoded);
      if (itemIdx !== -1) {
        openViewerModal(itemIdx);
      } else {
        // Find in full items list
        const directIdx = state.items.findIndex((i) => i.id === decoded);
        if (directIdx !== -1) {
          state.activeViewerList = [state.items[directIdx]];
          openViewerModal(0);
        }
      }
    }
  }

  // ==========================================================================
  // 6. Rendering Logic: Grid, List, Compact, Sidebar, Tag Cloud, Stats
  // ==========================================================================
  function getFilteredAndSortedItems() {
    let list = [...state.items];

    // 1. Type filter
    if (state.filter.type !== 'all') {
      if (state.filter.type === 'starred') {
        list = list.filter((item) => item.starred);
      } else {
        list = list.filter((item) => item.type === state.filter.type);
      }
    }

    // 2. Status filter
    if (state.filter.status !== 'all') {
      list = list.filter((item) => (item.status || 'published').toLowerCase() === state.filter.status);
    }

    // 3. Search query
    const q = state.filter.search.trim().toLowerCase();
    if (q) {
      list = list.filter((item) => {
        const nameMatch = (item.title || '').toLowerCase().includes(q);
        const fileMatch = (item.filename || '').toLowerCase().includes(q);
        const authorMatch = (item.author || '').toLowerCase().includes(q);
        const descMatch = (item.description || '').toLowerCase().includes(q);
        const catMatch = (item.category || '').toLowerCase().includes(q);
        const tagMatch = (item.tags || []).some((t) => t.toLowerCase().includes(q));
        const propsMatch = (item.customProps || []).some(
          (p) => (p.key || '').toLowerCase().includes(q) || (p.value || '').toLowerCase().includes(q)
        );
        return nameMatch || fileMatch || authorMatch || descMatch || catMatch || tagMatch || propsMatch;
      });
    }

    // 4. Tags filter
    if (state.filter.tags.size > 0) {
      list = list.filter((item) => {
        const itemTags = new Set((item.tags || []).map((t) => t.toLowerCase()));
        for (const tag of state.filter.tags) {
          if (!itemTags.has(tag.toLowerCase())) return false;
        }
        return true;
      });
    }

    // 5. Date filter preset
    if (state.filter.datePreset !== 'all') {
      const now = Date.now();
      const oneDay = 24 * 60 * 60 * 1000;
      list = list.filter((item) => {
        const itemTime = new Date(item.date || item.createdAt || 0).getTime();
        const diff = now - itemTime;
        if (state.filter.datePreset === 'today') return diff <= oneDay;
        if (state.filter.datePreset === 'week') return diff <= oneDay * 7;
        if (state.filter.datePreset === 'month') return diff <= oneDay * 30;
        if (state.filter.datePreset === 'year') return diff <= oneDay * 365;
        return true;
      });
    }

    // 6. Size filter preset
    if (state.filter.sizePreset !== 'all') {
      list = list.filter((item) => {
        const s = item.size || 0;
        if (state.filter.sizePreset === 'small') return s < 1024 * 1024;
        if (state.filter.sizePreset === 'medium') return s >= 1024 * 1024 && s <= 10 * 1024 * 1024;
        if (state.filter.sizePreset === 'large') return s > 10 * 1024 * 1024;
        return true;
      });
    }

    // 7. Sort list
    list.sort((a, b) => {
      switch (state.sortBy) {
        case 'name-asc':
          return (a.title || '').localeCompare(b.title || '');
        case 'name-desc':
          return (b.title || '').localeCompare(a.title || '');
        case 'filename-asc':
          return (a.filename || '').localeCompare(b.filename || '');
        case 'filename-desc':
          return (b.filename || '').localeCompare(a.filename || '');
        case 'size-asc':
          return (a.size || 0) - (b.size || 0);
        case 'size-desc':
          return (b.size || 0) - (a.size || 0);
        case 'date-asc':
          return new Date(a.date || 0) - new Date(b.date || 0);
        case 'date-desc':
          return new Date(b.date || 0) - new Date(a.date || 0);
        case 'type-asc':
          return (a.type || '').localeCompare(b.type || '') || (a.title || '').localeCompare(b.title || '');
        case 'rating-desc':
          return (b.rating || 0) - (a.rating || 0);
        default:
          return 0;
      }
    });

    return list;
  }

  function renderApp() {
    renderSidebarCounts();
    renderTagCloud();
    renderActiveFilterRibbon();
    renderContentItems();
    updateBatchActionBar();
  }

  function renderSidebarCounts() {
    const totalBytes = state.items.reduce((acc, item) => acc + (item.size || 0), 0);
    const maxStorage = 500 * 1024 * 1024; // 500MB
    const pct = Math.min(100, Math.round((totalBytes / maxStorage) * 100));

    document.getElementById('storageSummaryText').textContent = `${formatBytes(totalBytes)} / 500 MB`;
    document.getElementById('storagePctText').textContent = `${pct}%`;
    document.getElementById('storageProgressBar').style.width = `${pct}%`;
    document.getElementById('totalItemsCountBadge').textContent = `${state.items.length} files indexed`;

    // Database Status Indicator
    const dbStatusBadge = document.getElementById('dbStatusBadge');
    const dbStatusText = document.getElementById('dbStatusText');
    if (dbStatusBadge && dbStatusText) {
      if (db.isConnected) {
        dbStatusBadge.className = 'db-status-badge';
        dbStatusText.textContent = `Supabase: ${state.items.length} records`;
      } else {
        dbStatusBadge.className = 'db-status-badge offline';
        dbStatusText.textContent = `Supabase: Disconnected (${db.connectionError || 'check configuration'})`;
      }
    }

    // Counts by type
    document.getElementById('countAll').textContent = state.items.length;
    document.getElementById('countImage').textContent = state.items.filter((i) => i.type === 'image').length;
    document.getElementById('countVideo').textContent = state.items.filter((i) => i.type === 'video').length;
    document.getElementById('countAudio').textContent = state.items.filter((i) => i.type === 'audio').length;
    document.getElementById('countDoc').textContent = state.items.filter((i) => i.type === 'document').length;
    document.getElementById('countCode').textContent = state.items.filter((i) => i.type === 'code').length;
    document.getElementById('countStarred').textContent = state.items.filter((i) => i.starred).length;
  }

  function renderTagCloud() {
    const tagCounts = {};
    state.items.forEach((item) => {
      (item.tags || []).forEach((tag) => {
        const clean = tag.trim().toLowerCase();
        if (clean) tagCounts[clean] = (tagCounts[clean] || 0) + 1;
      });
    });

    const container = document.getElementById('tagCloudContainer');
    const resetBtn = document.getElementById('resetTagFilterBtn');
    const tags = Object.keys(tagCounts).sort();

    if (tags.length === 0) {
      container.innerHTML = '<span class="empty-tags-text">No tags available</span>';
      resetBtn.style.display = 'none';
      return;
    }

    resetBtn.style.display = state.filter.tags.size > 0 ? 'inline' : 'none';

    container.innerHTML = tags
      .map((tag) => {
        const isActive = state.filter.tags.has(tag);
        return `<button class="tag-badge ${isActive ? 'active' : ''}" data-tag-name="${escapeHtml(tag)}">
          <span>#${escapeHtml(tag)}</span>
          <span class="tag-count">${tagCounts[tag]}</span>
        </button>`;
      })
      .join('');
  }

  function renderActiveFilterRibbon() {
    const ribbon = document.getElementById('activeFilterRibbon');
    const chipsContainer = document.getElementById('activeFilterChips');
    const chips = [];

    if (state.filter.search) {
      chips.push({ label: `Search: "${state.filter.search}"`, clear: () => (state.filter.search = '') });
    }
    if (state.filter.type !== 'all') {
      chips.push({ label: `Type: ${state.filter.type}`, clear: () => (state.filter.type = 'all') });
    }
    if (state.filter.status !== 'all') {
      chips.push({ label: `Status: ${state.filter.status}`, clear: () => (state.filter.status = 'all') });
    }
    state.filter.tags.forEach((t) => {
      chips.push({ label: `Tag: #${t}`, clear: () => state.filter.tags.delete(t) });
    });
    if (state.filter.datePreset !== 'all') {
      chips.push({ label: `Date: ${state.filter.datePreset}`, clear: () => (state.filter.datePreset = 'all') });
    }
    if (state.filter.sizePreset !== 'all') {
      chips.push({ label: `Size: ${state.filter.sizePreset}`, clear: () => (state.filter.sizePreset = 'all') });
    }

    if (chips.length > 0) {
      ribbon.style.display = 'flex';
      chipsContainer.innerHTML = chips
        .map(
          (c, idx) =>
            `<span class="filter-pill">${escapeHtml(c.label)} <button class="remove-filter-btn" data-chip-idx="${idx}">&times;</button></span>`
        )
        .join('');

      chipsContainer.querySelectorAll('.remove-filter-btn').forEach((btn) => {
        btn.onclick = (e) => {
          e.stopPropagation();
          const idx = parseInt(btn.dataset.chipIdx, 10);
          if (chips[idx]) {
            chips[idx].clear();
            syncFilterInputs();
            renderApp();
          }
        };
      });
    } else {
      ribbon.style.display = 'none';
    }
  }

  function syncFilterInputs() {
    document.getElementById('globalSearchInput').value = state.filter.search;
    document.getElementById('filterDatePreset').value = state.filter.datePreset;
    document.getElementById('filterSizePreset').value = state.filter.sizePreset;

    // Type nav active state
    document.querySelectorAll('#typeNavList .nav-item').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.typeFilter === state.filter.type);
    });

    // Status chips active state
    document.querySelectorAll('#statusFilterGroup .status-chip').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.status === state.filter.status);
    });
  }

  function renderContentItems() {
    const list = getFilteredAndSortedItems();
    state.activeViewerList = list;

    const container = document.getElementById('itemsViewContainer');
    const emptyState = document.getElementById('emptyStateContainer');
    const resultsCountBadge = document.getElementById('resultsCountBadge');
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');

    resultsCountBadge.textContent = `${list.length} item${list.length === 1 ? '' : 's'}`;

    // Update current heading
    let heading = 'All Content';
    if (state.filter.type === 'starred') heading = 'Starred & Favorites';
    else if (state.filter.type !== 'all') heading = state.filter.type.charAt(0).toUpperCase() + state.filter.type.slice(1);
    document.getElementById('currentViewHeading').textContent = heading;

    // Update select-all checkbox state
    const allSelected = list.length > 0 && list.every((item) => state.selectedIds.has(item.id));
    const someSelected = list.some((item) => state.selectedIds.has(item.id));
    selectAllCheckbox.checked = allSelected;
    selectAllCheckbox.indeterminate = !allSelected && someSelected;

    if (list.length === 0) {
      container.style.display = 'none';
      emptyState.style.display = 'flex';
      return;
    }

    container.style.display = '';
    emptyState.style.display = 'none';
    container.className = `items-view-container ${state.viewMode}-view`;

    if (state.viewMode === 'grid') {
      container.innerHTML = list.map((item, idx) => renderGridCardHtml(item, idx)).join('');
    } else if (state.viewMode === 'list') {
      container.innerHTML = list.map((item, idx) => renderListRowHtml(item, idx)).join('');
    } else {
      container.innerHTML = list.map((item, idx) => renderCompactCardHtml(item, idx)).join('');
    }

    attachItemEventListeners(container, list);
  }

  function getMediaThumbnailMarkup(item) {
    if (item.type === 'image' && item.dataUrl) {
      return `<img src="${item.dataUrl}" alt="${escapeHtml(item.title)}" class="card-thumb-image" loading="lazy">`;
    }
    if (item.type === 'video') {
      return `
        <div class="card-thumb-icon-box" style="color: var(--color-video)">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
          <span class="card-thumb-ext-badge">${getFileExtension(item.filename)}</span>
        </div>
        <div class="card-play-overlay-btn" title="Play Video">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
        </div>
      `;
    }
    if (item.type === 'audio') {
      return `
        <div class="card-thumb-icon-box" style="color: var(--color-audio)">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
          <span class="card-thumb-ext-badge">${getFileExtension(item.filename)}</span>
        </div>
        <div class="card-play-overlay-btn" title="Play Audio">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
        </div>
      `;
    }
    if (item.type === 'code') {
      return `
        <div class="card-thumb-icon-box" style="color: var(--color-code)">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
          <span class="card-thumb-ext-badge">${getFileExtension(item.filename)}</span>
        </div>
      `;
    }
    if (item.type === 'document') {
      return `
        <div class="card-thumb-icon-box" style="color: var(--color-doc)">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
          <span class="card-thumb-ext-badge">${getFileExtension(item.filename)}</span>
        </div>
      `;
    }
    return `
      <div class="card-thumb-icon-box" style="color: var(--color-other)">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
        <span class="card-thumb-ext-badge">${getFileExtension(item.filename)}</span>
      </div>
    `;
  }

  function renderGridCardHtml(item, idx) {
    const isSelected = state.selectedIds.has(item.id);
    const tagsHtml = (item.tags || [])
      .slice(0, 3)
      .map((t) => `<span class="card-tag-pill">#${escapeHtml(t)}</span>`)
      .join('');
    const statusClass = `status-${(item.status || 'published').toLowerCase()}`;

    return `
      <div class="file-card ${isSelected ? 'selected' : ''}" data-id="${item.id}" data-idx="${idx}">
        <div class="card-thumb-wrapper">
          <div class="card-overlay-top">
            <label class="card-check-box checkbox-wrapper" onclick="event.stopPropagation();">
              <input type="checkbox" class="item-select-chk" data-id="${item.id}" ${isSelected ? 'checked' : ''}>
              <span class="custom-checkbox"></span>
            </label>
            <button class="card-star-btn ${item.starred ? 'starred' : ''}" data-action="toggle-star" data-id="${item.id}" title="Toggle Star">
              ★
            </button>
          </div>
          ${getMediaThumbnailMarkup(item)}
          <span class="card-type-chip">${escapeHtml(item.type)}</span>
        </div>

        <div class="card-body">
          <div class="card-title-row">
            <h4 class="card-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</h4>
          </div>
          <div class="card-filename" title="${escapeHtml(item.filename)}">${escapeHtml(item.filename)}</div>

          <div class="card-meta-row">
            <span>${formatBytes(item.size)}</span>
            <span class="card-status-badge ${statusClass}">${escapeHtml(item.status || 'published')}</span>
          </div>

          <div class="card-meta-row">
            <span>${formatDateTime(item.date)}</span>
            <span>${item.rating ? '★ ' + item.rating : ''}</span>
          </div>

          ${tagsHtml ? `<div class="card-tags-list">${tagsHtml}</div>` : ''}
        </div>

        <div class="card-footer" onclick="event.stopPropagation();">
          <span class="card-filename" style="max-width: 120px;">${escapeHtml(item.category || 'General')}</span>
          <div class="card-footer-actions">
            <button class="card-act-btn" data-action="view" data-id="${item.id}" data-idx="${idx}" title="Open / Play Media">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            </button>
            <button class="card-act-btn" data-action="copy-link" data-id="${item.id}" title="Copy Direct URL Link">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
            </button>
            <button class="card-act-btn" data-action="edit" data-id="${item.id}" title="Edit Properties">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
            <button class="card-act-btn" data-action="download" data-id="${item.id}" title="Download File">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            </button>
            <button class="card-act-btn delete-act" data-action="delete" data-id="${item.id}" title="Delete File">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function renderListRowHtml(item, idx) {
    const isSelected = state.selectedIds.has(item.id);
    const tagsHtml = (item.tags || [])
      .map((t) => `<span class="card-tag-pill">#${escapeHtml(t)}</span>`)
      .join('');

    return `
      <div class="list-item-row ${isSelected ? 'selected' : ''}" data-id="${item.id}" data-idx="${idx}">
        <label class="checkbox-wrapper" onclick="event.stopPropagation();">
          <input type="checkbox" class="item-select-chk" data-id="${item.id}" ${isSelected ? 'checked' : ''}>
          <span class="custom-checkbox"></span>
        </label>

        <div class="list-thumb-box">
          ${
            item.type === 'image' && item.dataUrl
              ? `<img src="${item.dataUrl}" class="list-thumb-img" alt="">`
              : `<span class="card-thumb-ext-badge" style="font-size:0.6rem;">${getFileExtension(item.filename)}</span>`
          }
        </div>

        <div class="list-title-col">
          <span class="list-title">${escapeHtml(item.title)}</span>
          <span class="list-filename">${escapeHtml(item.filename)}</span>
        </div>

        <div class="list-tags-col">${tagsHtml}</div>
        <div class="list-size-col">${formatBytes(item.size)}</div>
        <div class="list-date-col">${formatDateTime(item.date)}</div>

        <div class="list-actions-col" onclick="event.stopPropagation();">
          <button class="card-star-btn ${item.starred ? 'starred' : ''}" data-action="toggle-star" data-id="${item.id}">★</button>
          <button class="card-act-btn" data-action="view" data-id="${item.id}" data-idx="${idx}" title="Open / Play">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
          </button>
          <button class="card-act-btn" data-action="copy-link" data-id="${item.id}" title="Copy Direct URL Link">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
          </button>
          <button class="card-act-btn" data-action="edit" data-id="${item.id}" title="Edit">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
          <button class="card-act-btn delete-act" data-action="delete" data-id="${item.id}" title="Delete">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path></svg>
          </button>
        </div>
      </div>
    `;
  }

  function renderCompactCardHtml(item, idx) {
    const isSelected = state.selectedIds.has(item.id);
    return `
      <div class="compact-card ${isSelected ? 'selected' : ''}" data-id="${item.id}" data-idx="${idx}">
        <label class="checkbox-wrapper" onclick="event.stopPropagation();">
          <input type="checkbox" class="item-select-chk" data-id="${item.id}" ${isSelected ? 'checked' : ''}>
          <span class="custom-checkbox"></span>
        </label>
        <div class="compact-icon">
          <span class="card-thumb-ext-badge" style="font-size:0.6rem;">${getFileExtension(item.filename)}</span>
        </div>
        <div class="compact-info">
          <span class="compact-title">${escapeHtml(item.title)}</span>
          <span class="compact-meta">${formatBytes(item.size)} • ${escapeHtml(item.category || 'General')}</span>
        </div>
      </div>
    `;
  }

  function attachItemEventListeners(container, list) {
    // Click on item opens viewer
    container.querySelectorAll('.file-card, .list-item-row, .compact-card').forEach((el) => {
      el.addEventListener('click', (e) => {
        const id = el.dataset.id;
        const itemIdx = list.findIndex((i) => i.id === id);
        if (itemIdx !== -1) {
          openViewerModal(itemIdx);
        }
      });
    });

    // Checkbox toggles
    container.querySelectorAll('.item-select-chk').forEach((chk) => {
      chk.addEventListener('change', (e) => {
        const id = chk.dataset.id;
        if (chk.checked) state.selectedIds.add(id);
        else state.selectedIds.delete(id);
        renderApp();
      });
    });

    // Action buttons
    container.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        const item = state.items.find((i) => i.id === id);
        if (!item) return;

        if (action === 'toggle-star') {
          item.starred = !item.starred;
          db.put(item).then(() => {
            renderApp();
            showToast(item.starred ? 'Starred file' : 'Unstarred file', 'info');
          });
        } else if (action === 'view') {
          const itemIdx = list.findIndex((i) => i.id === id);
          openViewerModal(itemIdx !== -1 ? itemIdx : 0);
        } else if (action === 'edit') {
          openEditModal(item);
        } else if (action === 'download') {
          downloadFileItem(item);
        } else if (action === 'copy-link') {
          copyItemDirectUrl(item);
        } else if (action === 'delete') {
          openDeleteConfirmModal([item]);
        }
      });
    });
  }

  function updateBatchActionBar() {
    const bar = document.getElementById('batchActionBar');
    const countText = document.getElementById('batchSelectionCount');

    if (state.selectedIds.size > 0) {
      bar.style.display = 'flex';
      countText.textContent = `${state.selectedIds.size} selected`;
    } else {
      bar.style.display = 'none';
    }
  }

  // ==========================================================================
  // 7. Global Navigation, Search, View Mode & Theme Handlers
  // ==========================================================================
  function bindGlobalEvents() {
    // Sidebar Navigation filter by media type
    document.querySelectorAll('#typeNavList .nav-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#typeNavList .nav-item').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        state.filter.type = btn.dataset.typeFilter;
        renderApp();
      });
    });

    // Status chip filters
    document.querySelectorAll('#statusFilterGroup .status-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#statusFilterGroup .status-chip').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        state.filter.status = btn.dataset.status;
        renderApp();
      });
    });

    // Tag cloud click
    document.getElementById('tagCloudContainer').addEventListener('click', (e) => {
      const badge = e.target.closest('.tag-badge');
      if (!badge) return;
      const tag = badge.dataset.tagName;
      if (state.filter.tags.has(tag)) {
        state.filter.tags.delete(tag);
      } else {
        state.filter.tags.add(tag);
      }
      renderApp();
    });

    // Reset Tag filters
    document.getElementById('resetTagFilterBtn').addEventListener('click', () => {
      state.filter.tags.clear();
      renderApp();
    });

    // Date & Size Presets
    document.getElementById('filterDatePreset').addEventListener('change', (e) => {
      state.filter.datePreset = e.target.value;
      renderApp();
    });

    document.getElementById('filterSizePreset').addEventListener('change', (e) => {
      state.filter.sizePreset = e.target.value;
      renderApp();
    });

    // Global Omnisearch
    const searchInput = document.getElementById('globalSearchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');

    searchInput.addEventListener('input', (e) => {
      state.filter.search = e.target.value;
      clearSearchBtn.style.display = e.target.value ? 'flex' : 'none';
      renderApp();
    });

    clearSearchBtn.addEventListener('click', () => {
      searchInput.value = '';
      state.filter.search = '';
      clearSearchBtn.style.display = 'none';
      renderApp();
    });

    // Clear All Filters Button in ribbon
    document.getElementById('clearAllFiltersBtn').addEventListener('click', () => {
      state.filter.search = '';
      state.filter.type = 'all';
      state.filter.status = 'all';
      state.filter.tags.clear();
      state.filter.datePreset = 'all';
      state.filter.sizePreset = 'all';
      syncFilterInputs();
      renderApp();
    });

    // Sort Selector
    document.getElementById('sortBySelect').addEventListener('change', (e) => {
      state.sortBy = e.target.value;
      renderApp();
    });

    // View Mode buttons
    const viewButtons = {
      grid: document.getElementById('viewGridBtn'),
      list: document.getElementById('viewListBtn'),
      compact: document.getElementById('viewCompactBtn')
    };

    Object.keys(viewButtons).forEach((mode) => {
      viewButtons[mode].addEventListener('click', () => {
        Object.values(viewButtons).forEach((b) => b.classList.remove('active'));
        viewButtons[mode].classList.add('active');
        state.viewMode = mode;
        localStorage.setItem('nexus_cms_view', mode);
        renderApp();
      });
    });

    // Apply saved view mode on load
    if (viewButtons[state.viewMode]) {
      Object.values(viewButtons).forEach((b) => b.classList.remove('active'));
      viewButtons[state.viewMode].classList.add('active');
    }

    // Theme Toggle
    document.getElementById('themeToggleBtn').addEventListener('click', () => {
      const nextTheme = state.theme === 'dark' ? 'light' : 'dark';
      applyTheme(nextTheme);
    });

    // Sidebar Mobile Toggle
    const sidebar = document.getElementById('appSidebar');
    document.getElementById('toggleSidebarBtn').addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });

    // Select All Checkbox in Toolbar
    document.getElementById('selectAllCheckbox').addEventListener('change', (e) => {
      const list = getFilteredAndSortedItems();
      if (e.target.checked) {
        list.forEach((item) => state.selectedIds.add(item.id));
      } else {
        list.forEach((item) => state.selectedIds.delete(item.id));
      }
      renderApp();
    });

    // Batch Action Bar Buttons
    document.getElementById('batchSelectAllBtn').addEventListener('click', () => {
      const list = getFilteredAndSortedItems();
      list.forEach((item) => state.selectedIds.add(item.id));
      renderApp();
    });

    document.getElementById('batchClearSelectBtn').addEventListener('click', () => {
      state.selectedIds.clear();
      renderApp();
    });

    document.getElementById('batchFavoriteBtn').addEventListener('click', async () => {
      const selected = state.items.filter((i) => state.selectedIds.has(i.id));
      const shouldStar = selected.some((i) => !i.starred);
      selected.forEach((i) => (i.starred = shouldStar));
      await db.putMany(selected);
      renderApp();
      showToast(shouldStar ? 'Starred selected items' : 'Unstarred selected items', 'info');
    });

    document.getElementById('batchTagBtn').addEventListener('click', () => {
      openBatchTagModal();
    });

    document.getElementById('batchDownloadBtn').addEventListener('click', () => {
      const selected = state.items.filter((i) => state.selectedIds.has(i.id));
      selected.forEach((item) => downloadFileItem(item));
      showToast(`Downloading ${selected.length} files...`, 'info');
    });

    document.getElementById('batchDeleteBtn').addEventListener('click', () => {
      const selected = state.items.filter((i) => state.selectedIds.has(i.id));
      openDeleteConfirmModal(selected);
    });

    // Force Save All to Database Button
    const saveDbBtn = document.getElementById('saveDbBtn');
    if (saveDbBtn) {
      saveDbBtn.addEventListener('click', async () => {
        saveDbBtn.disabled = true;
        try {
          await db.putMany(state.items);
          renderSidebarCounts();
          showToast(`Saved ${state.items.length} records to Supabase (${db.dbName})`, 'success');
        } catch (err) {
          showToast('Failed to save records to Supabase', 'danger');
        } finally {
          saveDbBtn.disabled = false;
        }
      });
    }

    // Clear All Entries in Database
    document.getElementById('clearAllEntriesBtn').addEventListener('click', () => {
      openDeleteConfirmModal(state.items, true);
    });

    // Export CMS JSON Database
    document.getElementById('exportDataBtn').addEventListener('click', () => {
      exportDatabase();
    });

    // Import CMS JSON Database
    document.getElementById('importDataFileInput').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) importDatabase(file);
    });

    // Reset / Reload Sample Data
    document.getElementById('loadSampleDataBtn').addEventListener('click', async () => {
      const samples = getSampleDataset();
      await db.putMany(samples);
      state.items = await db.getAll();
      renderApp();
      showToast('Loaded sample media library', 'success');
    });

    document.getElementById('emptyLoadSampleBtn').addEventListener('click', async () => {
      const samples = getSampleDataset();
      await db.putMany(samples);
      state.items = await db.getAll();
      renderApp();
      showToast('Loaded sample media library', 'success');
    });

    document.getElementById('emptyUploadBtn').addEventListener('click', () => {
      openUploadModal();
    });

    // Global Drag and Drop to Upload
    setupGlobalDragAndDrop();

    // Global Keyboard Shortcuts
    setupKeyboardShortcuts();

    // Generic Modal Close Triggers
    document.querySelectorAll('[data-close]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const modalId = btn.dataset.close;
        closeModal(modalId);
      });
    });

    document.querySelectorAll('.modal-backdrop').forEach((backdrop) => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          backdrop.classList.remove('open');
        }
      });
    });
  }

  function applyTheme(theme) {
    state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('nexus_cms_theme', theme);
  }

  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('open');
  }

  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('open');
  }

  // ==========================================================================
  // 8. Upload Modal & File Ingestion Pipeline
  // ==========================================================================
  function bindUploadModalEvents() {
    const openBtn = document.getElementById('openUploadModalBtn');
    const dropzone = document.getElementById('uploadDropzone');
    const fileInput = document.getElementById('filePickerInput');
    const changeFileBtn = document.getElementById('uploadChangeFileBtn');
    const setNowBtn = document.getElementById('uploadSetNowBtn');
    const tagInput = document.getElementById('uploadTagInputField');
    const addPropBtn = document.getElementById('uploadAddPropBtn');
    const saveBtn = document.getElementById('saveUploadBtn');

    openBtn.addEventListener('click', () => openUploadModal());

    dropzone.addEventListener('click', (e) => {
      if (e.target !== changeFileBtn && !changeFileBtn.contains(e.target)) {
        fileInput.click();
      }
    });

    changeFileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleFileSelectedForUpload(e.target.files[0]);
      }
    });

    // Dropzone drag-and-drop
    ['dragenter', 'dragover'].forEach((eventName) => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach((eventName) => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('dragover');
      });
    });

    dropzone.addEventListener('drop', (e) => {
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFileSelectedForUpload(e.dataTransfer.files[0]);
      }
    });

    // "Now" datetime shortcut
    setNowBtn.addEventListener('click', () => {
      document.getElementById('uploadDateTimeInput').value = formatDateInput(new Date());
    });

    // Star rating picker
    document.querySelectorAll('#uploadStarRating .star-btn').forEach((star) => {
      star.addEventListener('click', () => {
        const rating = parseInt(star.dataset.star, 10);
        setStarRatingUI('upload', rating);
      });
    });

    // Interactive Tag Pills
    tagInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const tag = tagInput.value.replace(/,/g, '').trim().toLowerCase();
        if (tag) {
          state.uploadTags.add(tag);
          tagInput.value = '';
          renderUploadTagPills();
        }
      }
    });

    // Quick tag suggestions
    document.querySelectorAll('.suggested-tags-row .sugg-tag-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tag = btn.dataset.tag.toLowerCase();
        state.uploadTags.add(tag);
        renderUploadTagPills();
      });
    });

    // Custom Key-Value props
    addPropBtn.addEventListener('click', () => {
      addCustomPropRow('uploadCustomPropsList', '', '');
    });

    // Save Upload button
    saveBtn.addEventListener('click', () => {
      saveUploadedContent();
    });
  }

  function openUploadModal() {
    state.pendingUploadFile = null;
    state.uploadTags.clear();
    document.getElementById('dropzonePrompt').style.display = 'block';
    document.getElementById('selectedFilePreview').style.display = 'none';
    document.getElementById('uploadMetadataForm').reset();
    document.getElementById('uploadDateTimeInput').value = formatDateInput(new Date());
    document.getElementById('uploadCustomPropsList').innerHTML = '';
    setStarRatingUI('upload', 0);
    renderUploadTagPills();
    openModal('uploadModal');
  }

  function handleFileSelectedForUpload(file) {
    state.pendingUploadFile = file;

    // Show preview box
    document.getElementById('dropzonePrompt').style.display = 'none';
    const preview = document.getElementById('selectedFilePreview');
    preview.style.display = 'flex';
    document.getElementById('uploadOriginalFilename').textContent = file.name;
    document.getElementById('uploadOriginalMeta').textContent = `${formatBytes(file.size)} • ${file.type || 'unknown type'}`;

    // Generate thumbnail
    const thumbBox = document.getElementById('uploadPreviewThumb');
    thumbBox.innerHTML = '';
    const fileType = detectFileType(file);

    if (fileType === 'image') {
      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      thumbBox.appendChild(img);
    } else {
      thumbBox.innerHTML = `<span class="card-thumb-ext-badge">${getFileExtension(file.name)}</span>`;
    }

    // Auto-fill Title and Filename if blank
    const titleInput = document.getElementById('uploadTitleInput');
    const filenameInput = document.getElementById('uploadFilenameInput');

    if (!titleInput.value) {
      const cleanTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      titleInput.value = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);
    }
    if (!filenameInput.value) {
      filenameInput.value = file.name;
    }

    // Auto-suggest category
    const catSelect = document.getElementById('uploadCategoryInput');
    if (fileType === 'image') catSelect.value = 'Design & Media';
    else if (fileType === 'video') catSelect.value = 'Video Production';
    else if (fileType === 'audio') catSelect.value = 'Audio & Music';
    else if (fileType === 'code') catSelect.value = 'Engineering & Code';
    else if (fileType === 'document') catSelect.value = 'Documents';
  }

  function renderUploadTagPills() {
    const list = document.getElementById('uploadTagsList');
    list.innerHTML = Array.from(state.uploadTags)
      .map(
        (t) =>
          `<span class="tag-pill-item">#${escapeHtml(t)} <button type="button" class="tag-remove-x" data-tag="${escapeHtml(t)}">&times;</button></span>`
      )
      .join('');

    list.querySelectorAll('.tag-remove-x').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.uploadTags.delete(btn.dataset.tag);
        renderUploadTagPills();
      });
    });
  }

  function setStarRatingUI(prefix, rating) {
    const container = document.getElementById(`${prefix}StarRating`);
    const valInput = document.getElementById(`${prefix}RatingValue`);
    const label = document.getElementById(`${prefix}StarLabel`);

    valInput.value = rating;
    container.querySelectorAll('.star-btn').forEach((btn) => {
      const star = parseInt(btn.dataset.star, 10);
      btn.classList.toggle('active', star <= rating);
    });

    const labels = ['Unrated', 'Poor (1)', 'Fair (2)', 'Good (3)', 'Great (4)', 'Exceptional (5)'];
    label.textContent = labels[rating] || 'Unrated';
  }

  function addCustomPropRow(containerId, key = '', value = '') {
    const container = document.getElementById(containerId);
    const row = document.createElement('div');
    row.className = 'custom-prop-row';
    row.innerHTML = `
      <input type="text" class="form-input prop-key" placeholder="Key (e.g. License)" value="${escapeHtml(key)}">
      <input type="text" class="form-input prop-val" placeholder="Value (e.g. MIT)" value="${escapeHtml(value)}">
      <button type="button" class="remove-prop-btn" title="Remove property">&times;</button>
    `;
    row.querySelector('.remove-prop-btn').addEventListener('click', () => row.remove());
    container.appendChild(row);
  }

  async function saveUploadedContent() {
    const titleInput = document.getElementById('uploadTitleInput');
    const filenameInput = document.getElementById('uploadFilenameInput');

    if (!titleInput.value.trim()) {
      titleInput.focus();
      showToast('Please enter a display title', 'danger');
      return;
    }
    if (!filenameInput.value.trim()) {
      filenameInput.focus();
      showToast('Please enter a filename', 'danger');
      return;
    }

    const file = state.pendingUploadFile;
    const itemType = file ? detectFileType(file) : detectFileType(filenameInput.value);
    const mimeType = file ? file.type || 'application/octet-stream' : 'application/octet-stream';
    const size = file ? file.size : 1024;

    // Collect custom properties
    const customProps = [];
    document.querySelectorAll('#uploadCustomPropsList .custom-prop-row').forEach((row) => {
      const k = row.querySelector('.prop-key').value.trim();
      const v = row.querySelector('.prop-val').value.trim();
      if (k) customProps.push({ key: k, value: v });
    });

    let dataUrl = null;
    let textContent = null;

    if (file) {
      if (itemType === 'code' || (itemType === 'document' && file.name.endsWith('.md')) || file.type.startsWith('text/')) {
        textContent = await file.text();
      }
      dataUrl = await readFileAsDataUrl(file);
    } else {
      // Created without file binary
      dataUrl = `data:text/plain;charset=utf-8,${encodeURIComponent('Empty content record created in Nexus CMS.')}`;
    }

    const newItem = {
      id: generateId(),
      title: titleInput.value.trim(),
      filename: filenameInput.value.trim(),
      type: itemType,
      mimeType: mimeType,
      size: size,
      date: document.getElementById('uploadDateTimeInput').value || new Date().toISOString(),
      category: document.getElementById('uploadCategoryInput').value,
      author: document.getElementById('uploadAuthorInput').value.trim() || 'Anonymous',
      status: document.getElementById('uploadStatusInput').value,
      rating: parseInt(document.getElementById('uploadRatingValue').value, 10) || 0,
      starred: false,
      tags: Array.from(state.uploadTags),
      description: document.getElementById('uploadDescriptionInput').value.trim(),
      customProps: customProps,
      dataUrl: dataUrl,
      textContent: textContent,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await db.put(newItem);
    state.items.unshift(newItem);
    closeModal('uploadModal');
    renderApp();
    showToast(`Uploaded "${newItem.title}" successfully`, 'success');
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  // ==========================================================================
  // 9. Edit Properties Modal & Live Mutation
  // ==========================================================================
  function bindEditModalEvents() {
    const setNowBtn = document.getElementById('editSetNowBtn');
    const tagInput = document.getElementById('editTagInputField');
    const addPropBtn = document.getElementById('editAddPropBtn');
    const saveBtn = document.getElementById('saveEditBtn');
    const deleteBtn = document.getElementById('editDeleteBtn');
    const replaceInput = document.getElementById('replaceFileInput');

    setNowBtn.addEventListener('click', () => {
      document.getElementById('editDateTimeInput').value = formatDateInput(new Date());
    });

    // Star rating
    document.querySelectorAll('#editStarRating .star-btn').forEach((star) => {
      star.addEventListener('click', () => {
        const rating = parseInt(star.dataset.star, 10);
        setStarRatingUI('edit', rating);
      });
    });

    // Tags
    tagInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const tag = tagInput.value.replace(/,/g, '').trim().toLowerCase();
        if (tag) {
          state.editTags.add(tag);
          tagInput.value = '';
          renderEditTagPills();
        }
      }
    });

    // Custom Props
    addPropBtn.addEventListener('click', () => {
      addCustomPropRow('editCustomPropsList', '', '');
    });

    // Replace File
    replaceInput.addEventListener('change', async (e) => {
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        const id = document.getElementById('editItemId').value;
        const item = state.items.find((i) => i.id === id);
        if (item) {
          item.size = file.size;
          item.mimeType = file.type || item.mimeType;
          item.dataUrl = await readFileAsDataUrl(file);
          if (file.type.startsWith('text/') || file.name.endsWith('.md') || file.name.endsWith('.js')) {
            item.textContent = await file.text();
          }
          document.getElementById('editItemSizeMeta').textContent = `${formatBytes(item.size)} • ${item.mimeType}`;
          showToast('File content replaced successfully', 'info');
        }
      }
    });

    // Save Edit
    saveBtn.addEventListener('click', () => {
      saveEditedContent();
    });

    // Delete file from Edit Modal
    deleteBtn.addEventListener('click', () => {
      const id = document.getElementById('editItemId').value;
      const item = state.items.find((i) => i.id === id);
      if (item) {
        closeModal('editModal');
        openDeleteConfirmModal([item]);
      }
    });
  }

  function openEditModal(item) {
    document.getElementById('editItemId').value = item.id;
    document.getElementById('editTitleInput').value = item.title || '';
    document.getElementById('editFilenameInput').value = item.filename || '';
    document.getElementById('editCategoryInput').value = item.category || 'General';
    document.getElementById('editDateTimeInput').value = item.date ? formatDateInput(new Date(item.date)) : formatDateInput();
    document.getElementById('editStatusInput').value = item.status || 'published';
    document.getElementById('editAuthorInput').value = item.author || '';
    document.getElementById('editDescriptionInput').value = item.description || '';

    document.getElementById('editItemTypeBadge').textContent = item.type.toUpperCase();
    document.getElementById('editItemSizeMeta').textContent = `${formatBytes(item.size)} • ${item.mimeType || 'unknown'}`;

    // Thumbnail in edit modal
    const thumbBox = document.getElementById('editItemThumb');
    thumbBox.innerHTML = '';
    if (item.type === 'image' && item.dataUrl) {
      thumbBox.innerHTML = `<img src="${item.dataUrl}" style="width:100%;height:100%;object-fit:cover;">`;
    } else {
      thumbBox.innerHTML = `<span class="card-thumb-ext-badge">${getFileExtension(item.filename)}</span>`;
    }

    setStarRatingUI('edit', item.rating || 0);

    // Tags
    state.editTags = new Set((item.tags || []).map((t) => t.toLowerCase()));
    renderEditTagPills();

    // Custom Props
    const propsContainer = document.getElementById('editCustomPropsList');
    propsContainer.innerHTML = '';
    (item.customProps || []).forEach((prop) => {
      addCustomPropRow('editCustomPropsList', prop.key, prop.value);
    });

    openModal('editModal');
  }

  function renderEditTagPills() {
    const list = document.getElementById('editTagsList');
    list.innerHTML = Array.from(state.editTags)
      .map(
        (t) =>
          `<span class="tag-pill-item">#${escapeHtml(t)} <button type="button" class="tag-remove-x" data-tag="${escapeHtml(t)}">&times;</button></span>`
      )
      .join('');

    list.querySelectorAll('.tag-remove-x').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.editTags.delete(btn.dataset.tag);
        renderEditTagPills();
      });
    });
  }

  async function saveEditedContent() {
    const id = document.getElementById('editItemId').value;
    const item = state.items.find((i) => i.id === id);
    if (!item) return;

    const titleInput = document.getElementById('editTitleInput');
    const filenameInput = document.getElementById('editFilenameInput');

    if (!titleInput.value.trim()) {
      titleInput.focus();
      showToast('Please enter a display title', 'danger');
      return;
    }
    if (!filenameInput.value.trim()) {
      filenameInput.focus();
      showToast('Please enter a filename', 'danger');
      return;
    }

    // Collect custom properties
    const customProps = [];
    document.querySelectorAll('#editCustomPropsList .custom-prop-row').forEach((row) => {
      const k = row.querySelector('.prop-key').value.trim();
      const v = row.querySelector('.prop-val').value.trim();
      if (k) customProps.push({ key: k, value: v });
    });

    item.title = titleInput.value.trim();
    item.filename = filenameInput.value.trim();
    item.category = document.getElementById('editCategoryInput').value;
    item.date = document.getElementById('editDateTimeInput').value || new Date().toISOString();
    item.status = document.getElementById('editStatusInput').value;
    item.author = document.getElementById('editAuthorInput').value.trim() || 'Anonymous';
    item.rating = parseInt(document.getElementById('editRatingValue').value, 10) || 0;
    item.tags = Array.from(state.editTags);
    item.description = document.getElementById('editDescriptionInput').value.trim();
    item.customProps = customProps;
    item.updatedAt = new Date().toISOString();

    await db.put(item);
    closeModal('editModal');
    renderApp();
    showToast(`Saved changes to "${item.title}"`, 'success');
  }

  // ==========================================================================
  // 10. Normal & Fullscreen Media Viewer / Player
  // ==========================================================================
  let audioContextInstance = null;
  let audioVisualizerAnimationId = null;

  function bindViewerEvents() {
    const closeBtn = document.getElementById('viewerCloseBtn');
    const prevBtn = document.getElementById('viewerPrevBtn');
    const nextBtn = document.getElementById('viewerNextBtn');
    const fullscreenBtn = document.getElementById('viewerFullscreenBtn');
    const toggleSidebarBtn = document.getElementById('viewerToggleSidebarBtn');
    const downloadBtn = document.getElementById('viewerDownloadBtn');
    const copyLinkBtn = document.getElementById('viewerCopyLinkBtn');
    const editPropsBtn = document.getElementById('viewerEditPropsBtn');

    closeBtn.addEventListener('click', () => closeViewerModal());

    prevBtn.addEventListener('click', () => {
      if (state.activeViewerIndex > 0) {
        openViewerModal(state.activeViewerIndex - 1);
      } else {
        openViewerModal(state.activeViewerList.length - 1);
      }
    });

    nextBtn.addEventListener('click', () => {
      if (state.activeViewerIndex < state.activeViewerList.length - 1) {
        openViewerModal(state.activeViewerIndex + 1);
      } else {
        openViewerModal(0);
      }
    });

    fullscreenBtn.addEventListener('click', () => {
      toggleViewerFullscreen();
    });

    toggleSidebarBtn.addEventListener('click', () => {
      document.getElementById('viewerSidebar').classList.toggle('collapsed');
    });

    downloadBtn.addEventListener('click', () => {
      const item = state.activeViewerList[state.activeViewerIndex];
      if (item) downloadFileItem(item);
    });

    if (copyLinkBtn) {
      copyLinkBtn.addEventListener('click', () => {
        const item = state.activeViewerList[state.activeViewerIndex];
        if (item) copyItemDirectUrl(item);
      });
    }

    editPropsBtn.addEventListener('click', () => {
      const item = state.activeViewerList[state.activeViewerIndex];
      if (item) {
        closeViewerModal();
        openEditModal(item);
      }
    });
  }

  function openViewerModal(index) {
    if (!state.activeViewerList || state.activeViewerList.length === 0) {
      state.activeViewerList = getFilteredAndSortedItems();
    }
    if (index < 0 || index >= state.activeViewerList.length) return;

    state.activeViewerIndex = index;
    const item = state.activeViewerList[index];

    // Header info
    document.getElementById('viewerTypeBadge').textContent = (item.type || 'FILE').toUpperCase();
    document.getElementById('viewerTitle').textContent = item.title;
    document.getElementById('viewerMeta').textContent = `${item.filename} • ${formatBytes(item.size)}`;

    // Populate Viewer Stage
    const stage = document.getElementById('viewerStage');
    cleanupViewerStage();

    renderViewerStageMedia(stage, item);
    renderViewerSidebarDetails(item);

    document.getElementById('mediaViewerModal').classList.add('open');

    // Update URL query parameter without reloading
    if (window.history && window.history.replaceState) {
      const url = new URL(window.location.href);
      url.searchParams.set('item', item.id);
      window.history.replaceState({ itemId: item.id }, '', url.toString());
    }
  }

  function closeViewerModal() {
    cleanupViewerStage();
    document.getElementById('mediaViewerModal').classList.remove('open');
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }

    // Clean up URL query parameter without reloading
    if (window.history && window.history.replaceState) {
      const url = new URL(window.location.href);
      if (url.searchParams.has('item')) {
        url.searchParams.delete('item');
        window.history.replaceState({}, '', url.toString());
      }
    }
  }

  function cleanupViewerStage() {
    if (audioVisualizerAnimationId) {
      cancelAnimationFrame(audioVisualizerAnimationId);
      audioVisualizerAnimationId = null;
    }
    const stage = document.getElementById('viewerStage');
    stage.innerHTML = '';
  }

  function toggleViewerFullscreen() {
    const modal = document.getElementById('mediaViewerModal');
    if (!document.fullscreenElement) {
      modal.requestFullscreen().catch((err) => {
        console.warn('Fullscreen request failed:', err);
      });
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  function renderViewerStageMedia(stage, item) {
    switch (item.type) {
      case 'image':
        renderImageViewer(stage, item);
        break;
      case 'video':
        renderVideoPlayer(stage, item);
        break;
      case 'audio':
        renderAudioPlayer(stage, item);
        break;
      case 'code':
      case 'document':
        if (item.mimeType === 'application/pdf' || item.filename.endsWith('.pdf')) {
          renderPdfViewer(stage, item);
        } else {
          renderTextViewer(stage, item);
        }
        break;
      default:
        renderBinaryViewer(stage, item);
    }
  }

  // --- Image Viewer with Zoom, Rotate, Flip, Pan ---
  function renderImageViewer(stage, item) {
    let scale = 1;
    let rotation = 0;
    let flipH = 1;
    let flipV = 1;

    const container = document.createElement('div');
    container.className = 'image-viewer-container';
    container.innerHTML = `
      <img src="${item.dataUrl}" alt="${escapeHtml(item.title)}" class="image-display" id="activeViewerImg">
      <div class="image-toolbar">
        <button class="img-ctrl-btn" id="imgZoomInBtn" title="Zoom In">🔍 +</button>
        <button class="img-ctrl-btn" id="imgZoomOutBtn" title="Zoom Out">🔍 -</button>
        <button class="img-ctrl-btn" id="imgZoomResetBtn" title="Reset Zoom">100%</button>
        <div class="viewer-divider"></div>
        <button class="img-ctrl-btn" id="imgRotateBtn" title="Rotate 90°">↻ 90°</button>
        <button class="img-ctrl-btn" id="imgFlipHBtn" title="Flip Horizontal">⇄</button>
        <button class="img-ctrl-btn" id="imgFlipVBtn" title="Flip Vertical">⇅</button>
      </div>
    `;

    stage.appendChild(container);

    const img = container.querySelector('#activeViewerImg');
    const updateTransform = () => {
      img.style.transform = `scale(${scale * flipH}, ${scale * flipV}) rotate(${rotation}deg)`;
    };

    container.querySelector('#imgZoomInBtn').onclick = () => {
      scale = Math.min(5, scale + 0.25);
      updateTransform();
    };
    container.querySelector('#imgZoomOutBtn').onclick = () => {
      scale = Math.max(0.25, scale - 0.25);
      updateTransform();
    };
    container.querySelector('#imgZoomResetBtn').onclick = () => {
      scale = 1;
      rotation = 0;
      flipH = 1;
      flipV = 1;
      updateTransform();
    };
    container.querySelector('#imgRotateBtn').onclick = () => {
      rotation = (rotation + 90) % 360;
      updateTransform();
    };
    container.querySelector('#imgFlipHBtn').onclick = () => {
      flipH *= -1;
      updateTransform();
    };
    container.querySelector('#imgFlipVBtn').onclick = () => {
      flipV *= -1;
      updateTransform();
    };
  }

  // --- Video Player with Speed, Loop, Fullscreen ---
  function renderVideoPlayer(stage, item) {
    const wrapper = document.createElement('div');
    wrapper.className = 'video-player-wrapper';
    wrapper.innerHTML = `
      <video class="video-player-element" controls autoplay playsinline src="${item.dataUrl}"></video>
      <div class="video-custom-controls">
        <span style="font-size: 0.8rem; font-weight: 600; color: var(--text-secondary);">Playback Speed:</span>
        <select class="form-select-sm" id="videoSpeedSelect">
          <option value="0.5">0.5x</option>
          <option value="1" selected>1.0x Normal</option>
          <option value="1.25">1.25x</option>
          <option value="1.5">1.5x</option>
          <option value="2">2.0x</option>
        </select>
        <label class="checkbox-wrapper" style="margin-left: 12px;">
          <input type="checkbox" id="videoLoopChk">
          <span class="custom-checkbox"></span>
          <span style="font-size: 0.8rem; margin-left: 6px; color: var(--text-secondary);">Loop</span>
        </label>
      </div>
    `;
    stage.appendChild(wrapper);

    const video = wrapper.querySelector('video');
    const speedSelect = wrapper.querySelector('#videoSpeedSelect');
    const loopChk = wrapper.querySelector('#videoLoopChk');

    speedSelect.onchange = () => (video.playbackRate = parseFloat(speedSelect.value));
    loopChk.onchange = () => (video.loop = loopChk.checked);
  }

  // --- Audio Player with Animated Visualizer & Controls ---
  function renderAudioPlayer(stage, item) {
    const wrapper = document.createElement('div');
    wrapper.className = 'audio-player-wrapper';
    wrapper.innerHTML = `
      <audio id="activeAudioElement" src="${item.dataUrl}"></audio>
      <div class="audio-hero-card">
        <div class="audio-disc-icon" id="audioDiscIcon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
        </div>
        <div class="audio-track-info">
          <h3 class="audio-title">${escapeHtml(item.title)}</h3>
          <span class="audio-artist">${escapeHtml(item.author || 'Nexus Sound Archive')} • ${escapeHtml(item.category || 'Audio')}</span>
        </div>
      </div>

      <canvas class="audio-visualizer-canvas" id="audioCanvas" width="560" height="80"></canvas>

      <div class="audio-progress-group">
        <span class="audio-time-label" id="audioCurTime">0:00</span>
        <input type="range" class="audio-timeline-slider" id="audioSeeker" min="0" max="100" value="0">
        <span class="audio-time-label" id="audioTotalTime">0:00</span>
      </div>

      <div class="audio-control-bar">
        <div class="audio-main-ctrls">
          <button class="audio-play-btn" id="audioPlayToggleBtn" title="Play / Pause">
            <svg id="audioPlayIcon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
          </button>
          <select class="form-select-sm" id="audioSpeedSelect">
            <option value="0.75">0.75x</option>
            <option value="1" selected>1.0x</option>
            <option value="1.25">1.25x</option>
            <option value="1.5">1.5x</option>
          </select>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
          <input type="range" id="audioVolumeSlider" min="0" max="1" step="0.05" value="1" style="width: 80px;">
        </div>
      </div>
    `;

    stage.appendChild(wrapper);

    const audio = wrapper.querySelector('#activeAudioElement');
    const playBtn = wrapper.querySelector('#audioPlayToggleBtn');
    const playIcon = wrapper.querySelector('#audioPlayIcon');
    const discIcon = wrapper.querySelector('#audioDiscIcon');
    const seeker = wrapper.querySelector('#audioSeeker');
    const curTimeLabel = wrapper.querySelector('#audioCurTime');
    const totalTimeLabel = wrapper.querySelector('#audioTotalTime');
    const speedSelect = wrapper.querySelector('#audioSpeedSelect');
    const volSlider = wrapper.querySelector('#audioVolumeSlider');
    const canvas = wrapper.querySelector('#audioCanvas');

    const formatSecs = (s) => {
      if (isNaN(s)) return '0:00';
      const m = Math.floor(s / 60);
      const rem = Math.floor(s % 60);
      return `${m}:${rem < 10 ? '0' : ''}${rem}`;
    };

    audio.onloadedmetadata = () => {
      totalTimeLabel.textContent = formatSecs(audio.duration);
    };

    audio.ontimeupdate = () => {
      curTimeLabel.textContent = formatSecs(audio.currentTime);
      if (audio.duration) {
        seeker.value = (audio.currentTime / audio.duration) * 100;
      }
    };

    seeker.oninput = () => {
      if (audio.duration) {
        audio.currentTime = (seeker.value / 100) * audio.duration;
      }
    };

    playBtn.onclick = () => {
      if (audio.paused) {
        audio.play().then(() => setupAudioVisualizer(audio, canvas)).catch(() => {});
        playIcon.innerHTML = '<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>';
        discIcon.classList.add('playing');
      } else {
        audio.pause();
        playIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"></polygon>';
        discIcon.classList.remove('playing');
      }
    };

    speedSelect.onchange = () => (audio.playbackRate = parseFloat(speedSelect.value));
    volSlider.oninput = () => (audio.volume = parseFloat(volSlider.value));

    // Auto-setup synthetic visualizer animation
    setupAudioVisualizer(audio, canvas);
  }

  function setupAudioVisualizer(audioElement, canvas) {
    const ctx = canvas.getContext('2d');
    let phase = 0;

    function drawWave() {
      audioVisualizerAnimationId = requestAnimationFrame(drawWave);
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const isPlaying = !audioElement.paused;
      const bars = 48;
      const barWidth = width / bars;

      for (let i = 0; i < bars; i++) {
        let barHeight = 4;
        if (isPlaying) {
          const freq = Math.sin(phase + i * 0.25) * Math.cos(phase * 0.5 + i * 0.1);
          barHeight = Math.max(6, Math.abs(freq) * (height * 0.85));
        } else {
          barHeight = 4 + Math.sin(phase + i * 0.15) * 3;
        }

        const gradient = ctx.createLinearGradient(0, height, 0, 0);
        gradient.addColorStop(0, '#3b82f6');
        gradient.addColorStop(0.5, '#a855f7');
        gradient.addColorStop(1, '#ec4899');

        ctx.fillStyle = gradient;
        ctx.fillRect(i * barWidth + 1, height - barHeight, barWidth - 2, barHeight);
      }
      phase += isPlaying ? 0.08 : 0.02;
    }

    drawWave();
  }

  // --- Text, Code, & Markdown Viewer ---
  function renderTextViewer(stage, item) {
    const isMarkdown = item.filename.endsWith('.md') || item.mimeType === 'text/markdown';
    const text = item.textContent || atob((item.dataUrl || '').split(',')[1] || '') || 'No text content available';

    const container = document.createElement('div');
    container.className = 'text-viewer-container';
    container.innerHTML = `
      <div class="text-viewer-toolbar">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:0.8rem; font-weight:700; color:var(--text-secondary);">${escapeHtml(item.filename)}</span>
          ${isMarkdown ? '<button class="btn btn-sm btn-outline" id="toggleMdViewBtn">Rendered / Raw</button>' : ''}
        </div>
        <button class="btn btn-sm btn-outline" id="copyCodeBtn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          <span>Copy</span>
        </button>
      </div>
      <div class="text-viewer-body" id="textViewerBody">${escapeHtml(text)}</div>
    `;

    stage.appendChild(container);

    const body = container.querySelector('#textViewerBody');
    const copyBtn = container.querySelector('#copyCodeBtn');

    copyBtn.onclick = () => {
      navigator.clipboard.writeText(text).then(() => {
        showToast('Copied content to clipboard', 'success');
      });
    };

    if (isMarkdown) {
      let isRendered = false;
      const toggleBtn = container.querySelector('#toggleMdViewBtn');
      toggleBtn.onclick = () => {
        isRendered = !isRendered;
        if (isRendered) {
          body.className = 'text-viewer-body markdown-rendered-view';
          body.innerHTML = parseSimpleMarkdown(text);
        } else {
          body.className = 'text-viewer-body';
          body.textContent = text;
        }
      };
      // Default to rendered
      toggleBtn.click();
    }
  }

  function parseSimpleMarkdown(md) {
    return md
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*)\*/gim, '<em>$1</em>')
      .replace(/```([a-z]*)\n([\s\S]*?)```/gim, '<pre><code>$2</code></pre>')
      .replace(/`([^`]+)`/gim, '<code>$1</code>')
      .replace(/\n\n/gim, '</p><p>')
      .replace(/\n/gim, '<br>');
  }

  // --- PDF Viewer ---
  function renderPdfViewer(stage, item) {
    const container = document.createElement('div');
    container.className = 'text-viewer-container';
    container.innerHTML = `
      <div class="text-viewer-toolbar">
        <span>${escapeHtml(item.filename)}</span>
        <a class="btn btn-sm btn-primary" href="${item.dataUrl}" download="${escapeHtml(item.filename)}">Download PDF</a>
      </div>
      <iframe src="${item.dataUrl}" style="width:100%;height:100%;border:none;"></iframe>
    `;
    stage.appendChild(container);
  }

  // --- Generic Binary Viewer ---
  function renderBinaryViewer(stage, item) {
    const container = document.createElement('div');
    container.className = 'binary-viewer-container';
    container.innerHTML = `
      <div class="binary-icon-box">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
      </div>
      <h3 style="font-size:1.2rem;font-weight:700;">${escapeHtml(item.title)}</h3>
      <p style="color:var(--text-secondary);font-size:0.88rem;">${escapeHtml(item.filename)} (${formatBytes(item.size)})</p>
      <p style="color:var(--text-muted);font-size:0.8rem;">Binary / Non-previewable stream</p>
      <button class="btn btn-primary" id="binaryDownloadBtn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        <span>Download File</span>
      </button>
    `;
    stage.appendChild(container);
    container.querySelector('#binaryDownloadBtn').onclick = () => downloadFileItem(item);
  }

  // --- Viewer Sidebar Details ---
  function renderViewerSidebarDetails(item) {
    const container = document.getElementById('viewerSidebarContent');
    const tagsHtml = (item.tags || [])
      .map((t) => `<span class="tag-badge">#${escapeHtml(t)}</span>`)
      .join(' ') || '<span style="color:var(--text-muted);">No tags</span>';

    const propsHtml = (item.customProps || [])
      .map(
        (p) =>
          `<div class="detail-item"><span class="detail-label">${escapeHtml(p.key)}</span><span class="detail-value">${escapeHtml(p.value)}</span></div>`
      )
      .join('');

    const directUrl = getDirectItemUrl(item);

    container.innerHTML = `
      <div class="detail-item"><span class="detail-label">Title</span><span class="detail-value" style="font-weight:600;">${escapeHtml(item.title)}</span></div>
      <div class="detail-item"><span class="detail-label">Filename</span><span class="detail-value" style="font-family:var(--font-mono);font-size:0.78rem;">${escapeHtml(item.filename)}</span></div>
      <div class="detail-item"><span class="detail-label">File Size</span><span class="detail-value">${formatBytes(item.size)} (${item.size.toLocaleString()} bytes)</span></div>
      <div class="detail-item"><span class="detail-label">MIME Type</span><span class="detail-value">${escapeHtml(item.mimeType || 'unknown')}</span></div>
      <div class="detail-item"><span class="detail-label">Category</span><span class="detail-value">${escapeHtml(item.category || 'General')}</span></div>
      <div class="detail-item"><span class="detail-label">Status</span><span class="detail-value">${escapeHtml(item.status || 'published')}</span></div>
      <div class="detail-item"><span class="detail-label">Author</span><span class="detail-value">${escapeHtml(item.author || 'Anonymous')}</span></div>
      <div class="detail-item"><span class="detail-label">Date & Time</span><span class="detail-value">${formatDateTime(item.date)}</span></div>
      <div class="detail-item"><span class="detail-label">Rating</span><span class="detail-value">${item.rating ? '★'.repeat(item.rating) : 'Unrated'}</span></div>
      <div class="detail-item"><span class="detail-label">Direct Share URL</span>
        <div style="display:flex; align-items:center; gap:6px; margin-top:4px;">
          <input type="text" class="form-input" readonly value="${escapeHtml(directUrl)}" style="font-size:0.75rem; font-family:var(--font-mono); padding:4px 8px;" onclick="this.select();">
          <button class="btn btn-sm btn-primary" id="copySidebarDirectUrlBtn" title="Copy URL">Copy</button>
        </div>
      </div>
      <div class="detail-item"><span class="detail-label">Tags</span><div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;">${tagsHtml}</div></div>
      ${item.description ? `<div class="detail-item"><span class="detail-label">Description</span><span class="detail-value">${escapeHtml(item.description)}</span></div>` : ''}
      ${propsHtml ? `<div style="border-top:1px solid var(--border-color);padding-top:10px;margin-top:6px;"><span class="detail-label" style="margin-bottom:8px;display:block;">Custom Metadata</span>${propsHtml}</div>` : ''}
    `;

    const copyBtn = container.querySelector('#copySidebarDirectUrlBtn');
    if (copyBtn) {
      copyBtn.onclick = () => copyItemDirectUrl(item);
    }
  }

  // ==========================================================================
  // 11. Batch Tagging Modal
  // ==========================================================================
  function bindBatchModalEvents() {
    const input = document.getElementById('batchTagInputField');
    const saveBtn = document.getElementById('saveBatchTagsBtn');

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const tag = input.value.replace(/,/g, '').trim().toLowerCase();
        if (tag) {
          state.batchTags.add(tag);
          input.value = '';
          renderBatchTagPills();
        }
      }
    });

    saveBtn.addEventListener('click', async () => {
      const selected = state.items.filter((i) => state.selectedIds.has(i.id));
      const tagsToAdd = Array.from(state.batchTags);

      if (tagsToAdd.length === 0) {
        showToast('Please enter at least one tag', 'danger');
        return;
      }

      selected.forEach((item) => {
        const existing = new Set((item.tags || []).map((t) => t.toLowerCase()));
        tagsToAdd.forEach((t) => existing.add(t));
        item.tags = Array.from(existing);
      });

      await db.putMany(selected);
      closeModal('batchTagModal');
      renderApp();
      showToast(`Added tags to ${selected.length} items`, 'success');
    });
  }

  function openBatchTagModal() {
    state.batchTags.clear();
    document.getElementById('batchTagModalCountDesc').textContent = `Applying tags to ${state.selectedIds.size} selected items:`;
    document.getElementById('batchTagInputField').value = '';
    renderBatchTagPills();
    openModal('batchTagModal');
  }

  function renderBatchTagPills() {
    const list = document.getElementById('batchTagsList');
    list.innerHTML = Array.from(state.batchTags)
      .map(
        (t) =>
          `<span class="tag-pill-item">#${escapeHtml(t)} <button type="button" class="tag-remove-x" data-tag="${escapeHtml(t)}">&times;</button></span>`
      )
      .join('');

    list.querySelectorAll('.tag-remove-x').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.batchTags.delete(btn.dataset.tag);
        renderBatchTagPills();
      });
    });
  }

  // ==========================================================================
  // 12. Deletion & Confirmation Modal (Single, Batch, All)
  // ==========================================================================
  let pendingDeleteItems = [];
  let isClearAllOperation = false;

  function bindDeleteModalEvents() {
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    confirmBtn.addEventListener('click', async () => {
      if (isClearAllOperation) {
        state.lastDeletedItems = [...state.items];
        await db.clear();
        state.items = [];
        state.selectedIds.clear();
        closeModal('deleteConfirmModal');
        renderApp();
        showToast('All CMS records deleted', 'danger', () => undoLastDelete());
      } else {
        const idsToDelete = pendingDeleteItems.map((i) => i.id);
        state.lastDeletedItems = [...pendingDeleteItems];
        await db.deleteMany(idsToDelete);
        state.items = state.items.filter((i) => !idsToDelete.includes(i.id));
        idsToDelete.forEach((id) => state.selectedIds.delete(id));
        closeModal('deleteConfirmModal');
        renderApp();
        showToast(
          `Deleted ${idsToDelete.length} item${idsToDelete.length === 1 ? '' : 's'}`,
          'danger',
          () => undoLastDelete()
        );
      }
    });
  }

  function openDeleteConfirmModal(itemsToDelete, isAll = false) {
    pendingDeleteItems = itemsToDelete;
    isClearAllOperation = isAll;

    const title = document.getElementById('deleteModalTitle');
    const msg = document.getElementById('deleteModalMessage');
    const preview = document.getElementById('deleteItemsListPreview');

    if (isAll) {
      title.textContent = 'Clear All Records';
      msg.textContent = `Are you sure you want to permanently delete all ${state.items.length} files from the system? This action cannot be reversed without a backup.`;
      preview.style.display = 'none';
    } else if (itemsToDelete.length === 1) {
      title.textContent = 'Delete File';
      msg.textContent = `Are you sure you want to delete "${itemsToDelete[0].title}" (${itemsToDelete[0].filename})?`;
      preview.style.display = 'none';
    } else {
      title.textContent = `Delete ${itemsToDelete.length} Files`;
      msg.textContent = `Are you sure you want to permanently delete these ${itemsToDelete.length} selected items?`;
      preview.style.display = 'block';
      preview.innerHTML = itemsToDelete
        .slice(0, 5)
        .map((i) => `<div style="font-size:0.8rem;color:var(--text-secondary);margin-top:2px;">• ${escapeHtml(i.title)}</div>`)
        .join('');
      if (itemsToDelete.length > 5) {
        preview.innerHTML += `<div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;">...and ${itemsToDelete.length - 5} more</div>`;
      }
    }

    openModal('deleteConfirmModal');
  }

  async function undoLastDelete() {
    if (state.lastDeletedItems.length > 0) {
      await db.putMany(state.lastDeletedItems);
      state.items = await db.getAll();
      state.lastDeletedItems = [];
      renderApp();
      showToast('Restored deleted items', 'success');
    }
  }

  // ==========================================================================
  // 13. Export, Import & File Downloads
  // ==========================================================================
  function downloadFileItem(item) {
    const link = document.createElement('a');
    link.download = item.filename || 'downloaded_file';

    if (item.dataUrl) {
      link.href = item.dataUrl;
    } else if (item.textContent) {
      const blob = new Blob([item.textContent], { type: item.mimeType || 'text/plain' });
      link.href = URL.createObjectURL(blob);
    } else {
      showToast('File data unavailable for direct download', 'danger');
      return;
    }

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function exportDatabase() {
    const exportBundle = {
      version: '2.5',
      exportDate: new Date().toISOString(),
      itemCount: state.items.length,
      items: state.items
    };

    const blob = new Blob([JSON.stringify(exportBundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexus_cms_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('CMS Database exported successfully', 'success');
  }

  function importDatabase(file) {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const data = JSON.parse(reader.result);
        if (data && Array.isArray(data.items)) {
          await db.putMany(data.items);
          state.items = await db.getAll();
          renderApp();
          showToast(`Imported ${data.items.length} records successfully`, 'success');
        } else {
          showToast('Invalid backup file structure', 'danger');
        }
      } catch (err) {
        showToast('Failed to parse JSON file', 'danger');
      }
    };
    reader.readAsText(file);
  }

  // ==========================================================================
  // 14. Drag & Drop Overlay & Keyboard Navigation
  // ==========================================================================
  function setupGlobalDragAndDrop() {
    const curtain = document.getElementById('dragDropCurtain');
    let dragCounter = 0;

    window.addEventListener('dragenter', (e) => {
      e.preventDefault();
      dragCounter++;
      if (dragCounter === 1) {
        curtain.classList.add('active');
      }
    });

    window.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        curtain.classList.remove('active');
      }
    });

    window.addEventListener('dragover', (e) => e.preventDefault());

    window.addEventListener('drop', (e) => {
      e.preventDefault();
      dragCounter = 0;
      curtain.classList.remove('active');

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        openUploadModal();
        handleFileSelectedForUpload(file);
      }
    });
  }

  function setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      // Ignore when typing inside input/textarea
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      const isInput = activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select';

      // Shortcuts Modal '?'
      if (e.key === '?' && !isInput) {
        e.preventDefault();
        openModal('shortcutsModal');
        return;
      }

      // Escape key closes open modals or fullscreen
      if (e.key === 'Escape') {
        const viewerModal = document.getElementById('mediaViewerModal');
        if (viewerModal.classList.contains('open')) {
          closeViewerModal();
          return;
        }
        document.querySelectorAll('.modal-backdrop.open').forEach((m) => m.classList.remove('open'));
        return;
      }

      // Viewer navigation keys
      const viewerModal = document.getElementById('mediaViewerModal');
      if (viewerModal && viewerModal.classList.contains('open')) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          document.getElementById('viewerPrevBtn').click();
          return;
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          document.getElementById('viewerNextBtn').click();
          return;
        }
        if (e.key.toLowerCase() === 'f') {
          e.preventDefault();
          toggleViewerFullscreen();
          return;
        }
        if (e.key === ' ' && !isInput) {
          e.preventDefault();
          const video = document.querySelector('.video-player-element');
          const audio = document.getElementById('activeAudioElement');
          if (video) {
            if (video.paused) video.play();
            else video.pause();
          } else if (audio) {
            document.getElementById('audioPlayToggleBtn').click();
          }
          return;
        }
      }

      if (isInput) return;

      // Focus Search Bar
      if (e.key === '/') {
        e.preventDefault();
        const search = document.getElementById('globalSearchInput');
        search.focus();
        search.select();
        return;
      }

      // Open Upload Modal
      if (e.key.toLowerCase() === 'u') {
        e.preventDefault();
        openUploadModal();
        return;
      }

      // Select all (Cmd+A / Ctrl+A)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        const list = getFilteredAndSortedItems();
        list.forEach((i) => state.selectedIds.add(i.id));
        renderApp();
        return;
      }

      // Delete selected
      if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedIds.size > 0) {
        e.preventDefault();
        const selected = state.items.filter((i) => state.selectedIds.has(i.id));
        openDeleteConfirmModal(selected);
        return;
      }
    });
  }

  function bindShortcutsModalEvents() {
    document.getElementById('shortcutsHelpBtn').addEventListener('click', () => {
      openModal('shortcutsModal');
    });
  }

  // ==========================================================================
  // 15. Toast Notifications & Undo Stack
  // ==========================================================================
  function showToast(message, type = 'info', undoCallback = null) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const msgSpan = document.createElement('span');
    msgSpan.className = 'toast-message';
    msgSpan.textContent = message;
    toast.appendChild(msgSpan);

    if (undoCallback) {
      const undoBtn = document.createElement('button');
      undoBtn.className = 'toast-undo-btn';
      undoBtn.textContent = 'Undo';
      undoBtn.onclick = () => {
        undoCallback();
        toast.remove();
      };
      toast.appendChild(undoBtn);
    }

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4500);
  }

  // ==========================================================================
  // 16. Boot Application
  // ==========================================================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();
