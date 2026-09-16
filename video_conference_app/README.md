# Meetings — Video Conferencing App

A browser-based video conferencing app. Enter a name and a meeting code to join a room where
participants can talk, video chat, message each other, and share files — all peer-to-peer, with
no application server required.

## Features
- **Audio & video** calling between all participants using WebRTC, with mic/camera mute toggles
  and a camera preview before joining
- **Text chat** sent over a WebRTC data channel to everyone currently in the meeting
- **File sharing** (up to 25 MB) — send a file and everyone in the meeting gets a direct download
  link
- **Mesh topology**: the first participant to join a meeting code becomes its lightweight
  directory (introducing new joiners to everyone already present); every participant then holds a
  direct connection to every other participant, so media/chat/files never pass through a central
  server
- **Invite links**: "Copy invite link" puts a URL with `?room=<code>` on the clipboard so others
  can join the same meeting with one click
- Participant list with live join/leave updates

## Run it
This app uses [PeerJS](https://peerjs.com/) (loaded from a CDN) for WebRTC signaling via its free
public cloud broker, so an internet connection is required, along with browser permission to use
the camera and microphone. Open [index.html](index.html) directly in a browser, or serve the
folder locally:

```bash
cd video_conference_app
python3 -m http.server 8000
```

Then open http://localhost:8000 in your browser. To test locally with multiple participants, open
the same meeting code in separate browser tabs, windows, or devices.

## How to use
1. Enter your name and a meeting code (or click **Generate a new code**) and click **Join
   meeting**.
2. Grant camera/microphone permission when prompted — you can still join without it.
3. Use the control bar to mute your mic, stop your camera, open **Chat**, view **People**, share
   **Files**, or **Leave** the meeting.
4. Click **Copy invite link** and send it to others so they can join the same meeting instantly.

## Main files
- `index.html` — join screen and in-meeting layout (video grid, chat/people/files panel, controls)
- `app.js` — PeerJS-based mesh signaling, media/data connection handling, chat, and file transfer
- `styles.css` — layout and visual styling

## Notes & limitations
- Because signaling relies on PeerJS's public broker and media flows directly between browsers,
  very large meetings or participants behind restrictive NATs/firewalls may have trouble
  connecting (no TURN relay is configured).
- Files are transferred in a single data-channel message per recipient and held in memory, so the
  25 MB cap keeps transfers reliable across browsers.
