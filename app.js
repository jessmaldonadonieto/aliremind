const $ = (selector) => document.querySelector(selector);
const SEND_ENDPOINT = window.ALIREMIND_SEND_ENDPOINT || "./api/reminders";
const recordButton = $("#record-button"), recordTitle = $("#record-title"), recordHint = $("#record-hint");
const composeCard = $("#compose-card"), reminderText = $("#reminder-text"), subject = $("#subject"), sendButton = $("#send-button");
const settingsDialog = $("#settings-dialog"), defaultEmail = $("#default-email"), confirmSend = $("#confirm-send"), historyList = $("#history-list"), toast = $("#toast");
const welcomeDialog = $("#welcome-dialog"), welcomeEmail = $("#welcome-email"), installButton = $("#install-button");
let recognition, mediaRecorder, audioStream, isRecording = false;
const prefs = () => JSON.parse(localStorage.getItem("susurro-preferences") || '{"email":"","confirm":true}');
const setPrefs = (value) => localStorage.setItem("susurro-preferences", JSON.stringify(value));
const history = () => JSON.parse(localStorage.getItem("susurro-history") || "[]");
const setHistory = (value) => localStorage.setItem("susurro-history", JSON.stringify(value));
const showToast = (message) => { toast.textContent = message; toast.classList.add("show"); setTimeout(() => toast.classList.remove("show"), 3300); };
const dateLabel = () => new Intl.DateTimeFormat("es-ES", { dateStyle:"medium", timeStyle:"short" }).format(new Date());

function renderHistory() {
  const items = history();
  historyList.innerHTML = items.length ? items.map(item => `<article class="history-item"><span class="history-icon">✉</span><div class="history-copy"><p>${escapeHTML(item.text)}</p><small>${item.date}</small></div></article>`).join("") : '<p class="empty">Aún no has enviado ningún recordatorio.</p>';
}
function escapeHTML(text) { const div = document.createElement("div"); div.textContent = text; return div.innerHTML; }
function prepareDraft(text = "") {
  composeCard.classList.remove("hidden"); reminderText.value = text.trim(); subject.value = `Recordatorio · ${dateLabel()}`; reminderText.focus();
}
function webSpeech() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return null;
  const instance = new SpeechRecognition(); instance.lang = "es-ES"; instance.continuous = true; instance.interimResults = true;
  let finalText = "";
  instance.onresult = event => { let interim = ""; for (let i = event.resultIndex; i < event.results.length; i++) event.results[i].isFinal ? finalText += event.results[i][0].transcript + " " : interim += event.results[i][0].transcript; reminderText.value = finalText + interim; };
  instance.onerror = () => { recordHint.textContent = "Puedes escribir el mensaje manualmente"; };
  return instance;
}
async function startRecording() {
  try {
    audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(audioStream); mediaRecorder.start();
    recognition = webSpeech(); recognition?.start();
    isRecording = true; recordButton.classList.add("recording"); recordButton.innerHTML = "■"; recordTitle.textContent = "Grabando… pulsa cuando termines"; recordHint.textContent = "Estamos preparando tu recordatorio"; prepareDraft("");
  } catch { showToast("Necesitamos permiso para usar el micrófono."); }
}
function stopRecording() {
  mediaRecorder?.stop(); audioStream?.getTracks().forEach(track => track.stop()); recognition?.stop();
  isRecording = false; recordButton.classList.remove("recording"); recordButton.innerHTML = '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="16" y="7" width="16" height="25" rx="8" fill="currentColor"/><path d="M10 25c0 8 6 14 14 14s14-6 14-14M24 39v6m-8 0h16" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>'; recordTitle.textContent = "Tu mensaje está listo para revisar"; recordHint.textContent = "Edita el texto si lo necesitas";
  setTimeout(() => { if (!reminderText.value.trim()) { recordHint.textContent = "No pudimos transcribirlo. Puedes escribirlo ahora."; reminderText.focus(); } }, 700);
}
recordButton.addEventListener("click", () => isRecording ? stopRecording() : startRecording());

$("#settings-button").addEventListener("click", () => { const p = prefs(); defaultEmail.value = p.email; confirmSend.checked = p.confirm; settingsDialog.showModal(); });
$("#settings-form").addEventListener("submit", event => { event.preventDefault(); if (!defaultEmail.checkValidity()) return defaultEmail.reportValidity(); setPrefs({ email:defaultEmail.value.trim(), confirm:confirmSend.checked }); settingsDialog.close(); showToast("Ajustes guardados."); });
$("#welcome-form").addEventListener("submit", event => { event.preventDefault(); if (!welcomeEmail.checkValidity()) return welcomeEmail.reportValidity(); setPrefs({ email:welcomeEmail.value.trim(), confirm:true }); welcomeDialog.close(); showToast("Listo. Ya puedes grabar tu primer recordatorio. ✦"); });
$("#clear-history").addEventListener("click", () => { setHistory([]); renderHistory(); });

sendButton.addEventListener("click", async () => {
  const p = prefs(), text = reminderText.value.trim(), title = subject.value.trim();
  if (!text) return showToast("Escribe o dicta un recordatorio.");
  if (!p.email) { $("#settings-button").click(); return showToast("Primero indica tu email predeterminado."); }
  if (p.confirm && !confirm(`¿Enviar este recordatorio a ${p.email}?`)) return;
  sendButton.disabled = true; sendButton.textContent = "Enviando…";
  try {
    const request = { to:p.email, subject:title, text };
    if (window.ALIREMIND_SEND_ENDPOINT) {
      await fetch(SEND_ENDPOINT, { method:"POST", mode:"no-cors", headers:{"content-type":"text/plain"}, body:JSON.stringify(request) });
      var data = { configured:true };
    } else {
      const response = await fetch(SEND_ENDPOINT, { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify(request) });
      data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo enviar el recordatorio.");
    }
    if (data.configured) { setHistory([{ text, date:dateLabel() }, ...history()].slice(0,30)); renderHistory(); reminderText.value = ""; composeCard.classList.add("hidden"); showToast("Recordatorio enviado. ✦"); }
    else { window.location.href = `mailto:${encodeURIComponent(p.email)}?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text)}`; showToast("Abrimos tu correo para enviarlo."); }
  } catch (error) { showToast(error.message || "No se pudo enviar. Prueba de nuevo."); }
  finally { sendButton.disabled = false; sendButton.innerHTML = "Enviar recordatorio <span>→</span>"; }
});

let installPrompt;
window.addEventListener("beforeinstallprompt", event => { event.preventDefault(); installPrompt = event; installButton.classList.remove("hidden"); });
installButton.addEventListener("click", async () => { if (installPrompt) { installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; installButton.classList.add("hidden"); } else { showToast("En Safari: Compartir → Añadir a pantalla de inicio."); } });
window.addEventListener("appinstalled", () => { installButton.classList.add("hidden"); showToast("AliRemind ya está instalada. ✦"); });
if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("./service-worker.js?v=3");
renderHistory();
if (!prefs().email) welcomeDialog.showModal();
