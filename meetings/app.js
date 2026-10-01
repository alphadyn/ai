// Meetings — a browser-based video conferencing app.
// Uses PeerJS (WebRTC) for media + data channels. The first participant to
// claim a room's well-known "host" peer id becomes the room's directory:
// it introduces new joiners to everyone already in the room, after which
// every participant holds a direct WebRTC connection to every other
// participant (mesh topology) for audio/video, chat, and file sharing.

(() => {
  const HOST_PREFIX = 'meetup-host-';
  const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB

  // ---- DOM references -------------------------------------------------
  const joinScreen = document.getElementById('joinScreen');
  const meetingScreen = document.getElementById('meetingScreen');
  const joinForm = document.getElementById('joinForm');
  const nameInput = document.getElementById('nameInput');
  const roomInput = document.getElementById('roomInput');
  const newMeetingBtn = document.getElementById('newMeetingBtn');
  const joinStatus = document.getElementById('joinStatus');
  const previewVideo = document.getElementById('previewVideo');
  const previewStatus = document.getElementById('previewStatus');
  const previewMicBtn = document.getElementById('previewMicBtn');
  const previewCamBtn = document.getElementById('previewCamBtn');
  const retryMediaBtn = document.getElementById('retryMediaBtn');

  const roomLabel = document.getElementById('roomLabel');
  const copyLinkBtn = document.getElementById('copyLinkBtn');
  const connectionStatus = document.getElementById('connectionStatus');
  const meetingMediaStatus = document.getElementById('meetingMediaStatus');
  const videoGrid = document.getElementById('videoGrid');
  const sidePanel = document.getElementById('sidePanel');
  const sideTabs = document.querySelectorAll('.side-tab');
  const sidePanels = document.querySelectorAll('.side-tab-panel');

  const chatLog = document.getElementById('chatLog');
  const chatForm = document.getElementById('chatForm');
  const chatInput = document.getElementById('chatInput');
  const peopleList = document.getElementById('peopleList');
  const fileInput = document.getElementById('fileInput');
  const fileLog = document.getElementById('fileLog');

  const micBtn = document.getElementById('micBtn');
  const camBtn = document.getElementById('camBtn');
  const chatToggleBtn = document.getElementById('chatToggleBtn');
  const peopleToggleBtn = document.getElementById('peopleToggleBtn');
  const filesToggleBtn = document.getElementById('filesToggleBtn');
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  const peopleCount = document.getElementById('peopleCount');
  const leaveBtn = document.getElementById('leaveBtn');

  // ---- State ------------------------------------------------------------
  let localStream = null;
  let mediaPromise = null;
  let peer = null;
  let myId = null;
  let myName = '';
  let isHost = false;
  let hostPeerId = '';
  let roomKey = null; // AES-256-GCM CryptoKey derived from the meeting code
  /** peerId -> { name, conn, call, videoEl } */
  const participants = new Map();
  /** host-only: peerId -> name, tracks everyone known in the room */
  const roster = new Map();

  // ---- Utility helpers ----------------------------------------------------
  function slugifyRoom(raw) {
    return raw.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'lobby';
  }

  function randomRoomCode() {
    const words = ['orbit', 'cedar', 'maple', 'ember', 'quartz', 'harbor', 'summit', 'lumen'];
    const w = words[Math.floor(Math.random() * words.length)];
    return `${w}-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  function setStatus(el, text) {
    el.textContent = text;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function initials(name) {
    return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('') || '?';
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  // ---- End-to-end encryption ---------------------------------------------
  // Every data-channel message (chat, roster/signaling, and file transfers) is
  // encrypted with AES-256-GCM using a key derived from the meeting code via
  // PBKDF2. Only people who know the meeting code can decrypt this traffic —
  // not the PeerJS signaling broker or any relay in between. This is on top
  // of the DTLS-SRTP encryption WebRTC itself mandates for every connection
  // (audio, video, and data channels), so audio/video is always encrypted
  // in transit even though it isn't re-encrypted at the application layer.
  if (!window.crypto?.subtle) {
    throw new Error('This browser does not support the Web Crypto API needed for encrypted meetings.');
  }

  async function deriveRoomKey(room) {
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey('raw', enc.encode(room), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: enc.encode('meetings-app-e2ee-v1'), iterations: 150000, hash: 'SHA-256' },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async function deriveHostPeerId(room) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('meetings-app-host-id-v1:' + room));
    const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
    return HOST_PREFIX + hex.slice(0, 24);
  }

  // Encrypts an arbitrary JSON-serializable message and sends it on `conn`.
  async function sendSecure(conn, message) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new TextEncoder().encode(JSON.stringify(message));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, roomKey, plaintext);
    conn.send({ type: 'enc', iv: Array.from(iv), ct });
  }

  // Encrypts a raw file chunk (ArrayBuffer) without JSON/base64 overhead.
  async function sendSecureBinary(conn, fileId, buffer) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, roomKey, buffer);
    conn.send({ type: 'enc-bin', id: fileId, iv: Array.from(iv), ct });
  }

  async function decryptEnvelope(envelope) {
    const iv = new Uint8Array(envelope.iv);
    if (envelope.type === 'enc') {
      const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, roomKey, envelope.ct);
      return JSON.parse(new TextDecoder().decode(pt));
    }
    if (envelope.type === 'enc-bin') {
      const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, roomKey, envelope.ct);
      return { type: 'file-chunk', id: envelope.id, buffer: pt };
    }
    return null;
  }

  // ---- Local media preflight ---------------------------------------------
  async function acquireLocalStream() {
    if (!localStream) localStream = new MediaStream();
    const missingAudio = !localStream.getAudioTracks().some((track) => track.readyState === 'live');
    const missingVideo = !localStream.getVideoTracks().some((track) => track.readyState === 'live');
    if (navigator.mediaDevices?.getUserMedia && (missingAudio || missingVideo)) {
      let captured = null;
      try {
        captured = await navigator.mediaDevices.getUserMedia({ video: missingVideo, audio: missingAudio });
      } catch {
        // A missing or blocked device must not prevent the other from working.
        for (const kind of ['audio', 'video']) {
          if ((kind === 'audio' && !missingAudio) || (kind === 'video' && !missingVideo)) continue;
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: kind === 'video', audio: kind === 'audio' });
            stream.getTracks().forEach((track) => localStream.addTrack(track));
          } catch {
            // Joining with just the available devices (or chat only) is supported.
          }
        }
      }
      if (captured) captured.getTracks().forEach((track) => localStream.addTrack(track));
    }
    localStream.getTracks().filter((track) => track.readyState === 'ended').forEach((track) => localStream.removeTrack(track));
    previewVideo.srcObject = localStream;
    const hasAudio = localStream.getAudioTracks().length > 0;
    const hasVideo = localStream.getVideoTracks().length > 0;
    const message = !navigator.mediaDevices?.getUserMedia
      ? 'Camera and microphone require HTTPS or localhost in a supported browser. You can still use chat/files.'
      : hasAudio && hasVideo ? ''
        : hasAudio ? 'Camera unavailable — joining with audio only.'
          : hasVideo ? 'Microphone unavailable — joining with video only.'
            : 'Microphone and camera are unavailable. Check browser permissions or devices; you can still use chat/files.';
    setStatus(previewStatus, message);
    setStatus(meetingMediaStatus, message);
    meetingMediaStatus.classList.toggle('hidden', !message);
    retryMediaBtn.classList.toggle('hidden', hasAudio && hasVideo);
    for (const [kind, buttons] of [['audio', [previewMicBtn, micBtn]], ['video', [previewCamBtn, camBtn]]]) {
      const track = (kind === 'audio' ? localStream.getAudioTracks() : localStream.getVideoTracks())[0];
      buttons.forEach((button) => {
        button.disabled = !track;
        button.classList.toggle('is-on', !!track?.enabled);
        button.setAttribute('aria-pressed', String(!!track?.enabled));
      });
    }
    return localStream;
  }

  function requestLocalMedia() {
    if (!mediaPromise) mediaPromise = acquireLocalStream().finally(() => { mediaPromise = null; });
    return mediaPromise;
  }

  function toggleTrack(kind, btn) {
    if (!localStream) return;
    const tracks = kind === 'audio' ? localStream.getAudioTracks() : localStream.getVideoTracks();
    if (!tracks.length) return;
    const enabled = !tracks[0].enabled;
    tracks.forEach((t) => { t.enabled = enabled; });
    const otherBtn = kind === 'audio' ? (btn === micBtn ? previewMicBtn : micBtn) : (btn === camBtn ? previewCamBtn : camBtn);
    [btn, otherBtn].forEach((button) => {
      button.classList.toggle('is-on', enabled);
      button.setAttribute('aria-pressed', String(enabled));
    });
    if (kind === 'video') updateTileVideoState(document.getElementById('tile-local'), localStream);
  }

  previewMicBtn.addEventListener('click', () => toggleTrack('audio', previewMicBtn));
  previewCamBtn.addEventListener('click', () => toggleTrack('video', previewCamBtn));

  retryMediaBtn.addEventListener('click', () => requestLocalMedia());
  requestLocalMedia();

  // Pre-fill room code from URL (?room=xyz) for invite links.
  const params = new URLSearchParams(window.location.search);
  if (params.get('room')) roomInput.value = params.get('room');
  newMeetingBtn.addEventListener('click', () => { roomInput.value = randomRoomCode(); });

  // ---- Joining a meeting ---------------------------------------------------
  joinForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    const room = slugifyRoom(roomInput.value);
    if (!name || !room) return;
    myName = name;
    setStatus(joinStatus, 'Connecting…');
    joinForm.querySelector('button[type="submit"]').disabled = true;
    startMeeting(room).catch((err) => {
      console.error(err);
      setStatus(joinStatus, err.message || 'Could not connect. Please try again.');
      joinForm.querySelector('button[type="submit"]').disabled = false;
    });
  });

  async function startMeeting(room) {
    // Permission prompts can still be pending when the user clicks Join.
    // PeerJS must never call/answer with a null stream.
    await (mediaPromise || Promise.resolve(localStream));
    roomKey = await deriveRoomKey(room);
    hostPeerId = await deriveHostPeerId(room);
    await tryBecomeHost(room);
  }

  function tryBecomeHost(room) {
    return new Promise((resolve, reject) => {
      const candidate = new Peer(hostPeerId, { debug: 1 });
      let settled = false;

      candidate.on('open', (id) => {
        settled = true;
        isHost = true;
        peer = candidate;
        myId = id;
        roster.set(myId, myName);
        wireCommonPeerEvents();
        enterMeetingUi(room);
        resolve();
      });

      candidate.on('error', (err) => {
        if (settled) return;
        if (err.type === 'unavailable-id') {
          candidate.destroy();
          joinAsGuest(room).then(resolve).catch(reject);
        } else {
          reject(err);
        }
      });
    });
  }

  function joinAsGuest(room) {
    return new Promise((resolve, reject) => {
      const candidate = new Peer({ debug: 1 });
      candidate.on('open', (id) => {
        isHost = false;
        peer = candidate;
        myId = id;
        wireCommonPeerEvents();
        enterMeetingUi(room);
        connectToPeer(hostPeerId);
        resolve();
      });
      candidate.on('error', (err) => {
        reject(err);
      });
    });
  }

  function wireCommonPeerEvents() {
    peer.on('connection', (conn) => setupDataConnection(conn));
    peer.on('call', (call) => {
      call.answer(localStream);
      wireCallEvents(call);
    });
    peer.on('disconnected', () => setStatus(connectionStatus, 'Reconnecting…'));
    peer.on('error', (err) => console.warn('Peer error:', err));
  }

  function enterMeetingUi(room) {
    joinScreen.classList.add('hidden');
    meetingScreen.classList.remove('hidden');
    roomLabel.textContent = room;
    setStatus(connectionStatus, isHost ? 'You started this meeting' : 'Connected');
    addLocalVideoTile();
    renderPeopleList();
  }

  // ---- Connecting to another peer (data channel + media call) --------------
  function connectToPeer(id) {
    if (id === myId) return;
    const existing = participants.get(id);
    if (existing && existing.conn) return;
    const conn = peer.connect(id, { reliable: true });
    setupDataConnection(conn);
    const call = peer.call(id, localStream);
    wireCallEvents(call);
  }

  function setupDataConnection(conn) {
    const existing = participants.get(conn.peer) || {};
    participants.set(conn.peer, { ...existing, conn });

    conn.on('open', () => {
      sendSecure(conn, { type: 'hello', name: myName, id: myId });
    });

    conn.on('data', async (envelope) => {
      const msg = await decryptEnvelope(envelope);
      if (msg) handleMessage(conn.peer, msg);
    });

    conn.on('close', () => removeParticipant(conn.peer));
  }

  function wireCallEvents(call) {
    const existing = participants.get(call.peer) || {};
    participants.set(call.peer, { ...existing, call });
    call.on('stream', (remoteStream) => {
      addRemoteVideoTile(call.peer, remoteStream);
    });
    call.on('close', () => removeParticipant(call.peer));
  }

  // ---- Message handling ------------------------------------------------
  function handleMessage(fromId, msg) {
    switch (msg.type) {
      case 'hello': {
        const entry = participants.get(fromId) || {};
        entry.name = msg.name;
        participants.set(fromId, entry);
        renderPeopleList();
        updateTileName(fromId, msg.name);

        if (isHost) {
          roster.set(fromId, msg.name);
          const conn = entry.conn;
          if (conn) {
            const peers = [...roster.entries()]
              .filter(([id]) => id !== fromId)
              .map(([id, name]) => ({ id, name }));
            sendSecure(conn, { type: 'roster', peers });
          }
          broadcast({ type: 'peer-joined', id: fromId, name: msg.name }, [fromId]);
        }
        break;
      }
      case 'roster': {
        msg.peers.forEach(({ id, name }) => {
          if (id === myId) return;
          const entry = participants.get(id) || {};
          entry.name = entry.name || name;
          participants.set(id, entry);
          if (id !== hostPeerId) connectToPeer(id);
        });
        renderPeopleList();
        break;
      }
      case 'peer-joined': {
        if (msg.id === myId) break;
        const entry = participants.get(msg.id) || {};
        entry.name = entry.name || msg.name;
        participants.set(msg.id, entry);
        renderPeopleList();
        break;
      }
      case 'peer-left': {
        removeParticipant(msg.id);
        break;
      }
      case 'chat': {
        appendChatMessage(msg.name, msg.text, msg.time, false);
        break;
      }
      case 'file-meta': {
        incomingFiles.set(msg.id, msg);
        break;
      }
      case 'file-chunk': {
        handleFileChunk(msg);
        break;
      }
      default:
        break;
    }
  }

  function broadcast(message, excludeIds = []) {
    participants.forEach(({ conn }, id) => {
      if (conn && conn.open && !excludeIds.includes(id)) sendSecure(conn, message);
    });
  }

  function removeParticipant(id) {
    const entry = participants.get(id);
    if (!entry) return;
    participants.delete(id);
    if (isHost) {
      roster.delete(id);
      broadcast({ type: 'peer-left', id });
    }
    const tile = document.getElementById(`tile-${id}`);
    if (tile) tile.remove();
    renderPeopleList();
  }

  // ---- Video grid rendering -----------------------------------------------
  function addLocalVideoTile() {
    const tile = buildTile('local', myName + ' (You)', true);
    const video = tile.querySelector('video');
    video.srcObject = localStream;
    video.muted = true;
    updateTileVideoState(tile, localStream);
    videoGrid.appendChild(tile);
  }

  function addRemoteVideoTile(id, stream) {
    let tile = document.getElementById(`tile-${id}`);
    if (!tile) {
      const name = participants.get(id)?.name || 'Participant';
      tile = buildTile(id, name, false);
      videoGrid.appendChild(tile);
    }
    tile.querySelector('video').srcObject = stream;
    updateTileVideoState(tile, stream);
  }

  function updateTileVideoState(tile, stream) {
    if (!tile) return;
    tile.classList.toggle('has-video', stream.getVideoTracks().some((track) => track.readyState === 'live' && track.enabled));
  }

  function updateTileName(id, name) {
    const tile = document.getElementById(`tile-${id}`);
    if (tile) tile.querySelector('.tile-name').textContent = name;
  }

  function buildTile(id, name, isLocal) {
    const tile = document.createElement('div');
    tile.className = 'video-tile';
    tile.id = `tile-${id}`;
    tile.innerHTML = `
      <video autoplay playsinline ${isLocal ? 'muted' : ''}></video>
      <div class="tile-avatar">${escapeHtml(initials(name))}</div>
      <span class="tile-name">${escapeHtml(name)}</span>
    `;
    return tile;
  }

  // ---- People panel ---------------------------------------------------
  function renderPeopleList() {
    const all = [{ id: myId, name: myName + ' (You)' }, ...[...participants.entries()].map(([id, p]) => ({ id, name: p.name || 'Joining…' }))];
    peopleList.innerHTML = all.map((p) => `<li><span class="avatar">${escapeHtml(initials(p.name))}</span>${escapeHtml(p.name)}</li>`).join('');
    peopleCount.textContent = String(all.length);
  }

  // ---- Chat -------------------------------------------------------------
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;
    const time = new Date().toISOString();
    broadcast({ type: 'chat', name: myName, text, time });
    appendChatMessage(myName, text, time, true);
    chatInput.value = '';
  });

  function appendChatMessage(name, text, time, isMine) {
    const li = document.createElement('li');
    li.className = 'chat-message' + (isMine ? ' is-mine' : '');
    const stamp = new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    li.innerHTML = `<span class="chat-meta">${escapeHtml(name)} · ${stamp}</span><span class="chat-text">${escapeHtml(text)}</span>`;
    chatLog.appendChild(li);
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  // ---- File sharing --------------------------------------------------------
  const incomingFiles = new Map(); // fileId -> { name, mime, size, chunks: [] }

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      logFileEvent(`"${file.name}" is larger than 25 MB and wasn't sent.`);
      return;
    }
    sendFile(file);
  });

  function sendFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      const fileId = `${myId}-${Date.now()}`;
      const buffer = reader.result;
      const meta = { type: 'file-meta', id: fileId, from: myName, name: file.name, mime: file.type, size: file.size };
      participants.forEach(({ conn }) => {
        if (conn && conn.open) {
          sendSecure(conn, meta);
          sendSecureBinary(conn, fileId, buffer);
        }
      });
      logFileEvent(`You shared "${file.name}" (${formatBytes(file.size)}).`);
    };
    reader.readAsArrayBuffer(file);
  }

  function handleFileChunk(msg) {
    const meta = incomingFiles.get(msg.id);
    if (!meta) return;
    incomingFiles.delete(msg.id);
    const blob = new Blob([msg.buffer], { type: meta.mime || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    logFileEvent(`${meta.from} shared "${meta.name}" (${formatBytes(meta.size)}).`, url, meta.name);
  }

  function logFileEvent(text, downloadUrl, downloadName) {
    const li = document.createElement('li');
    li.className = 'file-entry';
    const label = document.createElement('span');
    label.textContent = text;
    li.appendChild(label);
    if (downloadUrl) {
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = downloadName;
      link.className = 'link-btn';
      link.textContent = 'Download';
      li.appendChild(link);
    }
    fileLog.appendChild(li);
    fileLog.scrollTop = fileLog.scrollHeight;
  }

  // ---- Controls -----------------------------------------------------------
  micBtn.addEventListener('click', () => toggleTrack('audio', micBtn));
  camBtn.addEventListener('click', () => toggleTrack('video', camBtn));

  sideTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      sideTabs.forEach((t) => t.classList.remove('is-active'));
      tab.classList.add('is-active');
      sidePanels.forEach((p) => p.classList.toggle('hidden', p.dataset.panel !== tab.dataset.tab));
      sidePanel.classList.remove('hidden');
    });
  });

  function toggleSidePanel(tabName) {
    const alreadyOpen = !sidePanel.classList.contains('hidden') && document.querySelector(`.side-tab[data-tab="${tabName}"]`).classList.contains('is-active');
    if (alreadyOpen) {
      sidePanel.classList.add('hidden');
      return;
    }
    sideTabs.forEach((t) => t.classList.toggle('is-active', t.dataset.tab === tabName));
    sidePanels.forEach((p) => p.classList.toggle('hidden', p.dataset.panel !== tabName));
    sidePanel.classList.remove('hidden');
  }

  chatToggleBtn.addEventListener('click', () => toggleSidePanel('chat'));
  peopleToggleBtn.addEventListener('click', () => toggleSidePanel('people'));
  filesToggleBtn.addEventListener('click', () => toggleSidePanel('files'));

  function getFullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }

  function updateFullscreenButton() {
    const isFullscreen = getFullscreenElement() === meetingScreen;
    const label = isFullscreen ? 'Exit fullscreen' : 'Fullscreen';
    fullscreenBtn.setAttribute('aria-label', isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen');
    fullscreenBtn.setAttribute('aria-pressed', String(isFullscreen));
    fullscreenBtn.title = isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen';
    fullscreenBtn.querySelector('.control-label').textContent = label;
  }

  async function toggleFullscreen() {
    try {
      if (getFullscreenElement()) {
        const exitFullscreen = document.exitFullscreen || document.webkitExitFullscreen;
        if (exitFullscreen) await exitFullscreen.call(document);
        return;
      }
      const requestFullscreen = meetingScreen.requestFullscreen || meetingScreen.webkitRequestFullscreen;
      if (!requestFullscreen) throw new Error('Fullscreen is not supported by this browser.');
      await requestFullscreen.call(meetingScreen);
    } catch (err) {
      console.warn('Unable to toggle fullscreen:', err);
      setStatus(connectionStatus, 'Fullscreen is unavailable in this browser.');
      setTimeout(() => setStatus(connectionStatus, isHost ? 'You started this meeting' : 'Connected'), 2500);
    }
  }

  const canFullscreen = Boolean(meetingScreen.requestFullscreen || meetingScreen.webkitRequestFullscreen);
  fullscreenBtn.disabled = !canFullscreen;
  if (!canFullscreen) fullscreenBtn.title = 'Fullscreen is not supported by this browser';
  fullscreenBtn.addEventListener('click', toggleFullscreen);
  document.addEventListener('fullscreenchange', updateFullscreenButton);
  document.addEventListener('webkitfullscreenchange', updateFullscreenButton);

  copyLinkBtn.addEventListener('click', async () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(roomLabel.textContent)}`;
    try {
      await navigator.clipboard.writeText(url);
      setStatus(connectionStatus, 'Invite link copied!');
      setTimeout(() => setStatus(connectionStatus, isHost ? 'You started this meeting' : 'Connected'), 2000);
    } catch {
      window.prompt('Copy this invite link:', url);
    }
  });

  leaveBtn.addEventListener('click', leaveMeeting);
  window.addEventListener('beforeunload', () => {
    if (peer) peer.destroy();
  });

  function leaveMeeting() {
    const exitFullscreen = document.exitFullscreen || document.webkitExitFullscreen;
    if (getFullscreenElement() === meetingScreen && exitFullscreen) exitFullscreen.call(document);
    broadcast({ type: 'peer-left', id: myId });
    participants.forEach(({ conn, call }) => {
      if (conn) conn.close();
      if (call) call.close();
    });
    participants.clear();
    roster.clear();
    if (peer) peer.destroy();
    if (localStream) localStream.getTracks().forEach((t) => t.stop());
    localStream = null;
    previewVideo.srcObject = null;
    videoGrid.innerHTML = '';
    chatLog.innerHTML = '';
    fileLog.innerHTML = '';
    meetingScreen.classList.add('hidden');
    joinScreen.classList.remove('hidden');
    joinForm.querySelector('button[type="submit"]').disabled = false;
    setStatus(joinStatus, '');
    requestLocalMedia();
  }
})();
