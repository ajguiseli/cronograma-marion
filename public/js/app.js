/* ═══════════════════════════════════════════
   STATE
═══════════════════════════════════════════ */
const state = {
  done: JSON.parse(localStorage.getItem("marion_done") || "{}"),
  filter: "all",
  chapters: null,
  charts: {},
};

function persist() {
  localStorage.setItem("marion_done", JSON.stringify(state.done));
}

/* ═══════════════════════════════════════════
   FETCH DATA
═══════════════════════════════════════════ */
async function init() {
  const res = await fetch("/api/chapters");
  state.chapters = await res.json();
  buildCronograma();
  buildFormulas();
  buildDashboard();
  updateProgress();
}

/* ═══════════════════════════════════════════
   CRONOGRAMA VIEW
═══════════════════════════════════════════ */
function buildCronograma() {
  const grid = document.getElementById("chapterGrid");
  grid.innerHTML = "";

  for (const [key, ch] of Object.entries(state.chapters)) {
    const col = document.createElement("div");
    col.className = `chapter-col ${key}`;
    col.innerHTML = `
      <div class="chapter-col-header">
        <div class="ch-icon ${key === "cap6" ? "blue" : "purple"}">${ch.icon}</div>
        <div class="ch-meta">
          <div class="ch-num">Capítulo ${ch.number}</div>
          <div class="ch-name">${ch.title}</div>
          <div class="ch-progress-bar">
            <div class="ch-progress-fill" id="fill-${key}"
                 style="background:${ch.color}; width:0%"></div>
          </div>
        </div>
      </div>
      <div class="timeline" id="tl-${key}"></div>
    `;
    grid.appendChild(col);

    const tl = col.querySelector(`#tl-${key}`);
    ch.topics.forEach((t, i) => {
      const card = buildCard(t, key, i);
      tl.appendChild(card);
    });
  }

  updateChapterBars();
}

function buildCard(topic, capKey, idx) {
  const isDone = !!state.done[topic.id];
  const div = document.createElement("div");
  div.className = `topic-card${isDone ? " done" : ""}`;
  div.dataset.id = topic.id;
  div.dataset.cap = capKey;
  div.dataset.diff = topic.difficulty;
  div.style.animationDelay = `${idx * 40}ms`;

  const diffLabel = { easy: "Fácil", medium: "Médio", hard: "Difícil" }[topic.difficulty];
  const formulaHtml = topic.formula
    ? `<div class="formula-box">${topic.formula}</div>`
    : "";

  div.innerHTML = `
    <div class="card-header">
      <button class="check-btn" aria-label="Marcar concluído">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
             stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </button>
      <div class="card-title">${topic.title}</div>
      <span class="diff-badge diff-${topic.difficulty}">${diffLabel}</span>
    </div>
    <div class="card-meta">
      <span class="meta-pill">⏱ ${topic.hours}h</span>
      <span class="meta-pill">§ ${topic.section}</span>
    </div>
    <div class="card-body" id="body-${topic.id}">
      <div class="card-body-inner">
        <p class="card-desc">${topic.desc}</p>
        <ul class="subtopics-list">
          ${topic.subtopics.map(s => `<li>${s}</li>`).join("")}
        </ul>
        ${formulaHtml}
      </div>
    </div>
  `;

  div.querySelector(".check-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    toggleDone(topic.id, div);
  });

  div.addEventListener("click", () => toggleExpand(topic.id));
  return div;
}

function toggleDone(id, card) {
  state.done[id] = !state.done[id];
  persist();
  card.classList.toggle("done", !!state.done[id]);
  updateProgress();
  updateChapterBars();
  applyFilter();
  refreshDashboardCharts();
}

function toggleExpand(id) {
  const body = document.getElementById(`body-${id}`);
  const isOpen = body.classList.contains("open");
  document.querySelectorAll(".card-body.open").forEach(b => b.classList.remove("open"));
  if (!isOpen) body.classList.add("open");
}

/* ── Filters ── */
document.querySelectorAll(".filt").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".filt").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    state.filter = btn.dataset.f;
    applyFilter();
  });
});

function applyFilter() {
  const f = state.filter;
  document.querySelectorAll(".topic-card").forEach(card => {
    const cap  = card.dataset.cap;
    const id   = card.dataset.id;
    const diff = card.dataset.diff;
    const done = !!state.done[id];

    let show = true;
    if (f === "cap6"    && cap !== "cap6")   show = false;
    if (f === "cap7"    && cap !== "cap7")   show = false;
    if (f === "done"    && !done)            show = false;
    if (f === "pending" && done)             show = false;
    if (["easy","medium","hard"].includes(f) && diff !== f) show = false;

    card.classList.toggle("hidden", !show);
  });
}

function updateChapterBars() {
  if (!state.chapters) return;
  for (const key of Object.keys(state.chapters)) {
    const total = state.chapters[key].topics.length;
    const done  = state.chapters[key].topics.filter(t => state.done[t.id]).length;
    const el = document.getElementById(`fill-${key}`);
    if (el) el.style.width = `${total ? (done / total) * 100 : 0}%`;
  }
}

/* ═══════════════════════════════════════════
   PROGRESS RING (sidebar)
═══════════════════════════════════════════ */
let ringChart = null;

function updateProgress() {
  if (!state.chapters) return;
  let total = 0, done = 0;
  for (const ch of Object.values(state.chapters)) {
    total += ch.topics.length;
    done  += ch.topics.filter(t => state.done[t.id]).length;
  }
  const pct = total ? Math.round((done / total) * 100) : 0;

  document.getElementById("ringPct").textContent = pct + "%";
  document.getElementById("spSub").textContent   = `${done} / ${total} tópicos`;

  const canvas = document.getElementById("ringChart");
  const data   = [done, total - done];
  const colors = ["#4f8ef7", "#1f2540"];

  if (!ringChart) {
    ringChart = new Chart(canvas, {
      type: "doughnut",
      data: {
        datasets: [{ data, backgroundColor: colors, borderWidth: 0, hoverOffset: 4 }],
      },
      options: {
        cutout: "76%",
        animation: { duration: 600 },
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
      },
    });
  } else {
    ringChart.data.datasets[0].data = data;
    ringChart.update("none");
  }
}

/* ═══════════════════════════════════════════
   DASHBOARD
═══════════════════════════════════════════ */
function buildDashboard() {
  buildBarChart();
  buildDoughnutCharts();
  buildHoursChart();
  buildStatsList();
}

function refreshDashboardCharts() {
  if (state.charts.bar) updateBarChart();
  buildStatsList();
}

function buildBarChart() {
  const ctx = document.getElementById("barChart");
  if (!state.chapters) return;

  const labels = [];
  const doneCounts = [];
  const totalCounts = [];
  const bgColors = [];

  for (const [key, ch] of Object.entries(state.chapters)) {
    ch.topics.forEach(t => {
      labels.push(t.title.length > 28 ? t.title.slice(0, 26) + "…" : t.title);
      doneCounts.push(state.done[t.id] ? t.hours : 0);
      totalCounts.push(t.hours);
      bgColors.push(key === "cap6" ? "rgba(79,142,247,.8)" : "rgba(162,89,247,.8)");
    });
  }

  state.charts.bar = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Concluído",
          data: doneCounts,
          backgroundColor: bgColors,
          borderRadius: 4,
          borderSkipped: false,
        },
        {
          label: "Restante",
          data: totalCounts.map((t, i) => t - doneCounts[i]),
          backgroundColor: "rgba(255,255,255,.06)",
          borderRadius: 4,
          borderSkipped: false,
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      indexAxis: "y",
      scales: {
        x: {
          stacked: true,
          grid: { color: "rgba(255,255,255,.05)" },
          ticks: { color: "#6b7799", font: { size: 10 } },
        },
        y: {
          stacked: true,
          grid: { display: false },
          ticks: { color: "#8b9dc4", font: { size: 10 }, maxTicksLimit: 16 },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#181d30",
          borderColor: "#252d4a",
          borderWidth: 1,
          titleColor: "#e2e8f8",
          bodyColor: "#6b7799",
        },
      },
    },
  });
}

function updateBarChart() {
  if (!state.charts.bar || !state.chapters) return;
  let i = 0;
  for (const ch of Object.values(state.chapters)) {
    ch.topics.forEach(t => {
      const done = state.done[t.id] ? t.hours : 0;
      state.charts.bar.data.datasets[0].data[i] = done;
      state.charts.bar.data.datasets[1].data[i] = t.hours - done;
      i++;
    });
  }
  state.charts.bar.update("none");
}

function buildDoughnutCharts() {
  const caps = [
    { id: "doughCap6", key: "cap6", color: "#4f8ef7" },
    { id: "doughCap7", key: "cap7", color: "#a259f7" },
  ];
  caps.forEach(({ id, key, color }) => {
    const ch = state.chapters[key];
    const counts = [
      ch.topics.filter(t => t.difficulty === "easy").length,
      ch.topics.filter(t => t.difficulty === "medium").length,
      ch.topics.filter(t => t.difficulty === "hard").length,
    ];
    new Chart(document.getElementById(id), {
      type: "doughnut",
      data: {
        labels: ["Fácil", "Médio", "Difícil"],
        datasets: [{
          data: counts,
          backgroundColor: ["#22d47a", "#f7a935", "#f76059"],
          borderWidth: 0,
          hoverOffset: 6,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        cutout: "65%",
        plugins: {
          legend: {
            position: "bottom",
            labels: { color: "#8b9dc4", font: { size: 10 }, padding: 14, boxWidth: 10 },
          },
          tooltip: {
            backgroundColor: "#181d30",
            borderColor: "#252d4a", borderWidth: 1,
            titleColor: "#e2e8f8", bodyColor: "#6b7799",
          },
        },
      },
    });
  });
}

function buildHoursChart() {
  if (!state.chapters) return;
  const labels = [], data6 = [], data7 = [];

  const maxLen = Math.max(
    state.chapters.cap6.topics.length,
    state.chapters.cap7.topics.length
  );
  for (let i = 0; i < maxLen; i++) {
    labels.push(`T${i + 1}`);
    data6.push(state.chapters.cap6.topics[i]?.hours ?? null);
    data7.push(state.chapters.cap7.topics[i]?.hours ?? null);
  }

  new Chart(document.getElementById("hoursChart"), {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Cap. 6",
          data: data6,
          borderColor: "#4f8ef7",
          backgroundColor: "rgba(79,142,247,.12)",
          fill: true,
          tension: .4,
          pointBackgroundColor: "#4f8ef7",
          pointRadius: 5,
        },
        {
          label: "Cap. 7",
          data: data7,
          borderColor: "#a259f7",
          backgroundColor: "rgba(162,89,247,.12)",
          fill: true,
          tension: .4,
          pointBackgroundColor: "#a259f7",
          pointRadius: 5,
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { grid: { color: "rgba(255,255,255,.05)" }, ticks: { color: "#6b7799", font: { size: 10 } } },
        y: {
          grid: { color: "rgba(255,255,255,.05)" },
          ticks: { color: "#6b7799", font: { size: 10 }, stepSize: 1 },
          title: { display: true, text: "horas", color: "#6b7799", font: { size: 10 } },
        },
      },
      plugins: {
        legend: {
          labels: { color: "#8b9dc4", font: { size: 10 }, padding: 14, boxWidth: 10 },
        },
        tooltip: {
          backgroundColor: "#181d30", borderColor: "#252d4a", borderWidth: 1,
          titleColor: "#e2e8f8", bodyColor: "#6b7799",
        },
      },
    },
  });
}

function buildStatsList() {
  if (!state.chapters) return;
  const el = document.getElementById("statsList");
  let total = 0, doneCount = 0, totalHours = 0, doneHours = 0;
  for (const ch of Object.values(state.chapters)) {
    ch.topics.forEach(t => {
      total++;
      totalHours += t.hours;
      if (state.done[t.id]) { doneCount++; doneHours += t.hours; }
    });
  }

  const rows = [
    { label: "Total de tópicos",      value: total,                            cls: "blue" },
    { label: "Tópicos concluídos",    value: `${doneCount} / ${total}`,        cls: "green" },
    { label: "Horas totais",          value: `${totalHours}h`,                 cls: "purple" },
    { label: "Horas estudadas",       value: `${doneHours}h`,                  cls: "orange" },
    { label: "Horas restantes",       value: `${totalHours - doneHours}h`,     cls: "blue" },
    { label: "Cap. 6 concluídos",     value: `${state.chapters.cap6.topics.filter(t => state.done[t.id]).length} / ${state.chapters.cap6.topics.length}`, cls: "blue" },
    { label: "Cap. 7 concluídos",     value: `${state.chapters.cap7.topics.filter(t => state.done[t.id]).length} / ${state.chapters.cap7.topics.length}`, cls: "purple" },
  ];

  el.innerHTML = rows.map(r => `
    <div class="stat-row">
      <span class="stat-label">${r.label}</span>
      <span class="stat-value ${r.cls}">${r.value}</span>
    </div>
  `).join("");
}

/* ═══════════════════════════════════════════
   FORMULAS VIEW
═══════════════════════════════════════════ */
function buildFormulas() {
  const grid = document.getElementById("formulasGrid");
  grid.innerHTML = "";
  for (const [key, ch] of Object.entries(state.chapters)) {
    ch.topics
      .filter(t => t.formula)
      .forEach(t => {
        const card = document.createElement("div");
        card.className = `formula-card ${key}`;
        card.innerHTML = `
          <div class="fc-chapter">Cap. ${ch.number} — ${key === "cap6" ? "Cálculo de Variações" : "Lagrangiana & Hamiltoniana"}</div>
          <div class="fc-topic">${t.title}</div>
          <div class="fc-formula">${t.formula}</div>
        `;
        grid.appendChild(card);
      });
  }
}

/* ═══════════════════════════════════════════
   NAV
═══════════════════════════════════════════ */
const viewTitles = {
  cronograma: "Cronograma de Estudos",
  dashboard: "Dashboard de Progresso",
  formulas: "Fórmulas Principais",
};

document.querySelectorAll(".nav-item").forEach(btn => {
  btn.addEventListener("click", () => {
    const view = btn.dataset.view;
    document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`view-${view}`).classList.add("active");
    document.getElementById("topbarTitle").textContent = viewTitles[view];
  });
});

/* ── Reset button ── */
document.getElementById("btnReset").addEventListener("click", () => {
  if (!confirm("Limpar todo o progresso?")) return;
  state.done = {};
  persist();
  document.querySelectorAll(".topic-card").forEach(c => c.classList.remove("done"));
  updateProgress();
  updateChapterBars();
  refreshDashboardCharts();
});

/* ═══════════════════════════════════════════
   BOOT
═══════════════════════════════════════════ */
init();
