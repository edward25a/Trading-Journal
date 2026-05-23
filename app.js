const STORAGE_KEY = "trading-journal-terminal-v1";
const KNOWLEDGE_STORAGE_KEY = "trading-journal-knowledge-v1";
const DEFAULT_ACCOUNT_BALANCE = 100;

const $ = (selector) => document.querySelector(selector);
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

const state = {
  trades: loadTrades(),
  selectedDate: todayIso(),
  month: todayIso().slice(0, 7),
  capture: "",
  knowledge: loadKnowledge(),
  replayTimer: null,
  marketChartKey: "",
};

const els = {
  monthTitle: $("#monthTitle"),
  monthPicker: $("#monthPicker"),
  prevMonth: $("#prevMonth"),
  nextMonth: $("#nextMonth"),
  todayButton: $("#todayButton"),
  calendarGrid: $("#calendarGrid"),
  totalTrades: $("#totalTrades"),
  monthPnl: $("#monthPnl"),
  winRate: $("#winRate"),
  form: $("#tradeForm"),
  id: $("#tradeId"),
  editorTitle: $("#editorTitle"),
  title: $("#titleInput"),
  date: $("#dateInput"),
  time: $("#timeInput"),
  asset: $("#assetInput"),
  direction: $("#directionInput"),
  setup: $("#setupInput"),
  emotion: $("#emotionInput"),
  entry: $("#entryInput"),
  stop: $("#stopInput"),
  target: $("#targetInput"),
  rr: $("#rrInput"),
  pnl: $("#pnlInput"),
  balance: $("#balanceInput"),
  startingBalance: $("#startingBalanceInput"),
  mistake: $("#mistakeInput"),
  calculatePnlButton: $("#calculatePnlButton"),
  notes: $("#notesInput"),
  captureInput: $("#captureInput"),
  uploadButton: $("#uploadButton"),
  removeCaptureButton: $("#removeCaptureButton"),
  capturePreview: $("#capturePreview"),
  captureCount: $("#captureCount"),
  ocrStatus: $("#ocrStatus"),
  cancelButton: $("#cancelButton"),
  deleteTradeButton: $("#deleteTradeButton"),
  clearJournalButton: $("#clearJournalButton"),
  aiPrompt: $("#aiPromptInput"),
  analyzerTitle: $("#analyzerTitleInput"),
  analyzerDate: $("#analyzerDateInput"),
  analyzerAsset: $("#analyzerAssetInput"),
  copyAnalyzerPromptButton: $("#copyAnalyzerPromptButton"),
  saveAiPromptButton: $("#saveAiPromptButton"),
  applyAiPromptButton: $("#applyAiPromptButton"),
  clearAiPromptButton: $("#clearAiPromptButton"),
  knowledgeCount: $("#knowledgeCount"),
  knowledgeList: $("#knowledgeList"),
  newTradeButton: $("#newTradeButton"),
  tradeChart: $("#tradeChart"),
  chartSymbol: $("#chartSymbol"),
  chartMeta: $("#chartMeta"),
  metricBalance: $("#metricBalance"),
  adjustBalanceButton: $("#adjustBalanceButton"),
  metricPnl: $("#metricPnl"),
  metricUnrealized: $("#metricUnrealized"),
  exportButton: $("#exportButton"),
  timeframeButtons: $("#timeframeButtons"),
  goToButton: $("#goToButton"),
  placeOrderButton: $("#placeOrderButton"),
  terminalStatus: $("#terminalStatus"),
  saveToast: $("#saveToast"),
  agentTitle: $("#agentTitle"),
  agentInsight: $("#agentInsight"),
  processScore: $("#processScore"),
  processLabel: $("#processLabel"),
  profitFactor: $("#profitFactor"),
  profitFactorLabel: $("#profitFactorLabel"),
  maxDrawdown: $("#maxDrawdown"),
  drawdownLabel: $("#drawdownLabel"),
  nextAction: $("#nextAction"),
};

init();

function init() {
  seedIfEmpty();
  repairStoredTrades();
  resetAnalyzerForm();
  bindEvents();
  setMonth(state.month);
  openDate(state.selectedDate);
  render();
}

function bindEvents() {
  els.prevMonth.addEventListener("click", () => shiftMonth(-1));
  els.nextMonth.addEventListener("click", () => shiftMonth(1));
  els.todayButton.addEventListener("click", () => {
    state.selectedDate = todayIso();
    setMonth(todayIso().slice(0, 7));
    openDate(todayIso());
  });
  els.monthPicker.addEventListener("change", () => setMonth(els.monthPicker.value || todayIso().slice(0, 7)));
  els.newTradeButton.addEventListener("click", () => {
    const existing = getDayTrade(state.selectedDate);
    if (existing) {
      fillForm(existing);
      els.ocrStatus.textContent = "Este dia ya tiene una nota. Editala o elige otro dia en el calendario.";
      setStatus("Nota diaria abierta");
      return;
    }
    resetForm(state.selectedDate);
  });
  els.cancelButton.addEventListener("click", () => openDate(state.selectedDate));
  els.uploadButton.addEventListener("click", () => els.captureInput.click());
  els.removeCaptureButton.addEventListener("click", () => {
    state.capture = "";
    renderCapture();
    drawChart(getFormTrade());
  });
  els.captureInput.addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    state.capture = await readImage(file);
    clearExtractedTradeFields();
    renderCapture();
    await analyzeCapture(file);
    saveTrade({ silent: true });
    els.captureInput.value = "";
  });
  els.form.addEventListener("submit", (event) => {
    event.preventDefault();
    saveTrade();
  });
  els.deleteTradeButton.addEventListener("click", deleteSelectedTrade);
  els.clearJournalButton.addEventListener("click", clearJournal);
  els.copyAnalyzerPromptButton.addEventListener("click", copyAnalyzerPrompt);
  els.saveAiPromptButton.addEventListener("click", saveAiPrompt);
  els.applyAiPromptButton.addEventListener("click", applyAiPromptToNotes);
  els.clearAiPromptButton.addEventListener("click", () => {
    resetAnalyzerForm();
    syncPreview();
    setStatus("Datos del analizador limpiados");
  });
  els.calculatePnlButton.addEventListener("click", () => {
    const calculated = calculatePnlFromBalance({ force: true });
    els.pnl.dataset.manual = calculated ? "true" : "";
    syncPreview();
    setStatus(calculated ? "PnL calculado desde balance" : "Balance sin cambio; escribe el PnL cerrado manualmente");
  });
  [els.date, els.time, els.asset, els.direction, els.setup, els.emotion, els.entry, els.stop, els.target, els.pnl, els.balance, els.startingBalance, els.mistake].forEach((input) => {
    input.addEventListener("input", syncPreview);
    input.addEventListener("change", syncPreview);
  });
  els.pnl.addEventListener("input", () => {
    els.pnl.dataset.manual = "true";
  });
  els.balance.addEventListener("input", () => {
    calculatePnlFromBalance();
    syncPreview();
  });
  els.balance.addEventListener("change", () => {
    calculatePnlFromBalance({ force: true });
    syncPreview();
  });
  els.startingBalance.addEventListener("change", () => {
    calculatePnlFromBalance({ force: true });
    syncPreview();
  });
  els.exportButton.addEventListener("click", exportCsv);
  els.adjustBalanceButton.addEventListener("click", adjustAccountBalance);
  els.goToButton.addEventListener("click", goToMoment);
  els.placeOrderButton.addEventListener("click", placeOrderFromChart);
  els.timeframeButtons.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      els.timeframeButtons.querySelectorAll("button").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      setStatus(`Temporalidad ${button.dataset.tf} aplicada`);
      drawChart(getFormTrade());
    });
  });
  document.querySelectorAll("[data-replay]").forEach((button) => {
    button.addEventListener("click", () => handleReplay(button));
  });
}

function render() {
  renderSummary();
  renderCalendar();
  renderCapture();
  renderKnowledge();
  syncPreview();
  renderQuantConsole();
}

function setMonth(value) {
  state.month = value;
  els.monthPicker.value = value;
  const [year, month] = value.split("-").map(Number);
  const date = new Date(year, month - 1, 1);
  const label = date.toLocaleDateString("es", { month: "long", year: "numeric" });
  els.monthTitle.textContent = label.charAt(0).toUpperCase() + label.slice(1);
  renderSummary();
  renderCalendar();
}

function shiftMonth(delta) {
  const [year, month] = state.month.split("-").map(Number);
  const next = new Date(year, month - 1 + delta, 1);
  setMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`);
}

function renderSummary() {
  const monthTrades = state.trades.filter((trade) => trade.date.startsWith(state.month));
  const monthDates = [...new Set(monthTrades.map((trade) => trade.date))];
  const monthPnls = monthDates.map(getDisplayPnlForDate).filter((value) => value !== null);
  const totalPnl = monthPnls.reduce((sum, value) => sum + value, 0);
  const wins = monthPnls.filter((value) => value > 0).length;
  const losses = monthPnls.filter((value) => value < 0).length;
  els.totalTrades.textContent = monthTrades.length;
  els.monthPnl.textContent = money.format(totalPnl);
  els.monthPnl.className = totalPnl >= 0 ? "money-positive" : "money-negative";
  els.winRate.textContent = `${Math.round((wins / Math.max(wins + losses, 1)) * 100)}%`;
  renderQuantConsole();
}

function renderCalendar() {
  const [year, month] = state.month.split("-").map(Number);
  const first = new Date(year, month - 1, 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(year, month - 1, 1 - offset);
  const cells = [];

  for (let index = 0; index < 42; index += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const iso = toIso(date);
    const trades = state.trades.filter((trade) => trade.date === iso);
    const pnl = getDisplayPnlForDate(iso);
    const shot = trades.find((trade) => trade.capture)?.capture || "";
    const isSelected = iso === state.selectedDate;
    cells.push(`
      <button class="day-cell ${date.getMonth() === month - 1 ? "" : "muted"} ${isSelected ? "selected" : ""}" data-date="${iso}" type="button">
        ${shot ? `<img class="day-shot" src="${shot}" alt="Captura del ${iso}" />` : ""}
        <strong>${date.getDate()}</strong>
        ${trades.length ? `<span class="day-count">${trades.length} trade${trades.length > 1 ? "s" : ""}</span>` : ""}
        ${trades.length ? renderDayPnl(pnl) : ""}
      </button>
    `);
  }

  els.calendarGrid.innerHTML = cells.join("");
  els.calendarGrid.querySelectorAll("[data-date]").forEach((button) => {
    button.addEventListener("click", () => openDate(button.dataset.date));
  });
}

function renderDayPnl(pnl) {
  if (pnl === null) return `<span class="day-pnl money-flat">Sin PnL</span>`;
  const klass = pnl > 0 ? "money-positive" : pnl < 0 ? "money-negative" : "money-flat";
  return `<span class="day-pnl ${klass}">${formatCompactMoney(pnl)}</span>`;
}

function openDate(date) {
  state.selectedDate = date;
  if (date.slice(0, 7) !== state.month) setMonth(date.slice(0, 7));
  const trade = getDayTrade(date);
  if (trade) {
    fillForm(trade);
  } else {
    resetForm(date);
  }
  renderCalendar();
  setStatus(`Fecha abierta: ${formatDisplayDate(date)}`);
}

function resetForm(date = todayIso()) {
  state.capture = "";
  els.form.reset();
  els.pnl.dataset.manual = "";
  els.id.value = "";
  els.editorTitle.textContent = "Nuevo registro";
  els.title.value = formatDisplayDate(date);
  els.date.value = date;
  els.time.value = "09:30";
  els.asset.value = "XAUUSD";
  els.direction.value = "long";
  els.setup.value = "SMC liquidity sweep";
  els.emotion.value = "calmado";
  els.pnl.value = "";
  els.balance.value = latestBalance();
  els.startingBalance.value = latestStartingBalance();
  els.mistake.value = "";
  els.ocrStatus.textContent = "Al subir una captura, la web intenta detectar simbolo, fecha, hora y precios.";
  renderCapture();
  syncPreview();
}

function resetAnalyzerForm() {
  if (!els.aiPrompt) return;
  els.aiPrompt.value = "";
  els.analyzerTitle.value = "";
  els.analyzerDate.value = todayIso();
  els.analyzerAsset.value = "XAUUSD";
}

function fillForm(trade) {
  state.capture = trade.capture || "";
  els.pnl.dataset.manual = trade.hasManualPnl ? "true" : "";
  els.id.value = trade.id;
  els.editorTitle.textContent = trade.title || "Trade guardado";
  els.title.value = trade.title || "";
  els.date.value = trade.date || todayIso();
  els.time.value = trade.time || "";
  els.asset.value = trade.asset || "XAUUSD";
  els.direction.value = trade.direction || "long";
  els.setup.value = trade.setup || "SMC liquidity sweep";
  els.emotion.value = trade.emotion || "calmado";
  els.entry.value = trade.entry || "";
  els.stop.value = trade.stop || "";
  els.target.value = trade.target || "";
  els.rr.value = trade.rr || "";
  els.pnl.value = trade.hasManualPnl ? trade.pnl ?? 0 : "";
  els.balance.value = trade.balance || latestBalance();
  els.startingBalance.value = trade.startingBalance || latestStartingBalance();
  els.mistake.value = trade.mistake || "";
  els.notes.value = trade.notes || "";
  renderCapture();
  syncPreview();
}

function getFormTrade() {
  const rr = els.rr.value || calculateRiskReward(els.entry.value, els.stop.value, els.target.value);
  const id = els.id.value || createId();
  const date = els.date.value || todayIso();
  return {
    id,
    title: els.title.value.trim() || formatDisplayDate(date),
    date,
    time: els.time.value,
    asset: els.asset.value.trim().toUpperCase() || "XAUUSD",
    direction: els.direction.value,
    setup: els.setup.value,
    emotion: els.emotion.value,
    entry: number(els.entry.value),
    stop: number(els.stop.value),
    target: number(els.target.value),
    rr,
    pnl: number(els.pnl.value),
    hasManualPnl: String(els.pnl.value).trim() !== "" || els.pnl.dataset.manual === "true",
    balance: number(els.balance.value) || latestBalance(),
    startingBalance: number(els.startingBalance.value) || latestStartingBalance(),
    mistake: els.mistake.value,
    notes: els.notes.value.trim(),
    capture: state.capture,
    updatedAt: new Date().toISOString(),
  };
}

function saveTrade(options = {}) {
  const trade = getFormTrade();
  const index = findSaveIndex(trade);
  if (index >= 0) state.trades[index] = trade;
  else state.trades.push(trade);
  saveTrades();
  state.selectedDate = trade.date;
  setMonth(trade.date.slice(0, 7));
  fillForm(trade);
  renderSummary();
  renderCalendar();
  pulseSavedDay(trade.date);
  showSaveToast(`Guardado: ${money.format(trade.pnl)}`);
  renderQuantConsole();
  renderKnowledge();
  if (!options.silent) {
    els.ocrStatus.textContent = "Trade guardado correctamente.";
    setStatus(`Trade guardado: ${trade.title}`);
  }
}

function deleteSelectedTrade() {
  const trade = getDayTrade(state.selectedDate);
  if (!trade) {
    setStatus("No hay trade para borrar en este dia");
    return;
  }
  if (!confirm(`Borrar el trade de ${formatDisplayDate(trade.date)}?`)) return;
  state.trades = state.trades.filter((item) => item.id !== trade.id);
  saveTrades();
  resetForm(state.selectedDate);
  renderSummary();
  renderCalendar();
  showSaveToast("Trade borrado");
  setStatus("Trade borrado");
}

function clearJournal() {
  if (!confirm("Esto borrara todos los trades guardados en este navegador. Continuar?")) return;
  state.trades = [];
  state.capture = "";
  localStorage.removeItem(STORAGE_KEY);
  resetForm(todayIso());
  setMonth(todayIso().slice(0, 7));
  render();
  showSaveToast("Diario reiniciado");
  setStatus("Diario reiniciado");
}

function saveAiPrompt() {
  const data = tradeAiDataFromInput();
  if (!data) {
    setStatus("Pega primero datos validos del analizador");
    return;
  }
  const date = els.analyzerDate.value || todayIso();
  const asset = els.analyzerAsset.value.trim().toUpperCase() || "XAUUSD";
  const item = {
    id: createId(),
    type: "dashboard",
    date,
    time: "",
    asset,
    setup: "",
    title: els.analyzerTitle.value.trim() || data.fileName?.replace(/\.pdf$/i, "") || `Dashboard ${asset} ${formatDisplayDate(date)}`,
    data,
    summary: summarizeAiData(data),
    createdAt: new Date().toISOString(),
  };
  state.knowledge = [item, ...state.knowledge].slice(0, 80);
  saveKnowledge();
  resetAnalyzerForm();
  renderKnowledge();
  showSaveToast("Guardado en historial");
  setStatus("Datos guardados en historial del analizador");
}

async function copyAnalyzerPrompt() {
  const asset = els.analyzerAsset.value.trim().toUpperCase() || "XAUUSD";
  const date = els.analyzerDate.value || todayIso();
  const prompt = buildAnalyzerPrompt(asset, date);
  try {
    await navigator.clipboard.writeText(prompt);
    showSaveToast("Prompt copiado");
    setStatus("Prompt del analizador copiado");
  } catch {
    els.aiPrompt.value = prompt;
    els.aiPrompt.focus();
    els.aiPrompt.select();
    setStatus("No pude copiar automaticamente; prompt listo para seleccionar");
  }
}

function buildAnalyzerPrompt(asset, date) {
  return `Analiza esta captura o reporte de trading de ${asset} con fecha ${date}.
Devuelve solo un JSON valido, sin explicaciones y sin markdown, usando estas claves:
{
  "fileName": "",
  "pnl": null,
  "trades": null,
  "wins": null,
  "losses": null,
  "winRate": null,
  "grossProfit": null,
  "grossLoss": null,
  "profitFactor": null
}
Usa numeros reales cuando existan. Si un dato no aparece o no estas seguro, deja null.`;
}

function applyAiPromptToNotes() {
  const data = tradeAiDataFromInput();
  if (!data) {
    setStatus("No hay datos validos para aplicar");
    return;
  }
  applyAnalyzerDataToForm(data);
  const summary = summarizeAiData(data);
  const current = els.notes.value.trim();
  els.notes.value = current ? `${current}\n\nDatos PDF: ${summary}` : `Datos PDF: ${summary}`;
  syncPreview();
  setStatus("Datos agregados a notas");
}

function applyAnalyzerDataToForm(data = {}) {
  if (data.pnl !== null && data.pnl !== undefined) {
    els.pnl.value = Number(data.pnl).toFixed(2);
    els.pnl.dataset.manual = "true";
  }
  if (data.fileName && (!els.title.value.trim() || els.title.value === formatDisplayDate(els.date.value || todayIso()))) {
    els.title.value = data.fileName.replace(/\.pdf$/i, "");
  }
  syncPreview();
}

function renderKnowledge() {
  if (!els.knowledgeList) return;
  const entries = state.knowledge.slice(0, 20);
  els.knowledgeCount.textContent = `${state.knowledge.length} dato${state.knowledge.length === 1 ? "" : "s"}`;
  els.knowledgeList.innerHTML = entries.length
    ? entries
        .map(
          (entry) => `
            <article class="knowledge-item">
              <button class="knowledge-open" type="button" data-knowledge-id="${entry.id}">
                <strong>${entry.title || "Analisis"} - ${entry.asset || "XAUUSD"} - ${entry.date}</strong>
                ${renderAiDataPreview(entry.data)}
                <span>${entry.summary}</span>
              </button>
              <button class="knowledge-delete" type="button" data-delete-knowledge-id="${entry.id}">Borrar</button>
            </article>
          `
        )
        .join("")
    : `<p class="empty-knowledge">Todavia no hay datos guardados en el historial del analizador.</p>`;
  els.knowledgeList.querySelectorAll("[data-knowledge-id]").forEach((button) => {
    button.addEventListener("click", () => openKnowledgeItem(button.dataset.knowledgeId));
  });
  els.knowledgeList.querySelectorAll("[data-delete-knowledge-id]").forEach((button) => {
    button.addEventListener("click", () => deleteKnowledgeItem(button.dataset.deleteKnowledgeId));
  });
}

function openKnowledgeItem(id) {
  const entry = state.knowledge.find((item) => item.id === id);
  if (!entry) return;
  els.analyzerTitle.value = entry.title || "";
  els.analyzerDate.value = entry.date || todayIso();
  els.analyzerAsset.value = entry.asset || "XAUUSD";
  els.aiPrompt.value = JSON.stringify(entry.data || {}, null, 2);
  setStatus(`Analisis cargado: ${entry.asset} ${entry.date}`);
}

function deleteKnowledgeItem(id) {
  const entry = state.knowledge.find((item) => item.id === id);
  if (!entry) return;
  if (!confirm(`Borrar este dato del historial de ${entry.asset || "Analizador"} ${entry.date}?`)) return;
  state.knowledge = state.knowledge.filter((item) => item.id !== id);
  saveKnowledge();
  renderKnowledge();
  showSaveToast("Dato borrado");
  setStatus("Dato eliminado del historial");
}

function tradeAiDataFromInput() {
  const text = els.aiPrompt.value.trim();
  if (!text) return null;
  return parseAnalyzerData(text);
}

function parseAnalyzerData(text) {
  const jsonText = extractJsonObject(text);
  if (jsonText) {
    try {
      const parsed = JSON.parse(jsonText);
      return normalizeAnalyzerData(parsed);
    } catch {
      return normalizeAnalyzerData(parseLooseAnalyzerData(jsonText));
    }
  }
  return normalizeAnalyzerData(parseLooseAnalyzerData(text));
}

function extractJsonObject(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return "";
  return text.slice(start, end + 1);
}

function parseLooseAnalyzerData(text) {
  const data = {};
  const patterns = {
    fileName: /["']?fileName["']?\s*[:=]\s*["']([^"']+)["']/i,
    pnl: /["']?pnl["']?\s*[:=]\s*(-?\d+(?:\.\d+)?)/i,
    trades: /["']?trades["']?\s*[:=]\s*(\d+)/i,
    wins: /["']?wins["']?\s*[:=]\s*(\d+|null)/i,
    losses: /["']?losses["']?\s*[:=]\s*(\d+|null)/i,
    winRate: /["']?winRate["']?\s*[:=]\s*(-?\d+(?:\.\d+)?|null)/i,
    grossProfit: /["']?grossProfit["']?\s*[:=]\s*(-?\d+(?:\.\d+)?)/i,
    grossLoss: /["']?grossLoss["']?\s*[:=]\s*(-?\d+(?:\.\d+)?)/i,
    profitFactor: /["']?profitFactor["']?\s*[:=]\s*(-?\d+(?:\.\d+)?|null)/i,
  };
  Object.entries(patterns).forEach(([key, pattern]) => {
    const match = text.match(pattern);
    if (!match) return;
    data[key] = match[1] === "null" ? null : match[1];
  });
  return data;
}

function normalizeAnalyzerData(value = {}) {
  const data = {
    fileName: String(value.fileName || value.filename || "").trim(),
    pnl: nullableNumber(value.pnl),
    trades: nullableNumber(value.trades),
    wins: nullableNumber(value.wins),
    losses: nullableNumber(value.losses),
    winRate: nullableNumber(value.winRate),
    grossProfit: nullableNumber(value.grossProfit),
    grossLoss: nullableNumber(value.grossLoss),
    profitFactor: nullableNumber(value.profitFactor),
  };
  const hasAny = Object.entries(data).some(([key, item]) => key === "fileName" ? Boolean(item) : item !== null);
  return hasAny ? data : null;
}

function nullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function summarizeAiData(data = {}) {
  const parts = [];
  if (data.fileName) parts.push(data.fileName);
  if (data.pnl !== null) parts.push(`PnL ${money.format(data.pnl)}`);
  if (data.trades !== null) parts.push(`${data.trades} trades`);
  if (data.wins !== null || data.losses !== null) parts.push(`${data.wins ?? 0}W/${data.losses ?? 0}L`);
  if (data.winRate !== null) parts.push(`WR ${formatPercentValue(data.winRate)}`);
  if (data.grossProfit !== null) parts.push(`GP ${money.format(data.grossProfit)}`);
  if (data.grossLoss !== null) parts.push(`GL ${money.format(data.grossLoss)}`);
  if (data.profitFactor !== null) parts.push(`PF ${Number(data.profitFactor).toFixed(2)}`);
  return parts.join(" · ") || "Datos del analizador";
}

function renderAiDataPreview(data = {}) {
  const metrics = [
    ["PnL", data.pnl !== null && data.pnl !== undefined ? money.format(data.pnl) : "--"],
    ["Trades", data.trades ?? "--"],
    ["PF", data.profitFactor !== null && data.profitFactor !== undefined ? Number(data.profitFactor).toFixed(2) : "--"],
  ];
  return `<div class="knowledge-metrics">${metrics.map(([label, value]) => `<span><b>${label}</b>${value}</span>`).join("")}</div>`;
}

function formatPercentValue(value) {
  const numeric = number(value);
  return numeric <= 1 && numeric >= -1 ? `${(numeric * 100).toFixed(1)}%` : `${numeric.toFixed(1)}%`;
}

function getDayTrade(date) {
  return state.trades
    .filter((item) => item.date === date)
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0];
}

function getKnowledgeForTrade(trade = {}) {
  const entries = state.knowledge.filter((entry) => entry.tradeId && entry.tradeId === trade.id);
  if (entries.length) return entries;
  return trade.aiData ? [{ data: trade.aiData }] : [];
}

function getAnalyzerDataForTrade(trade = {}) {
  return getKnowledgeForTrade(trade)[0]?.data || null;
}

function getDisplayPnlForDate(date) {
  const trade = getDayTrade(date);
  if (!trade) return 0;
  if (!trade.hasManualPnl) return null;
  const pnl = number(trade.pnl);
  if (pnl !== 0) return pnl;
  return 0;
}

function getPreviousBalanceForDate(date) {
  const trade = getDayTrade(date);
  return getStartingBalanceForTrade(trade);
}

function repairStoredTrades() {
  let changed = false;
  state.trades = state.trades.map((trade) => {
    if (typeof trade.hasManualPnl === "boolean") return trade;
    changed = true;
    return { ...trade, hasManualPnl: number(trade.pnl) !== 0 };
  });
  if (changed) saveTrades();
}

function calculatePnlFromBalance(options = {}) {
  const force = Boolean(options.force);
  const currentBalance = number(els.balance.value);
  if (!currentBalance) return false;
  const currentPnl = number(els.pnl.value);
  if (!force && currentPnl !== 0) return false;
  const previous = getPreviousBalanceForForm();
  const pnl = currentBalance - previous;
  if (Math.abs(pnl) < 0.005) {
    if (force) els.pnl.value = "";
    return false;
  }
  els.pnl.value = pnl.toFixed(2);
  return true;
}

function getPreviousBalanceForForm() {
  return number(els.startingBalance.value) || inferStartingBalance(number(els.balance.value));
}

function getDefaultStartingBalance() {
  const latest = state.trades
    .slice()
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0];
  return inferStartingBalance(number(latest?.balance) || DEFAULT_ACCOUNT_BALANCE);
}

function getStartingBalanceForTrade(trade = {}) {
  return number(trade.startingBalance) || inferStartingBalance(number(trade.balance) || getDefaultStartingBalance());
}

function inferStartingBalance(balance) {
  if (!balance) return DEFAULT_ACCOUNT_BALANCE;
  const bases = [200000, 100000, 50000, 25000, 10000, 5000, 2500, 1000, 500, 100, 50, 25, 10];
  return bases.find((base) => balance >= base) || DEFAULT_ACCOUNT_BALANCE;
}

function findSaveIndex(trade) {
  const idIndex = state.trades.findIndex((item) => item.id === trade.id);
  if (idIndex >= 0) return idIndex;
  return state.trades.findIndex((item) => item.date === trade.date);
}

function renderCapture() {
  els.captureCount.textContent = state.capture ? "1 de 1" : "0 de 1";
  els.removeCaptureButton.style.display = state.capture ? "" : "none";
  els.capturePreview.innerHTML = state.capture
    ? `<img src="${state.capture}" alt="Captura del trade" />`
    : "<span>Agregar captura de pantalla</span>";
}

function clearExtractedTradeFields() {
  [els.entry, els.stop, els.target, els.rr].forEach((input) => {
    input.value = "";
  });
  els.pnl.value = "";
  els.pnl.dataset.manual = "";
  syncPreview();
}

async function analyzeCapture(file) {
  els.ocrStatus.textContent = "Analizando captura...";
  const filenameData = extractTradeData(file.name || "");
  if (Object.values(filenameData).some(Boolean)) applyExtractedData(filenameData, { force: true });

  if (!window.Tesseract?.recognize) {
    els.ocrStatus.textContent = "Captura guardada. OCR no disponible sin internet.";
    return;
  }

  try {
    const variants = await buildOcrVariants(state.capture);
    const texts = [];

    for (const [index, variant] of variants.entries()) {
      const result = await window.Tesseract.recognize(variant.source, "eng", {
        logger(event) {
          if (event.status === "recognizing text") {
            els.ocrStatus.textContent = `Leyendo ${variant.name}... ${Math.round(event.progress * 100)}%`;
          }
        },
        tessedit_char_whitelist:
          "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,:+-/$% ",
      });
      texts.push(result?.data?.text || "");
      const partialData = extractTradeData(texts.join(" "));
      if (hasTradeLevels(partialData) || Number.isFinite(partialData.pnl)) {
        els.ocrStatus.textContent = `Datos detectados en ${variant.name}.`;
        break;
      }
      if (index === variants.length - 1) els.ocrStatus.textContent = "Terminando lectura de captura...";
    }

    const data = extractTradeData(texts.join(" "));
    applyExtractedData(data, { force: true });
    const count = Object.values(data).filter(Boolean).length;
    const foundPnl = Number.isFinite(data.pnl);
    els.ocrStatus.textContent = count
      ? `Captura leida. Datos detectados: ${count}${foundPnl ? " incluyendo PnL" : ""}.`
      : "Captura guardada. Completa manualmente lo que falte.";
    setStatus(foundPnl ? `PnL detectado: ${money.format(data.pnl)}` : count ? `OCR completo: ${count} datos` : "Captura guardada");
  } catch {
    els.ocrStatus.textContent = "Captura guardada. No pude leer el texto automaticamente.";
    setStatus("Captura guardada");
  }
}

function hasTradeLevels(data = {}) {
  return Boolean(data.entry && data.stop && data.target);
}

function extractTradeData(text = "") {
  const clean = normalizeOcrText(text);
  const upper = clean.toUpperCase();
  const data = {};
  const symbol = upper.match(/\b(XAUUSD|XAGUSD|NAS100|US30|SPX500|BTCUSD|ETHUSD|EURUSD|GBPUSD|USDJPY|AUDUSD|USDCAD|USDCHF|NZDUSD)\b/);
  const date = clean.match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](20\d{2})\b/);
  const time = clean.match(/\b([01]?\d|2[0-3])[:.](\d{2})\s*(AM|PM|A\.?\s*M\.?|P\.?\s*M\.?)?\b/i);

  if (symbol) data.asset = symbol[1];
  if (date) data.date = `${date[3]}-${String(date[1]).padStart(2, "0")}-${String(date[2]).padStart(2, "0")}`;
  if (time) data.time = normalizeTime(time);
  if (/\b(SELL|SHORT|VENTA)\b/i.test(clean)) data.direction = "short";
  if (/\b(BUY|LONG|COMPRA)\b/i.test(clean)) data.direction = "long";

  data.entry = findLabeledNumber(clean, ["ENTRY", "ENTRADA", "ENTRAD4", "OPEN", "OPEN PRICE"]);
  data.stop = findLabeledNumber(clean, ["STOP LOSS", "STOP", "SL", "STOP PRICE"]);
  data.target = findLabeledNumber(clean, ["TAKE PROFIT", "TAKEPROFIT", "TARGET", "TP", "T/P", "PRECIO TAKE PROFIT"]);
  data.balance = findLabeledMoney(clean, ["ACCOUNT BALANCE", "BALANCE DE CUENTA", "BALANCE"]);
  data.pnl = findLabeledMoney(clean, ["REALIZED PNL", "REALIZED P/L", "REALIZED", "PNL REALIZADO", "P/L", "PNL", "PROFIT", "GANANCIA", "PERDIDA"]);
  const positionPnl = extractPositionPnl(clean);
  if (Number.isFinite(positionPnl)) data.pnl = positionPnl;

  if (!data.entry || !data.stop || !data.target) {
    const prices = extractCandidatePrices(clean, data.asset);
    if (prices.length >= 3) {
      const cluster = getTightestCluster(prices, 6).sort((a, b) => b - a);
      data.entry = data.entry || cluster[Math.floor(cluster.length / 2)];
      data.target = data.target || (data.direction === "short" ? cluster[cluster.length - 1] : cluster[0]);
      data.stop = data.stop || (data.direction === "short" ? cluster[0] : cluster[cluster.length - 1]);
    }
  }

  return data;
}

async function buildOcrVariants(dataUrl) {
  const image = await loadImage(dataUrl);
  return [
    { name: "imagen completa", source: dataUrl },
    {
      name: "centro de orden",
      source: cropAndEnhance(image, {
        x: 0.18,
        y: 0.12,
        width: 0.7,
        height: 0.78,
        scale: 4,
        mode: "contrast",
      }),
    },
    {
      name: "etiquetas de niveles",
      source: cropAndEnhance(image, {
        x: 0.2,
        y: 0.18,
        width: 0.62,
        height: 0.68,
        scale: 5,
        mode: "contrast",
      }),
    },
    {
      name: "zona de resultado",
      source: cropAndEnhance(image, {
        x: 0,
        y: 0.43,
        width: 0.58,
        height: 0.16,
        scale: 4,
        mode: "blueText",
      }),
    },
    {
      name: "zona de orden",
      source: cropAndEnhance(image, {
        x: 0,
        y: 0.34,
        width: 0.58,
        height: 0.28,
        scale: 3,
        mode: "contrast",
      }),
    },
    {
      name: "panel derecho",
      source: cropAndEnhance(image, {
        x: 0.72,
        y: 0.12,
        width: 0.28,
        height: 0.78,
        scale: 3,
        mode: "contrast",
      }),
    },
  ];
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function cropAndEnhance(image, options) {
  const sourceX = Math.max(0, Math.round(image.width * options.x));
  const sourceY = Math.max(0, Math.round(image.height * options.y));
  const sourceWidth = Math.min(image.width - sourceX, Math.round(image.width * options.width));
  const sourceHeight = Math.min(image.height - sourceY, Math.round(image.height * options.height));
  const scale = options.scale || 3;
  const canvas = document.createElement("canvas");
  canvas.width = sourceWidth * scale;
  canvas.height = sourceHeight * scale;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.imageSmoothingEnabled = false;
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let index = 0; index < data.length; index += 4) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    let value;

    if (options.mode === "blueText") {
      const blueScore = blue * 1.35 + green * 0.65 - red * 0.45;
      value = blueScore > 150 ? 255 : 0;
    } else {
      const gray = red * 0.299 + green * 0.587 + blue * 0.114;
      value = gray > 95 ? 255 : 0;
    }

    data[index] = value;
    data[index + 1] = value;
    data[index + 2] = value;
  }

  context.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}

function applyExtractedData(data, options = {}) {
  const force = Boolean(options.force);
  if (data.asset) els.asset.value = data.asset;
  if (data.date) els.date.value = data.date;
  if (data.time) els.time.value = data.time;
  if (data.direction) els.direction.value = data.direction;
  if (data.entry && (force || !number(els.entry.value))) els.entry.value = data.entry;
  if (data.stop && (force || !number(els.stop.value))) els.stop.value = data.stop;
  if (data.target && (force || !number(els.target.value))) els.target.value = data.target;
  if (data.balance && (force || !number(els.balance.value))) els.balance.value = data.balance;
  if (Number.isFinite(data.pnl) && (force || !number(els.pnl.value))) {
    els.pnl.value = Number(data.pnl).toFixed(2);
    els.pnl.dataset.manual = "true";
  }
  if (!els.title.value.trim() || force) els.title.value = `${els.asset.value || "Trade"} ${els.date.value || todayIso()}`;
  syncPreview();
}

function syncPreview() {
  const trade = getFormTrade();
  els.rr.value = calculateRiskReward(trade.entry, trade.stop, trade.target);
  els.chartSymbol.textContent = trade.asset || "XAUUSD";
  const timeframe = getActiveTimeframe();
  els.chartMeta.textContent = `${trade.title || "Trade"} | ${trade.date || todayIso()} ${trade.time || ""} | ${timeframe}`;
  els.metricBalance.textContent = money.format(trade.balance);
  els.metricPnl.textContent = money.format(trade.pnl);
  els.metricPnl.className = trade.pnl >= 0 ? "money-positive" : "money-negative";
  els.metricUnrealized.textContent = estimateUnrealized(trade);
  drawChart(trade);
  renderQuantConsole(trade);
}

function renderQuantConsole(activeTrade = getFormTrade()) {
  if (!els.agentInsight) return;
  const monthTrades = state.trades
    .filter((trade) => trade.date.startsWith(state.month))
    .filter((trade) => trade.hasManualPnl);
  const allClosed = state.trades.filter((trade) => trade.hasManualPnl).sort((a, b) => a.date.localeCompare(b.date));
  const monthPnl = monthTrades.map((trade) => number(trade.pnl));
  const grossWin = monthPnl.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
  const grossLoss = Math.abs(monthPnl.filter((value) => value < 0).reduce((sum, value) => sum + value, 0));
  const profitFactor = grossLoss ? grossWin / grossLoss : grossWin ? grossWin : 0;
  const drawdown = calculateMaxDrawdown(allClosed);
  const processScore = calculateProcessScore(activeTrade, monthTrades);
  const bestSetup = getBestGroup(monthTrades, "setup");
  const worstMistake = getWorstGroup(monthTrades, "mistake");
  const emotionalLeak = getWorstGroup(monthTrades, "emotion");

  els.processScore.textContent = `${processScore}/100`;
  els.processScore.className = processScore >= 75 ? "money-positive" : processScore >= 50 ? "money-flat" : "money-negative";
  els.processLabel.textContent = processScore >= 75 ? "Disciplina fuerte" : processScore >= 50 ? "Mejorable" : "Riesgo alto";
  els.profitFactor.textContent = profitFactor ? profitFactor.toFixed(2) : "0.00";
  els.maxDrawdown.textContent = money.format(drawdown);
  els.maxDrawdown.className = drawdown > 0 ? "money-negative" : "money-flat";

  els.agentTitle.textContent = monthTrades.length ? `Analisis de ${monthTrades.length} trade${monthTrades.length > 1 ? "s" : ""}` : "Analisis del journal";
  els.agentInsight.textContent = buildAgentInsight(bestSetup, worstMistake, emotionalLeak, activeTrade, monthTrades);
  els.nextAction.textContent = buildNextAction(worstMistake, emotionalLeak, activeTrade, monthTrades);
}

function calculateProcessScore(trade, monthTrades) {
  let score = 40;
  if (trade.entry && trade.stop && trade.target) score += 18;
  if (trade.rr) score += 12;
  if (trade.notes && trade.notes.length >= 25) score += 14;
  if (getKnowledgeForTrade(trade).length) score += 8;
  if (trade.capture) score += 8;
  if (trade.emotion && trade.emotion !== "impulsivo") score += 8;
  const recentMistakes = monthTrades.slice(-5).filter((item) => item.mistake).length;
  score -= recentMistakes * 4;
  return Math.max(0, Math.min(100, score));
}

function calculateMaxDrawdown(trades) {
  let peak = trades[0]?.balance || latestBalance();
  let maxDrawdown = 0;
  trades.forEach((trade) => {
    const balance = number(trade.balance);
    if (!balance) return;
    peak = Math.max(peak, balance);
    maxDrawdown = Math.max(maxDrawdown, peak - balance);
  });
  return maxDrawdown;
}

function getBestGroup(trades, key) {
  const groups = summarizeGroups(trades, key).filter((item) => item.name);
  return groups.sort((a, b) => b.pnl - a.pnl)[0] || null;
}

function getWorstGroup(trades, key) {
  const groups = summarizeGroups(trades, key).filter((item) => item.name);
  return groups.sort((a, b) => a.pnl - b.pnl)[0] || null;
}

function summarizeGroups(trades, key) {
  const map = new Map();
  trades.forEach((trade) => {
    const name = trade[key] || "";
    if (!name) return;
    const current = map.get(name) || { name, count: 0, pnl: 0 };
    current.count += 1;
    current.pnl += number(trade.pnl);
    map.set(name, current);
  });
  return [...map.values()];
}

function buildAgentInsight(bestSetup, worstMistake, emotionalLeak, activeTrade, monthTrades) {
  if (!monthTrades.length) return "Registra trades cerrados para detectar patrones de ejecucion, riesgo y consistencia.";
  const fragments = [];
  if (bestSetup) fragments.push(`Mejor setup: ${bestSetup.name} (${money.format(bestSetup.pnl)}).`);
  if (worstMistake && worstMistake.pnl < 0) fragments.push(`Mayor fuga: ${worstMistake.name} (${money.format(worstMistake.pnl)}).`);
  if (emotionalLeak && emotionalLeak.pnl < 0) fragments.push(`Estado a vigilar: ${emotionalLeak.name}.`);
  if (activeTrade.rr) fragments.push(`Trade activo con RR ${activeTrade.rr}.`);
  return fragments.join(" ") || "Tus datos estan balanceados este mes; sigue clasificando setup, emocion y error.";
}

function buildNextAction(worstMistake, emotionalLeak, activeTrade, monthTrades) {
  if (!monthTrades.length) return "Guarda 5 trades con setup, emocion, captura y notas.";
  if (worstMistake && worstMistake.pnl < 0) return `Antes de entrar, valida tu regla contra: ${worstMistake.name}.`;
  if (emotionalLeak && emotionalLeak.pnl < 0) return `Reduce tamano cuando estes ${emotionalLeak.name}.`;
  if (!activeTrade.notes || activeTrade.notes.length < 25) return "Escribe la razon de entrada y la leccion del trade.";
  return "Mantener plan: repite el setup con mejor expectativa y evita trades fuera de checklist.";
}

function drawChart(trade) {
  const timeframe = getActiveTimeframe();
  const symbol = getTradingViewSymbol(trade.asset || "XAUUSD");
  const interval = getTradingViewInterval(timeframe);
  const chartKey = `${symbol}|${interval}`;
  if (state.marketChartKey === chartKey && els.tradeChart.querySelector("iframe")) return;
  state.marketChartKey = chartKey;
  const params = new URLSearchParams({
    symbol,
    interval,
    theme: "dark",
    style: "1",
    timezone: "Etc/UTC",
    withdateranges: "1",
    hide_side_toolbar: "0",
    allow_symbol_change: "1",
    save_image: "1",
    studies: "[]",
    locale: "es",
  });
  els.tradeChart.innerHTML = `<iframe class="market-frame" title="Grafico real ${symbol}" src="https://s.tradingview.com/widgetembed/?${params.toString()}"></iframe>`;
}

function getTradingViewInterval(timeframe) {
  return { "1m": "1", "3m": "3", "5m": "5", "15m": "15", "1h": "60", "4h": "240" }[timeframe] || "5";
}

function getTradingViewSymbol(asset = "") {
  const key = String(asset).trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const map = {
    XAUUSD: "OANDA:XAUUSD",
    XAGUSD: "OANDA:XAGUSD",
    EURUSD: "OANDA:EURUSD",
    GBPUSD: "OANDA:GBPUSD",
    USDJPY: "OANDA:USDJPY",
    AUDUSD: "OANDA:AUDUSD",
    USDCAD: "OANDA:USDCAD",
    USDCHF: "OANDA:USDCHF",
    NZDUSD: "OANDA:NZDUSD",
    BTCUSD: "COINBASE:BTCUSD",
    ETHUSD: "COINBASE:ETHUSD",
    NAS100: "OANDA:NAS100USD",
    US30: "OANDA:US30USD",
    SPX500: "OANDA:SPX500USD",
  };
  if (map[key]) return map[key];
  if (/^[A-Z]{6}$/.test(key)) return `OANDA:${key}`;
  return key || "OANDA:XAUUSD";
}

function estimateUnrealized(trade) {
  if (!trade.entry || !trade.target || !trade.stop) return money.format(0);
  const reward = Math.abs(trade.target - trade.entry);
  const risk = Math.abs(trade.entry - trade.stop);
  const estimate = reward && risk ? Math.min(reward / Math.max(risk, 1), 3) * Math.max(Math.abs(trade.pnl), 10) * 0.18 : 0;
  return money.format(estimate);
}

function makeCandles(trade) {
  const timeframe = getActiveTimeframe();
  const base = trade.entry || 2650;
  const target = trade.target || (trade.direction === "short" ? base * 0.992 : base * 1.008);
  const stopDistance = Math.abs(base - (trade.stop || base * 0.996)) || base * 0.004;
  let previous = base - stopDistance * 2;
  const count = getCandleCount(timeframe);
  return Array.from({ length: count }, (_, index) => {
    const progress = index / Math.max(count - 1, 1);
    const path = previous * 0.22 + (base + (target - base) * progress) * 0.78;
    const wave = Math.sin(index * 1.4) * stopDistance * 0.65;
    const open = previous;
    const close = path + wave * 0.18;
    const high = Math.max(open, close) + stopDistance * (0.38 + (index % 3) * 0.08);
    const low = Math.min(open, close) - stopDistance * (0.34 + (index % 4) * 0.06);
    previous = close;
    return { open, close, high, low };
  });
}

function calculateRiskReward(entry, stop, target) {
  const risk = Math.abs(number(entry) - number(stop));
  const reward = Math.abs(number(target) - number(entry));
  if (!risk || !reward) return "";
  return `1:${(reward / risk).toFixed(2)}`;
}

function findLabeledNumber(text, labels) {
  const normalized = normalizeOcrText(text);
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const direct = normalized.match(new RegExp(`\\b${escaped}\\b\\s*[:=\\-]?\\s*(-?\\d{1,6}(?:[.,]\\d{1,5})?)`, "i"));
    if (direct) return number(direct[1].replace(",", "."));

    const loose = normalized.match(new RegExp(`\\b${escaped}\\b.{0,36}?(-?\\d{3,6}(?:[.,]\\d{1,5})?)`, "i"));
    if (loose) return number(loose[1].replace(",", "."));
  }
  return 0;
}

function findLabeledMoney(text, labels) {
  const normalized = normalizeOcrText(text);
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const direct = normalized.match(
      new RegExp(`${escaped}\\s*[:=\\-]?\\s*(?:US\\$|USD|\\$)?\\s*(-?\\d{1,6}(?:[,.]\\d{1,3})*(?:[,.]\\d{1,2})?)`, "i")
    );
    if (direct) return parseMoney(direct[1]);

    const loose = normalized.match(
      new RegExp(`${escaped}.{0,28}(?:US\\$|USD|\\$)?\\s*(-?\\d{1,6}(?:[,.]\\d{1,3})*(?:[,.]\\d{1,2})?)`, "i")
    );
    if (loose) return parseMoney(loose[1]);
  }
  return Number.NaN;
}

function extractPositionPnl(text = "") {
  const normalized = normalizeOcrText(text);
  const patterns = [
    /\b(?:BUY|8UY|BÚY|SELL|COMPRA|VENTA)\s+\d+(?:[.,]\d+)?\s*,?\s*([+-]\s*\d{1,6}(?:[.,\s]\d{1,2})?)\s*(?:USD|USO|US0|US\$|\$)\b/i,
    /\b([+-]\s*\d{1,6}(?:[.,\s]\d{1,2})?)\s*(?:USD|USO|US0|US\$|\$)\b/i,
    /\b(?:BUY|8UY|SELL).{0,24}?([+-]\s*\d{1,6}(?:[.,\s]\d{1,2})?)/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) return parseMoney(fixSeparatedDecimal(match[1]));
  }

  return Number.NaN;
}

function fixSeparatedDecimal(value = "") {
  const compact = String(value).trim().replace(/\s+/g, " ");
  const separated = compact.match(/^([+-]?\d{1,6})\s+(\d{1,2})$/);
  if (separated) return `${separated[1]}.${separated[2]}`;
  return compact.replace(/\s+/g, "");
}

function normalizeOcrText(value = "") {
  return String(value)
    .replace(/[|]/g, "I")
    .replace(/[−–—]/g, "-")
    .replace(/\bO(?=\d)/g, "0")
    .replace(/\s+/g, " ")
    .trim();
}

function parseMoney(value = "") {
  const cleaned = String(value).replace(/[^\d,.-]/g, "");
  if (!cleaned) return Number.NaN;
  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");
  if (hasComma && hasDot) {
    const lastComma = cleaned.lastIndexOf(",");
    const lastDot = cleaned.lastIndexOf(".");
    const decimal = lastComma > lastDot ? "," : ".";
    const normalized =
      decimal === ","
        ? cleaned.replace(/\./g, "").replace(",", ".")
        : cleaned.replace(/,/g, "");
    return number(normalized);
  }
  if (hasComma && !hasDot) return number(cleaned.replace(",", "."));
  return number(cleaned);
}

function extractCandidatePrices(text, symbol = "") {
  const cleaned = text
    .replace(/\b\d{1,2}[\/.-]\d{1,2}[\/.-]20\d{2}\b/g, " ")
    .replace(/\b([01]?\d|2[0-3])[:.]\d{2}\b/g, " ");
  const values =
    cleaned
      .match(/\b\d{2,6}(?:[.,]\d{1,5})?\b/g)
      ?.map((value) => number(value.replace(",", ".")))
      .filter((value) => isLikelyPrice(value, symbol)) || [];
  return [...new Set(values)].sort((a, b) => a - b);
}

function isLikelyPrice(value, symbol = "") {
  if (!value || value >= 2020 && value <= 2035) return false;
  const key = String(symbol).toUpperCase();
  if (key.includes("XAU")) return value >= 1000 && value <= 6000;
  if (key.includes("NAS") || key.includes("US30") || key.includes("SPX")) return value >= 1000 && value <= 60000;
  if (key.includes("BTC")) return value >= 10000 && value <= 300000;
  if (/^[A-Z]{6}$/.test(key)) return value >= 0.3 && value <= 300;
  return value >= 0.3 && value <= 100000;
}

function getTightestCluster(values, size) {
  if (values.length <= size) return values;
  let best = values.slice(0, size);
  let bestRange = best[best.length - 1] - best[0];
  for (let index = 1; index <= values.length - size; index += 1) {
    const cluster = values.slice(index, index + size);
    const range = cluster[cluster.length - 1] - cluster[0];
    if (range < bestRange) {
      best = cluster;
      bestRange = range;
    }
  }
  return best;
}

function normalizeTime(match) {
  let hours = number(match[1]);
  const minutes = String(match[2]).padStart(2, "0");
  const suffix = String(match[3] || "").toLowerCase();
  if (suffix.includes("p") && hours < 12) hours += 12;
  if (suffix.includes("a") && hours === 12) hours = 0;
  return `${String(hours).padStart(2, "0")}:${minutes}`;
}

function exportCsv() {
  if (!state.trades.length) {
    setStatus("No hay trades para exportar");
    return;
  }
  const rows = [["Titulo", "Fecha", "Hora", "Simbolo", "Direccion", "Setup", "Estado mental", "Entrada", "Stop", "Take Profit", "RR", "PnL", "Balance actual", "Capital inicial", "Error principal", "Notas", "PDF archivo", "PDF trades", "PDF wins", "PDF losses", "PDF winRate", "PDF grossProfit", "PDF grossLoss", "PDF profitFactor", "PDF pnl"]];
  state.trades.forEach((trade) => {
    const analyzerData = getAnalyzerDataForTrade(trade);
    rows.push([
      trade.title,
      trade.date,
      trade.time,
      trade.asset,
      trade.direction === "short" ? "Venta" : "Compra",
      trade.setup,
      trade.emotion,
      trade.entry,
      trade.stop,
      trade.target,
      trade.rr,
      trade.pnl,
      trade.balance,
      trade.startingBalance,
      trade.mistake,
      trade.notes,
      analyzerData?.fileName || "",
      analyzerData?.trades ?? "",
      analyzerData?.wins ?? "",
      analyzerData?.losses ?? "",
      analyzerData?.winRate ?? "",
      analyzerData?.grossProfit ?? "",
      analyzerData?.grossLoss ?? "",
      analyzerData?.profitFactor ?? "",
      analyzerData?.pnl ?? "",
    ]);
  });
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "diario-trading.csv";
  link.click();
  URL.revokeObjectURL(url);
  setStatus("CSV exportado correctamente");
}

function handleReplay(button) {
  const action = button.dataset.replay;
  if (action === "prev") {
    stopReplay();
    moveReplay(-1);
  }
  if (action === "next") {
    stopReplay();
    moveReplay(1);
  }
  if (action === "play") {
    if (state.replayTimer) {
      stopReplay();
    } else {
      button.textContent = "Pause";
      setStatus("Replay iniciado");
      state.replayTimer = window.setInterval(() => moveReplay(1), 1300);
    }
  }
}

function stopReplay() {
  if (!state.replayTimer) return;
  window.clearInterval(state.replayTimer);
  state.replayTimer = null;
  const playButton = document.querySelector('[data-replay="play"]');
  if (playButton) playButton.textContent = "Play";
  setStatus("Replay pausado");
}

function moveReplay(direction) {
  const dates = getReplayDates();
  const currentIndex = dates.indexOf(state.selectedDate);
  const fallbackIndex = dates.findIndex((date) => date > state.selectedDate);
  const index = currentIndex >= 0 ? currentIndex : Math.max(0, fallbackIndex);
  const nextIndex = Math.max(0, Math.min(dates.length - 1, index + direction));
  const nextDate = dates[nextIndex];
  if (!nextDate) return;
  openDate(nextDate);
  setStatus(`Replay: ${formatDisplayDate(nextDate)}`);
}

function getReplayDates() {
  const tradeDates = state.trades.map((trade) => trade.date);
  const monthDates = [];
  const [year, month] = state.month.split("-").map(Number);
  const days = new Date(year, month, 0).getDate();
  for (let day = 1; day <= days; day += 1) {
    monthDates.push(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  }
  return [...new Set([...tradeDates, ...monthDates])].sort();
}

function goToMoment() {
  const current = `${els.date.value || todayIso()} ${els.time.value || "09:30"}`;
  const value = prompt("Escribe fecha y hora para ir al trade. Formato: YYYY-MM-DD HH:MM", current);
  if (!value) return;
  const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})(?:\s+([0-2]?\d:\d{2}))?$/);
  if (!match) {
    setStatus("Formato invalido. Usa YYYY-MM-DD HH:MM");
    return;
  }
  const date = match[1];
  const time = match[2] || els.time.value || "09:30";
  openDate(date);
  els.time.value = time;
  state.selectedDate = date;
  syncPreview();
  setStatus(`Go To: ${date} ${time}`);
}

function placeOrderFromChart() {
  const trade = getFormTrade();
  const base = trade.entry || getSmartBasePrice(trade.asset);
  const direction = trade.direction || "long";
  const risk = base * getRiskFactor(getActiveTimeframe());
  const entry = trade.entry || base;
  const stop = trade.stop || (direction === "short" ? entry + risk : entry - risk);
  const target = trade.target || (direction === "short" ? entry - risk * 2 : entry + risk * 2);

  els.entry.value = roundPrice(entry);
  els.stop.value = roundPrice(stop);
  els.target.value = roundPrice(target);
  if (!els.title.value.trim()) els.title.value = `${trade.asset || "XAUUSD"} orden ${formatDisplayDate(els.date.value || todayIso())}`;
  syncPreview();
  setStatus("Orden preparada en el formulario");
  document.querySelector(".note-editor")?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function adjustAccountBalance() {
  const current = number(els.balance.value) || DEFAULT_ACCOUNT_BALANCE;
  const value = prompt("Escribe tu balance actual", current.toFixed(2));
  if (value === null) return;
  const balance = number(value);
  if (!balance || balance < 0) {
    setStatus("Balance invalido");
    return;
  }
  els.balance.value = balance.toFixed(2);
  if (!number(els.startingBalance.value) || [10000, 5000, DEFAULT_ACCOUNT_BALANCE].includes(number(els.startingBalance.value))) {
    els.startingBalance.value = balance.toFixed(2);
  }
  calculatePnlFromBalance({ force: true });
  syncPreview();
  setStatus("Balance ajustado. Pulsa Guardar para dejarlo fijo en el trade.");
}

function getActiveTimeframe() {
  return els.timeframeButtons.querySelector(".active")?.dataset.tf || "5m";
}

function getCandleCount(timeframe) {
  return { "1m": 42, "3m": 34, "5m": 28, "15m": 24, "1h": 18, "4h": 14 }[timeframe] || 28;
}

function getCandleStep(timeframe) {
  return { "1m": 27, "3m": 33, "5m": 41, "15m": 48, "1h": 64, "4h": 82 }[timeframe] || 41;
}

function getRiskFactor(timeframe) {
  return { "1m": 0.0009, "3m": 0.0012, "5m": 0.0015, "15m": 0.0022, "1h": 0.0035, "4h": 0.006 }[timeframe] || 0.0015;
}

function getSmartBasePrice(asset = "") {
  const key = String(asset).toUpperCase();
  if (key.includes("XAU")) return 2650;
  if (key.includes("NAS")) return 18450;
  if (key.includes("US30")) return 39000;
  if (key.includes("BTC")) return 68000;
  if (/^[A-Z]{6}$/.test(key)) return 1.085;
  return 2650;
}

function roundPrice(value) {
  const decimals = Math.abs(value) < 10 ? 5 : 2;
  return Number(value).toFixed(decimals);
}

function pulseSavedDay(date) {
  requestAnimationFrame(() => {
    const button = els.calendarGrid.querySelector(`[data-date="${date}"]`);
    if (!button) return;
    button.classList.remove("saved-pulse");
    void button.offsetWidth;
    button.classList.add("saved-pulse");
  });
}

function setStatus(message) {
  if (!els.terminalStatus) return;
  els.terminalStatus.textContent = message;
  els.terminalStatus.classList.remove("status-pulse");
  void els.terminalStatus.offsetWidth;
  els.terminalStatus.classList.add("status-pulse");
}

function showSaveToast(message) {
  if (!els.saveToast) return;
  els.saveToast.textContent = message;
  els.saveToast.classList.remove("visible");
  void els.saveToast.offsetWidth;
  els.saveToast.classList.add("visible");
  window.setTimeout(() => els.saveToast.classList.remove("visible"), 2200);
}

function seedIfEmpty() {
  if (state.trades.length) return;
  const today = todayIso();
  state.trades = [
    {
      id: createId(),
      title: "Trade ejemplo",
      date: today,
      time: "09:30",
      asset: "XAUUSD",
      direction: "long",
      setup: "SMC liquidity sweep",
      emotion: "calmado",
      entry: 2650.49,
      stop: 2660.53,
      target: 2647.44,
      rr: "1:2.02",
      pnl: 4.07,
      hasManualPnl: true,
      balance: 104.07,
      startingBalance: DEFAULT_ACCOUNT_BALANCE,
      mistake: "",
      notes: "Ejemplo visual. Sube una captura real para reemplazarlo.",
      aiData: null,
      aiPrompt: "",
      capture: "",
      updatedAt: new Date().toISOString(),
    },
  ];
  saveTrades();
}

function latestBalance() {
  if (!state.trades.length) return DEFAULT_ACCOUNT_BALANCE;
  const latest = state.trades.slice().sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0];
  return number(latest.balance) || DEFAULT_ACCOUNT_BALANCE;
}

function latestStartingBalance() {
  const latest = state.trades
    .slice()
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
    .find((trade) => number(trade.startingBalance));
  return number(latest?.startingBalance) || inferStartingBalance(latestBalance()) || DEFAULT_ACCOUNT_BALANCE;
}

function loadTrades() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveTrades() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.trades));
}

function loadKnowledge() {
  try {
    const data = JSON.parse(localStorage.getItem(KNOWLEDGE_STORAGE_KEY)) || [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveKnowledge() {
  localStorage.setItem(KNOWLEDGE_STORAGE_KEY, JSON.stringify(state.knowledge));
}

function readImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function createId() {
  return window.crypto?.randomUUID ? crypto.randomUUID() : `trade-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function todayIso() {
  return toIso(new Date());
}

function toIso(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDisplayDate(value) {
  const date = parseDate(value);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function parseDate(value) {
  const [year, month, day] = String(value || todayIso()).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function number(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
}

function formatPrice(value) {
  return number(value) ? number(value).toFixed(2) : "--";
}

function formatCompactMoney(value) {
  const sign = value > 0 ? "+" : "";
  if (Math.abs(value) >= 1000) return `${sign}${(value / 1000).toFixed(1)}k`;
  return `${sign}${money.format(value).replace(".00", "")}`;
}
