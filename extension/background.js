/**
 * MeetFlhow background service worker (Manifest V3).
 *
 * Handles tab capture (audio), MediaRecorder chunks, and upload to the
 * MeetFlhow API once recording stops.
 *
 * NOTE (MV3 compatibility): chrome.tabCapture.capture() is deprecated in MV3
 * service workers in Chrome 116+. For production, upgrade to:
 *   1. chrome.tabCapture.getMediaStreamId({ targetTabId }) from the service worker
 *   2. An offscreen document (chrome.offscreen.createDocument) that calls
 *      navigator.mediaDevices.getUserMedia({ audio: { mandatory: { chromeMediaSource: 'tab',
 *      chromeMediaSourceId: streamId } } }) and runs MediaRecorder.
 * This implementation works in development (extension loaded as unpacked) and in
 * older Chrome versions.
 */

"use strict";

const APP_URL = "https://meetflhow.vercel.app"; // update to your deployed URL

let mediaRecorder = null;
let chunks = [];
let activeMeta = null; // { platform, title }

// ── Token: listen for auth messages from the web app ───────────────────────
chrome.runtime.onMessageExternal.addListener((message, _sender, sendResponse) => {
  if (message.type === "AUTH_TOKEN" && message.token) {
    chrome.storage.local.set({ token: message.token, email: message.email ?? "" }, () => {
      sendResponse({ ok: true });
    });
    return true; // keep channel open for async sendResponse
  }
});

// ── Messages from content.js ────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "START_RECORDING") {
    startCapture(sender.tab, message.platform, message.title)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => {
        console.error("MeetFlhow: capture failed", err);
        sendResponse({ ok: false, error: err.message });
      });
    return true;
  }

  if (message.type === "STOP_RECORDING") {
    stopCapture()
      .then(() => sendResponse({ ok: true }))
      .catch((err) => {
        console.error("MeetFlhow: stop failed", err);
        sendResponse({ ok: false, error: err.message });
      });
    return true;
  }
});

async function startCapture(tab, platform, title) {
  const storage = await chrome.storage.local.get(["token"]);
  if (!storage.token) throw new Error("Not authenticated — connect your account first");
  if (mediaRecorder && mediaRecorder.state !== "inactive") throw new Error("Already recording");

  activeMeta = { platform, title: title || tab?.title || "Meeting" };
  chunks = [];

  return new Promise((resolve, reject) => {
    chrome.tabCapture.capture({ audio: true, video: false }, (stream) => {
      if (chrome.runtime.lastError || !stream) {
        reject(new Error(chrome.runtime.lastError?.message ?? "Failed to capture tab audio"));
        return;
      }

      mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      mediaRecorder.onstop = () => uploadRecording(stream);
      mediaRecorder.start(10_000); // chunk every 10 s
      resolve();
    });
  });
}

async function stopCapture() {
  if (!mediaRecorder || mediaRecorder.state === "inactive") {
    throw new Error("No active recording");
  }
  mediaRecorder.stop();
}

async function uploadRecording(stream) {
  // Stop all tracks so the browser releases the tab audio
  stream.getTracks().forEach((t) => t.stop());

  const storage = await chrome.storage.local.get(["token"]);
  if (!storage.token) return notifyFailed("No auth token");

  const blob = new Blob(chunks, { type: "audio/webm" });
  chunks = [];

  const form = new FormData();
  form.append("audio", blob, "recording.webm");
  form.append("platform", activeMeta?.platform ?? "other");
  form.append("title", activeMeta?.title ?? "Meeting");
  form.append("timestamp", new Date().toISOString());

  try {
    const res = await fetch(`${APP_URL}/api/extension/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${storage.token}` },
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? `HTTP ${res.status}`);
    }
  } catch (err) {
    notifyFailed(err.message);
  }
}

function notifyFailed(error) {
  // Tell the active meeting tab that something went wrong
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { type: "RECORDING_FAILED", error }).catch(() => {});
    }
  });
}
