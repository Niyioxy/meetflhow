"use strict";

const APP_URL = "https://meetflhow.vercel.app"; // update to your deployed URL

const viewAuth = document.getElementById("view-auth");
const viewConnected = document.getElementById("view-connected");
const lblEmail = document.getElementById("lbl-email");
const lblStatus = document.getElementById("lbl-status");
const btnConnect = document.getElementById("btn-connect");
const btnSaveToken = document.getElementById("btn-save-token");
const tokenInput = document.getElementById("token-input");
const btnDashboard = document.getElementById("btn-dashboard");
const btnDisconnect = document.getElementById("btn-disconnect");
const toggleAutodetect = document.getElementById("toggle-autodetect");

// ── Initialise ────────────────────────────────────────────────────────────────
chrome.storage.local.get(["token", "email", "autodetect"], (data) => {
  if (data.token) {
    showConnected(data.email ?? "");
  } else {
    viewAuth.style.display = "";
    viewConnected.style.display = "none";
  }
  if (data.autodetect !== undefined) toggleAutodetect.checked = data.autodetect;
});

function showConnected(email) {
  viewAuth.style.display = "none";
  viewConnected.style.display = "";
  lblEmail.textContent = email || "Connected";
}

// ── Connect — open auth page with extension ID so it can message us back ─────
btnConnect.addEventListener("click", () => {
  const authUrl = `${APP_URL}/extension/auth?ext=${chrome.runtime.id}`;
  chrome.tabs.create({ url: authUrl });
});

// ── Paste token manually ──────────────────────────────────────────────────────
btnSaveToken.addEventListener("click", () => {
  const t = tokenInput.value.trim();
  if (!t) return;
  chrome.storage.local.set({ token: t, email: "" }, () => {
    showConnected("");
    tokenInput.value = "";
  });
});

// ── Dashboard ─────────────────────────────────────────────────────────────────
btnDashboard.addEventListener("click", () => {
  chrome.tabs.create({ url: `${APP_URL}/dashboard` });
});

// ── Disconnect ────────────────────────────────────────────────────────────────
btnDisconnect.addEventListener("click", () => {
  chrome.storage.local.remove(["token", "email"], () => {
    viewAuth.style.display = "";
    viewConnected.style.display = "none";
  });
});

// ── Autodetect toggle ─────────────────────────────────────────────────────────
toggleAutodetect.addEventListener("change", () => {
  chrome.storage.local.set({ autodetect: toggleAutodetect.checked });
});

// ── Receive token from background (which received it from the auth page) ──────
chrome.storage.onChanged.addListener((changes) => {
  if (changes.token?.newValue) {
    showConnected(changes.email?.newValue ?? "");
  }
  if (changes.token?.newValue === undefined && !changes.token?.newValue) {
    viewAuth.style.display = "";
    viewConnected.style.display = "none";
  }
});
