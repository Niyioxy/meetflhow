/**
 * MeetFlhow content script — injected into Google Meet, Teams, and Zoom.
 * Detects the meeting platform, injects a floating overlay button, and
 * communicates with the background service worker for tab capture.
 */

(function () {
  "use strict";

  // ── Platform detection ─────────────────────────────────────────────────────
  function detectPlatform() {
    const h = location.hostname;
    if (h.includes("meet.google.com")) return "Google Meet";
    if (h.includes("teams.microsoft.com")) return "Microsoft Teams";
    if (h.includes("zoom.us")) return "Zoom";
    return "Unknown";
  }

  function getMeetingTitle() {
    return document.title.replace(/[-|•–—] .*/u, "").trim() || "Meeting";
  }

  // ── Overlay ─────────────────────────────────────────────────────────────────
  let state = "idle"; // idle | recording | processing | done
  let timerInterval = null;
  let elapsedSeconds = 0;

  const overlay = document.createElement("div");
  overlay.id = "meetflhow-overlay";
  overlay.innerHTML = `
    <div id="meetflhow-timer">00:00</div>
    <button id="meetflhow-btn" title="Start recording with MeetFlhow">
      ${micIcon()}
    </button>
    <span id="meetflhow-status"></span>
  `;
  document.body.appendChild(overlay);

  const btn = document.getElementById("meetflhow-btn");
  const timer = document.getElementById("meetflhow-timer");
  const statusEl = document.getElementById("meetflhow-status");

  // ── Drag to reposition ──────────────────────────────────────────────────────
  let dragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  overlay.addEventListener("mousedown", (e) => {
    if (e.target === btn) return;
    dragging = true;
    dragOffsetX = e.clientX - overlay.getBoundingClientRect().left;
    dragOffsetY = e.clientY - overlay.getBoundingClientRect().top;
    e.preventDefault();
  });
  document.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    overlay.style.right = "auto";
    overlay.style.bottom = "auto";
    overlay.style.left = `${e.clientX - dragOffsetX}px`;
    overlay.style.top = `${e.clientY - dragOffsetY}px`;
  });
  document.addEventListener("mouseup", () => { dragging = false; });

  // ── Button click ────────────────────────────────────────────────────────────
  btn.addEventListener("click", () => {
    if (state === "idle") startRecording();
    else if (state === "recording") stopRecording();
  });

  function startRecording() {
    chrome.runtime.sendMessage(
      { type: "START_RECORDING", platform: detectPlatform(), title: getMeetingTitle() },
      (response) => {
        if (chrome.runtime.lastError || !response?.ok) {
          showStatus("Not connected — open the extension popup", 4000);
          return;
        }
        state = "recording";
        overlay.className = "recording";
        btn.innerHTML = stopIcon();
        btn.title = "Stop recording";
        startTimer();
      }
    );
  }

  function stopRecording() {
    state = "processing";
    overlay.className = "processing";
    btn.innerHTML = spinnerIcon();
    btn.title = "Processing…";
    stopTimer();
    statusEl.textContent = "Uploading…";

    chrome.runtime.sendMessage({ type: "STOP_RECORDING" }, (response) => {
      if (chrome.runtime.lastError || !response?.ok) {
        state = "idle";
        overlay.className = "";
        btn.innerHTML = micIcon();
        btn.title = "Start recording with MeetFlhow";
        showStatus("Upload failed", 3000);
        return;
      }
      state = "done";
      overlay.className = "done";
      btn.innerHTML = checkIcon();
      btn.title = "Done — open MeetFlhow to see the analysis";
      statusEl.textContent = "Uploaded ✓";
      setTimeout(resetOverlay, 5000);
    });
  }

  function resetOverlay() {
    state = "idle";
    overlay.className = "";
    btn.innerHTML = micIcon();
    btn.title = "Start recording with MeetFlhow";
    statusEl.textContent = "";
    elapsedSeconds = 0;
    timer.textContent = "00:00";
  }

  function startTimer() {
    elapsedSeconds = 0;
    timerInterval = setInterval(() => {
      elapsedSeconds++;
      const m = String(Math.floor(elapsedSeconds / 60)).padStart(2, "0");
      const s = String(elapsedSeconds % 60).padStart(2, "0");
      timer.textContent = `${m}:${s}`;
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  }

  function showStatus(msg, durationMs) {
    statusEl.textContent = msg;
    statusEl.style.display = "block";
    setTimeout(() => { statusEl.style.display = ""; statusEl.textContent = ""; }, durationMs);
  }

  // ── Listen for state updates from background ────────────────────────────────
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "RECORDING_FAILED") {
      resetOverlay();
      showStatus(msg.error || "Recording failed", 4000);
    }
  });

  // ── SVG icons ───────────────────────────────────────────────────────────────
  function micIcon() {
    return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm-7 9a7 7 0 0 0 14 0h-2a5 5 0 0 1-10 0H5zm7 9v-2a7 7 0 0 0 7-7h-2a5 5 0 0 1-10 0H5a7 7 0 0 0 7 7v2zm-1 2h2v-1h-2v1z"/>
    </svg>`;
  }

  function stopIcon() {
    return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="5" width="14" height="14" rx="2"/>
    </svg>`;
  }

  function spinnerIcon() {
    return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="animation:meetflhow-spin 1s linear infinite">
      <style>@keyframes meetflhow-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}</style>
      <path opacity=".25" d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z"/>
      <path d="M12 2a10 10 0 0 1 10 10h-2a8 8 0 0 0-8-8V2z"/>
    </svg>`;
  }

  function checkIcon() {
    return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
    </svg>`;
  }
})();
