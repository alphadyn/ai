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

  const roomLabel = document.getElementById('roomLabel');
  const copyLinkBtn = document.getElementById('copyLinkBtn');
  const connectionStatus = document.getElementById('connectionStatus');
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
  const peopleCount = document.getElementById('peopleCount');
  const leaveBtn = document.getElementById('leaveBtn');

  // ---- State ------------------------------------------------------------
  let localStream = null;
  let peer = null;
  let myId = null;
  let myName = '';
  let isHost = false;
  let hostPeerId = '';
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

  // ---- Local media preflight ---------------------------------------------
  async function acquireLocalStream() {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } catch (err) {
      try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        setStatus(previewStatus, 'Camera unavailable — joining with audio only.');
      } catch (err2) {
        localStream = new MediaStream();
        setStatus(previewStatus, 'Microphone and camera are unavailable. You can still join and use chat/files.');
      }
    }
    previewVideo.srcObject = localStream;
    return localStream;
  }

  function toggleTrack(kind, btn) {
    if (!localStream) return;
    const tracks = kind === 'audio' ? localStream.getAudioTracks() : localStream.getVideoTracks();
    if (!tracks.length) return;
    const enabled = !tracks[0].enabled;
    tracks.forEach((t) => { t.enabled = enabled; });
    btn.classList.toggle('is-on', enabled);
    btn.setAttribute('aria-pressed', String(enabled));
  }

  previewMicBtn.addEventListener('click', () => toggleTrack('audio', previewMicBtn));
  previewCamBtn.addEventListener('click', () => toggleTrack('video', previewCamBtn));

  acquireLocalStream();

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
      setStatus(joinStatus, 'Could not connect. Please try again.');
      joinForm.querySelector('button[type="submit"]').disabled = false;
    });
  });

  async function startMeeting(room) {
    hostPeerId = HOST_PREFIX + room;
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
      conn.send({ type: 'hello', name: myName, id: myId });
    });

    conn.on('data', (msg) => handleMessage(conn.peer, msg));

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
            conn.send({ type: 'roster', peers });
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
      if (conn && conn.open && !excludeIds.includes(id)) conn.send(message);
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
          conn.send(meta);
          conn.send({ type: 'file-chunk', id: fileId, buffer });
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
    broadcast({ type: 'peer-left', id: myId });
    participants.forEach(({ conn, call }) => {
      if (conn) conn.close();
      if (call) call.close();
    });
    participants.clear();
    roster.clear();
    if (peer) peer.destroy();
    if (localStream) localStream.getTracks().forEach((t) => t.stop());
    videoGrid.innerHTML = '';
    chatLog.innerHTML = '';
    fileLog.innerHTML = '';
    meetingScreen.classList.add('hidden');
    joinScreen.classList.remove('hidden');
    joinForm.querySelector('button[type="submit"]').disabled = false;
    setStatus(joinStatus, '');
    acquireLocalStream();
  }
})();
