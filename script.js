// ========================= script.js =========================

/* LocalStorage keys */
const LS_KEYS = {
  users: "sh_users",
  devices: "sh_devices",
  automations: "sh_automations",
  notifications: "sh_notifications",
  activeUser: "sh_active_user",
  theme: "sh_theme",
};

let users = [];
let devices = [];
let automations = [];
let notifications = [];
let activeUser = null;
let failedLoginCount = 0;

/* Chart instances */
let energyBarChart = null;
let energyLineChart = null;
let energyPieChart = null;
let energyGaugeChart = null;

document.addEventListener("DOMContentLoaded", () => {
  loadState();
  setupTheme();
  wireAuthEvents();
  wireAppEvents();
  initialScreen();
});

/* ======================= STATE & THEME ======================= */

function loadState() {
  users = JSON.parse(localStorage.getItem(LS_KEYS.users) || "[]");
  devices = JSON.parse(localStorage.getItem(LS_KEYS.devices) || "[]");
  automations = JSON.parse(localStorage.getItem(LS_KEYS.automations) || "[]");
  notifications = JSON.parse(localStorage.getItem(LS_KEYS.notifications) || "[]");

  if (users.length === 0) {
    users.push({ name: "Demo User", email: "admin@example.com", pass: "1234" });
    saveUsers();
  }

  const activeEmail = localStorage.getItem(LS_KEYS.activeUser);
  if (activeEmail) activeUser = users.find(u => u.email === activeEmail) || null;
}

function saveUsers() { localStorage.setItem(LS_KEYS.users, JSON.stringify(users)); }
function saveDevices() { localStorage.setItem(LS_KEYS.devices, JSON.stringify(devices)); }
function saveAutomations() { localStorage.setItem(LS_KEYS.automations, JSON.stringify(automations)); }
function saveNotifications() { localStorage.setItem(LS_KEYS.notifications, JSON.stringify(notifications)); }

function setupTheme() {
  const saved = localStorage.getItem(LS_KEYS.theme);
  if (saved === "dark") document.body.classList.add("dark");
}

/* ======================= AUTH LOGIC ======================= */

function wireAuthEvents() {
  document.getElementById("goRegisterLink").onclick = () => switchAuth("register");
  document.getElementById("goLoginLink").onclick = () => switchAuth("login");
  document.getElementById("forgotLink").onclick = () => switchAuth("forgot");
  document.getElementById("backToLoginLink").onclick = () => switchAuth("login");

  document.getElementById("registerBtn").onclick = handleRegister;
  document.getElementById("loginBtn").onclick = handleLogin;
  document.getElementById("resetBtn").onclick = handleResetPassword;
}

function switchAuth(page) {
  hide("loginPage"); hide("registerPage"); hide("forgotPage");
  if (page === "login") show("loginPage");
  if (page === "register") show("registerPage");
  if (page === "forgot") show("forgotPage");
}

function handleRegister() {
  const name = val("regName");
  const email = val("regEmail");
  const pass = val("regPass");
  const cpass = val("regCPass");
  const error = el("regError");

  error.textContent = "";
  if (!name || !email || !pass || !cpass) return error.textContent = "All fields are required.";
  if (pass !== cpass) return error.textContent = "Passwords do not match.";
  if (users.find(u => u.email === email)) return error.textContent = "Email already registered.";

  users.push({ name, email, pass });
  saveUsers();
  alert("Registration successful!");
  switchAuth("login");
}

function handleLogin() {
  const email = val("loginEmail");
  const pass = val("loginPass");
  const error = el("loginError");

  error.textContent = "";
  const user = users.find(u => u.email === email && u.pass === pass);

  if (!user) {
    failedLoginCount++;
    notify(`Unauthorized login attempt for "${email}"`, "security", "danger");

    if (failedLoginCount >= 3)
      notify("Multiple failed login attempts — possible intrusion!", "security", "danger");

    return error.textContent = "Invalid credentials.";
  }

  failedLoginCount = 0;
  activeUser = user;
  localStorage.setItem(LS_KEYS.activeUser, activeUser.email);

  hide("loginPage"); hide("registerPage"); hide("forgotPage");
  show("app");
  showPage("dashboard");
  updateUI();
}

function handleResetPassword() {
  const email = val("forgotEmail");
  const pass = val("forgotPass");
  const cpass = val("forgotCPass");
  const error = el("forgotError");

  error.textContent = "";
  if (!email || !pass || !cpass) return error.textContent = "All fields required.";
  if (pass !== cpass) return error.textContent = "Passwords don't match.";

  const user = users.find(u => u.email === email);
  if (!user) return error.textContent = "Email not found.";

  user.pass = pass;
  saveUsers();
  alert("Password reset successful!");
  switchAuth("login");
}

/* ======================= APP LOGIC ======================= */

function wireAppEvents() {
  document.querySelectorAll(".nav-item").forEach(item => {
    item.addEventListener("click", () => showPage(item.dataset.page));
  });

  el("logoutBtn").onclick = () => {
    activeUser = null;
    localStorage.removeItem(LS_KEYS.activeUser);
    hide("app");
    show("loginPage");
  };

  el("themeToggle").onclick = toggleTheme;
  el("addDeviceBtn").onclick = addDevice;
  el("saveAutomationBtn").onclick = saveAutomation;
  el("saveProfileBtn").onclick = saveProfile;
  el("changePasswordBtn").onclick = updateProfilePassword;

  el("clearAlertsBtn").onclick = () => { notifications = []; saveNotifications(); updateUI(); };
  el("markReadBtn").onclick = () => { notifications.forEach(n => n.read = true); saveNotifications(); updateUI(); };
}

function toggleTheme() {
  document.body.classList.toggle("dark");
  localStorage.setItem(LS_KEYS.theme, document.body.classList.contains("dark") ? "dark" : "light");
  updateEnergyCharts();
}

/* ======================= PAGE SWITCHING ======================= */

function showPage(id) {
  document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
  show(id);
  updateUI();
}

/* ======================= DEVICES ======================= */

function addDevice() {
  const name = val("deviceName");
  const type = val("deviceType");

  if (!name) return alert("Enter device name");

  devices.push({ id: Date.now(), name, type, status: false, energy: rand(30, 120) });
  saveDevices();
  notify(`${name} added to devices.`, "system", "info");
  updateUI();
}

function toggleDevice(id) {
  const d = devices.find(x => x.id === id);
  d.status = !d.status;
  notify(`${d.name} turned ${d.status ? "ON" : "OFF"}`, "system", "info");
  saveDevices();
  updateUI();
}

/* ======================= AUTOMATIONS ======================= */

function saveAutomation() {
  const name = val("autoName");
  const devId = val("autoDevice");
  const action = val("autoAction");

  if (!name || !devId) return alert("Fill all fields");

  if (Math.random() < 0.2) {
    notify(`Automation '${name}' failed — device not responding.`, "automation", "danger");
    return;
  }

  automations.push({ id: Date.now(), name, devId, action });
  saveAutomations();
  notify(`Automation '${name}' created.`, "automation", "info");
  updateUI();
}

/* ======================= PROFILE ======================= */

function saveProfile() {
  const name = val("profileName");
  if (!name) return alert("Name cannot be empty.");

  activeUser.name = name;
  const idx = users.findIndex(u => u.email === activeUser.email);
  users[idx].name = name;
  saveUsers();
  updateUI();
  alert("Profile updated");
}

function updateProfilePassword() {
  const pass = val("profilePass");
  const cpass = val("profileCPass");
  const error = el("profileError");

  error.textContent = "";
  if (!pass || !cpass) return error.textContent = "Enter both fields.";
  if (pass !== cpass) return error.textContent = "Passwords do not match.";

  activeUser.pass = pass;
  const idx = users.findIndex(u => u.email === activeUser.email);
  users[idx].pass = pass;
  saveUsers();

  alert("Password updated");
  el("profilePass").value = "";
  el("profileCPass").value = "";
}

/* ======================= ALERT SYSTEM ======================= */

function notify(message, category = "system", severity = "info") {
  const icons = { info: "ℹ️", warning: "⚠️", danger: "⛔" };

  const alert = {
    id: Date.now(),
    message,
    category,
    severity,
    icon: icons[severity],
    timestamp: new Date().toLocaleString(),
    read: false,
  };

  notifications.push(alert);

  if (notifications.length > 25)
    notifications = notifications.slice(-25);

  saveNotifications();
  updateUI();
}

setInterval(() => {
  if (Math.random() < 0.05)
    notify("Motion detected at Front Door Camera", "security", "warning");
}, 7000);

setInterval(() => {
  if (Math.random() < 0.03)
    notify("Main Door opened", "door", "info");
}, 9000);

/* ======================= RENDER UI ======================= */

function updateUI() {
  if (activeUser) el("userNameLabel").textContent = activeUser.name;

  el("countDevices").textContent = devices.length;
  el("alertCount").textContent = notifications.length;

  renderDevices();
  renderAutomations();
  renderEnergyList();
  renderAlerts();
  renderProfileFields();
  updateEnergyCharts();
}

function renderDevices() {
  const div = el("deviceList");
  div.innerHTML = "";

  devices.forEach(d => {
    div.innerHTML += `
      <div class='card glass'>
        <h3>${d.name}</h3>
        <p>Type: ${d.type}</p>
        <p>Status: ${d.status ? "ON" : "OFF"}</p>
        <button onclick="toggleDevice(${d.id})">${d.status ? "Turn OFF" : "Turn ON"}</button>
      </div>
    `;
  });

  const autoDD = el("autoDevice");
  autoDD.innerHTML = devices.map(d =>
    `<option value='${d.id}'>${d.name}</option>`).join(" ");
}

function renderAutomations() {
  const div = el("autoList");
  div.innerHTML = "";

  automations.forEach(a => {
    const device = devices.find(d => d.id == a.devId);
    const deviceName = device ? device.name : "(Device Removed)";
    div.innerHTML += `<div class='card glass'><p>${a.name} → ${deviceName} (${a.action.toUpperCase()})</p></div>`;
  });
}

function renderEnergyList() {
  const div = el("energyList");
  div.innerHTML = devices.map(d => `<p>${d.name}: ${d.energy}W</p>`).join(" ");
}

function renderAlerts() {
  const container = el("notifContainer");
  container.innerHTML = "";

  notifications.slice().reverse().forEach(alert => {
    container.innerHTML += `
      <div class="alert alert-${alert.severity}">
        <div class="alert-icon">${alert.icon}</div>
        <div>
          <strong>${alert.category.toUpperCase()}</strong><br>
          ${alert.message}<br>
          <span class="alert-timestamp">${alert.timestamp}</span>
        </div>
      </div>
    `;
  });
}

function renderProfileFields() {
  if (!activeUser) return;
  el("profileName").value = activeUser.name;
  el("profileEmail").value = activeUser.email;
}

/* ======================= ENERGY CHARTS ======================= */

function updateEnergyCharts() {
  if (typeof Chart === "undefined") return;

  const labels = devices.map(d => d.name);
  const values = devices.map(d => d.energy);

  /* BAR CHART */
  const barCtx = el("energyBarChart").getContext("2d");
  const barGrad = barCtx.createLinearGradient(0, 0, 0, 200);
  barGrad.addColorStop(0, "rgba(59,130,246,0.9)");
  barGrad.addColorStop(1, "rgba(96,165,250,0.3)");

  if (energyBarChart) energyBarChart.destroy();
  energyBarChart = new Chart(barCtx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: barGrad,
          borderRadius: 10,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } },
    },
  });

  /* LINE CHART */
  const lineCtx = el("energyLineChart").getContext("2d");
  const lineGrad = lineCtx.createLinearGradient(0, 0, 300, 0);
  lineGrad.addColorStop(0, "rgba(56,189,248,0.9)");
  lineGrad.addColorStop(1, "rgba(129,140,248,0.9)");

  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const daily = days.map(() => rand(100, 400));

  if (energyLineChart) energyLineChart.destroy();
  energyLineChart = new Chart(lineCtx, {
    type: "line",
    data: {
      labels: days,
      datasets: [
        {
          data: daily,
          borderColor: lineGrad,
          tension: 0.4,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
    },
  });

  /* PIE CHART */
  const pieCtx = el("energyPieChart").getContext("2d");
  const categories = { light: 0, ac: 0, fan: 0 };
  devices.forEach((d) => (categories[d.type] += d.energy));

  if (energyPieChart) energyPieChart.destroy();
  energyPieChart = new Chart(pieCtx, {
    type: "pie",
    data: {
      labels: Object.keys(categories),
      datasets: [
        {
          data: Object.values(categories),
          backgroundColor: ["#3b82f6", "#10b981", "#ef4444"],
        },
      ],
    },
  });

  /* GAUGE CHART */
  const gaugeCtx = el("energyGaugeChart").getContext("2d");
  const total = values.reduce((a, b) => a + b, 0);

  if (energyGaugeChart) energyGaugeChart.destroy();
  energyGaugeChart = new Chart(gaugeCtx, {
    type: "doughnut",
    data: {
      datasets: [
        {
          data: [total, Math.max(300 - total, 0)],
          backgroundColor: ["#ef4444", "#d1d5db"],
          cutout: "70%",
        },
      ],
    },
    options: {
      rotation: -90 * (Math.PI / 180),
      circumference: 180 * (Math.PI / 180),
      plugins: {
        legend: { display: false },
      },
    },
  });
}

/* ======================= HELPERS ======================= */

function el(id) {
  return document.getElementById(id);
}
function val(id) {
  return document.getElementById(id).value.trim();
}
function show(id) {
  document.getElementById(id).classList.remove("hidden");
}
function hide(id) {
  document.getElementById(id).classList.add("hidden");
}
function rand(min, max) {
  return Math.floor(Math.random() * (max - min) + min);
}
