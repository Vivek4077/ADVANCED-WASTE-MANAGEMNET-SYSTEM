import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, getDocs, deleteDoc, serverTimestamp, query, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

let isRunning = false, isProcessing = false, intervalId, unsubscribe;
let allWasteData = [], chartInstances = {}, currentFilter = 'all';
let db, auth, wasteLogCollection;

const conveyorBtn = document.getElementById('conveyor-btn'), statusLightEl = document.getElementById('status-light'),
    systemStatusText = document.getElementById('system-status-text'), currentItemEl = document.getElementById('current-item'),
    irOutputEl = document.getElementById('ir-output'), mlOutputEl = document.getElementById('ml-output'),
    throughputMetricEl = document.getElementById('throughput-metric').querySelector('span'),
    accuracyMetricEl = document.getElementById('accuracy-metric').querySelector('span'),
    logListEl = document.getElementById('log-list'), clearLogBtn = document.getElementById('clear-log-btn'),
    conveyorItem = document.getElementById('conveyor-item'), themeToggle = document.getElementById('theme-toggle'),
    themeIcon = document.getElementById('theme-icon'), faultBtn = document.getElementById('fault-btn');

const MATERIALS = {
    organic: { category: "dumped", destination: "compost", ir_detect: "Organic" },
    plastic: { category: "recycled", destination: "crushers", ir_detect: "Inorganic" },
    paper: { category: "recycled", destination: "recycling belt", ir_detect: "Inorganic" },
    metal: { category: "recycled", destination: "melting", ir_detect: "Inorganic" },
    glass: { category: "recycled", destination: "sorting line", ir_detect: "Inorganic" },
    cardboard: { category: "recycled", destination: "baler", ir_detect: "Inorganic" },
    ewaste: { category: "special", destination: "special handling", ir_detect: "Inorganic" },
    unknown: { category: "dumped", destination: "manual inspection", ir_detect: "Inorganic" }
};

function simulateSensor() {
    const materialTypes = Object.keys(MATERIALS);
    const randomMaterial = materialTypes[Math.floor(Math.random() * materialTypes.length)];
    const confidence = (randomMaterial === 'unknown' || randomMaterial === 'ewaste') 
        ? Math.floor(Math.random() * 31) + 40 
        : Math.floor(Math.random() * 15) + 85;
    return { material: randomMaterial, confidence, irResult: MATERIALS[randomMaterial].ir_detect };
}

async function runSortingSimulation() {
    if (isProcessing || !isRunning) return;
    isProcessing = true;
    
    const { material, confidence, irResult } = simulateSensor();
    const displayName = material.charAt(0).toUpperCase() + material.slice(1);
    
    conveyorItem.classList.remove('active');
    void conveyorItem.offsetWidth; 
    conveyorItem.classList.add('active');
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    if (!isRunning) { isProcessing = false; return; }
    irOutputEl.innerHTML = `<p class="text-3xl font-bold text-teal-800 dark:text-teal-300">${irResult}</p>`;
    currentItemEl.textContent = `Processing: ${displayName}`;

    await new Promise(resolve => setTimeout(resolve, 1500));
    if (!isRunning) { isProcessing = false; return; }
    mlOutputEl.innerHTML = `<p class="text-3xl font-bold text-blue-800 dark:text-blue-300">${displayName}</p><p class="text-sm text-blue-600 dark:text-blue-400">Confidence: ${confidence}%</p>`;

    await new Promise(resolve => setTimeout(resolve, 1500));
    if (!isRunning) { isProcessing = false; return; }

    const identifiedStage = Object.keys(MATERIALS).indexOf(material);
    if (identifiedStage >= 0 && identifiedStage < 7) { 
        updateSensorUI(identifiedStage, 'success');
    } else {
        updateManualInspectionUI('active');
    }
    
    await saveData(material, confidence, irResult);
    
    setTimeout(() => { 
        isProcessing = false; 
        resetSensorUI();
    }, 500);
}

async function saveData(material, confidence, irResult, isFault = false) {
    if (!wasteLogCollection) return;
    const { category, destination } = MATERIALS[material] || MATERIALS['unknown'];
    try {
        await addDoc(wasteLogCollection, {
            material, category, destination, confidence, irResult, isFault, timestamp: serverTimestamp()
        });
        if (!isFault) showToast(`${material.charAt(0).toUpperCase() + material.slice(1)} sorted.`, "success");
    } catch (error) {
        console.error("Error writing document: ", error);
        showToast("Failed to log data.", "error");
    }
}

async function initializeFirebase() {
    try {
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);

        onAuthStateChanged(auth, user => {
            if (user) {
                systemStatusText.textContent = "System is offline";
                [conveyorBtn, faultBtn].forEach(b => b.disabled = false);
                wasteLogCollection = collection(db, `artifacts/${appId}/public/data/waste_log_v4`);
                setupRealtimeListener();
            } else {
                systemStatusText.textContent = "Authentication Failed.";
                [conveyorBtn, faultBtn].forEach(b => b.disabled = true);
            }
        });
        
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            await signInWithCustomToken(auth, __initial_auth_token);
        } else {
            await signInAnonymously(auth);
        }
    } catch (error) {
        console.error("Firebase initialization failed:", error);
        systemStatusText.textContent = "Database connection failed.";
    }
}

function setupRealtimeListener() {
    if (unsubscribe) unsubscribe();
    const q = query(wasteLogCollection, orderBy("timestamp", "desc"));
    unsubscribe = onSnapshot(q, (snapshot) => {
        allWasteData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updateDashboard();
    }, (error) => console.error("Error in snapshot listener: ", error));
}

function updateDashboard() {
    const now = Date.now();
    const filteredData = (currentFilter === 'all')
        ? allWasteData
        : allWasteData.filter(d => d.timestamp && (now - d.timestamp.toMillis()) < (currentFilter * 1000));
    
    renderLog(filteredData);
    updateMetrics(filteredData);
    updateCharts(filteredData);
}

function renderLog(data) {
    logListEl.innerHTML = '';
    data.slice(0, 100).forEach(item => {
        const logItem = document.createElement('li');
        const time = item.timestamp ? item.timestamp.toDate().toLocaleTimeString() : '...';
        const displayName = item.material.charAt(0).toUpperCase() + item.material.slice(1);
        
        let logMessage, colorClass;
        if (item.isFault) {
            logMessage = `SYSTEM FAULT: ${displayName}`;
            colorClass = 'border-yellow-500 bg-yellow-100 text-yellow-900 dark:bg-yellow-900/50 dark:text-yellow-100';
        } else if (item.category === 'recycled') {
            logMessage = `Recycled: ${displayName} (Conf: ${item.confidence}%)`;
            colorClass = 'border-emerald-500 bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100';
        } else if (item.category === 'special') {
             logMessage = `Special: ${displayName} (Conf: ${item.confidence}%)`;
            colorClass = 'border-cyan-500 bg-cyan-100 text-cyan-900 dark:bg-cyan-900/50 dark:text-cyan-100';
        } else {
            logMessage = `Dumped: ${displayName} (Conf: ${item.confidence}%)`;
            colorClass = 'border-red-500 bg-red-100 text-red-900 dark:bg-red-900/50 dark:text-red-100';
        }
        
        logItem.className = `flex items-center space-x-3 p-2 rounded-lg border-l-4 text-sm ${colorClass}`;
        logItem.innerHTML = `<span class="font-mono text-xs subtext">${time}</span><span class="font-medium">${logMessage}</span>`;
        logListEl.prepend(logItem);
    });
}

function updateMetrics(data) {
    const total = data.length;
    if (total === 0) {
        throughputMetricEl.textContent = '0.0';
        accuracyMetricEl.textContent = '0%';
        return;
    }
    
    const sorted = data.filter(d => d.timestamp).sort((a, b) => a.timestamp.toMillis() - b.timestamp.toMillis());
    if (sorted.length > 1) {
        const duration = (sorted[sorted.length-1].timestamp.toMillis() - sorted[0].timestamp.toMillis()) / 1000;
        throughputMetricEl.textContent = duration > 1 ? ((total / duration) * 60).toFixed(1) : '0.0';
    } else {
         throughputMetricEl.textContent = '0.0';
    }

    const correct = data.filter(d => d.material !== 'unknown').length;
    accuracyMetricEl.textContent = `${Math.round((correct / total) * 100)}%`;
}

function updateCharts(data) {
    const counts = data.filter(d => !d.isFault).reduce((acc, curr) => {
        acc.categories[curr.category] = (acc.categories[curr.category] || 0) + 1;
        if(curr.category === 'recycled') {
            acc.recycledTypes[curr.material] = (acc.recycledTypes[curr.material] || 0) + 1;
        }
        if (curr.timestamp) {
            const timeSlot = new Date(curr.timestamp.toMillis());
            timeSlot.setSeconds(Math.floor(timeSlot.getSeconds() / 10) * 10, 0);
            const key = timeSlot.getTime();
            acc.trend[key] = (acc.trend[key] || 0) + 1;
        }
        return acc;
    }, { categories: {}, recycledTypes: {}, trend: {} });

    const trendLabels = Object.keys(counts.trend).map(ts => parseInt(ts));
    const trendValues = Object.values(counts.trend);
    
    const isDark = document.documentElement.classList.contains('dark');
    const chartTextColor = isDark ? '#f8fafc' : '#0f172a';
    const chartGridColor = isDark ? '#475569' : '#e2e8f0';

    const baseOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: chartTextColor } }, title: { display: true, color: chartTextColor, font: {size: 14} } } };

    updateChart('categoryBreakdownChart', 'doughnut', {
        labels: Object.keys(counts.categories).map(k => k.charAt(0).toUpperCase() + k.slice(1)),
        datasets: [{ data: Object.values(counts.categories), backgroundColor: ['#10b981', '#ef4444', '#06b6d4'], borderColor: isDark ? '#1e293b' : '#ffffff', borderWidth: 2 }]
    }, { ...baseOptions, plugins: { ...baseOptions.plugins, title: { ...baseOptions.plugins.title, text: 'Waste Categories' } } });
    
    updateChart('wasteBreakdownChart', 'pie', {
        labels: ['Recycled', 'Dumped/Special'],
        datasets: [{ data: [counts.categories.recycled || 0, (counts.categories.dumped || 0) + (counts.categories.special || 0)], backgroundColor: ['#10b981', '#ef4444'], borderColor: isDark ? '#1e293b' : '#ffffff', borderWidth: 2 }]
    }, { ...baseOptions, plugins: { ...baseOptions.plugins, title: { ...baseOptions.plugins.title, text: 'Recycled vs. Non-Recycled' } } });

    updateChart('recycledTypeChart', 'bar', {
        labels: Object.keys(counts.recycledTypes).map(k => k.charAt(0).toUpperCase() + k.slice(1)),
        datasets: [{ label: 'Item Count', data: Object.values(counts.recycledTypes), backgroundColor: '#34d399' }]
    }, { ...baseOptions, indexAxis: 'y', plugins: { ...baseOptions.plugins, legend: { display: false }, title: { ...baseOptions.plugins.title, text: 'Recycled Material Types' } }, scales: { x: { ticks: { color: chartTextColor }, grid: { color: chartGridColor } }, y: { ticks: { color: chartTextColor }, grid: { display: false } } } });

    updateChart('processingTrendChart', 'line', {
         datasets: [{ label: 'Items Processed', data: trendLabels.map((ts, i) => ({x: ts, y: trendValues[i]})), borderColor: '#3b82f6', tension: 0.1, pointRadius: 0 }]
    }, { ...baseOptions, plugins: { ...baseOptions.plugins, title: { ...baseOptions.plugins.title, text: 'Processing Trend' } }, scales: { x: { type: 'time', time: { unit: 'minute' }, ticks: { color: chartTextColor, source: 'auto' }, grid: { color: chartGridColor } }, y: { ticks: { color: chartTextColor }, grid: { color: chartGridColor }, beginAtZero: true } } });
}

function updateChart(chartId, type, data, options) {
    const ctx = document.getElementById(chartId)?.getContext('2d');
    if(!ctx) return;
    if (chartInstances[chartId]) {
        chartInstances[chartId].data = data;
        chartInstances[chartId].options = options;
        chartInstances[chartId].update();
    } else {
        chartInstances[chartId] = new Chart(ctx, { type, data, options });
    }
}

async function clearLog() {
    if (!wasteLogCollection) return;
    showToast("Clearing all log data...", "info");
    const snapshot = await getDocs(wasteLogCollection);
    await Promise.all(snapshot.docs.map(doc => deleteDoc(doc.ref)));
    showToast("Log cleared successfully.", "success");
}

function updateSensorUI(index, status) {
    resetSensorUI();
    const lightEl = document.getElementById(`sensor-stage-${index}`)?.querySelector('.sensor-light');
    if (lightEl && status === 'success') lightEl.classList.replace('bg-gray-500', 'bg-green-400');
}

function updateManualInspectionUI(status) {
    resetSensorUI();
    const lightEl = document.getElementById('manual-inspection-stage').querySelector('.sensor-light');
    if (lightEl && status === 'active') lightEl.classList.replace('bg-gray-500', 'bg-yellow-400');
}

function resetSensorUI() {
     document.querySelectorAll('.sensor-light').forEach(el => el.className = el.className.replace(/bg-(green|yellow)-400/, 'bg-gray-500'));
}

function toggleConveyor() {
    isRunning = !isRunning;
    if (isRunning) {
        intervalId = setInterval(runSortingSimulation, 5000);
        conveyorBtn.textContent = 'PAUSE';
        statusLightEl.className = 'w-4 h-4 rounded-full bg-green-500 animate-pulse';
        systemStatusText.textContent = 'System operating normally';
        showToast("Conveyor started.", "success");
    } else {
        clearInterval(intervalId);
        conveyorBtn.textContent = 'START';
        statusLightEl.className = 'w-4 h-4 rounded-full bg-yellow-400';
        systemStatusText.textContent = 'Conveyor paused';
        showToast("Conveyor paused.", "info");
    }
}

function showToast(message, type = "info") {
    const colors = {
        success: "linear-gradient(to right, #00b09b, #96c93d)",
        error: "linear-gradient(to right, #ff5f6d, #ffc371)",
        info: "linear-gradient(to right, #0072ff, #00c6ff)",
    };
    Toastify({ text: message, duration: 3000, gravity: "top", position: "right", style: { background: colors[type] } }).showToast();
}

conveyorBtn.addEventListener('click', toggleConveyor);
clearLogBtn.addEventListener('click', clearLog);
faultBtn.addEventListener('click', () => {
     if (!isRunning) return showToast("Start conveyor to simulate a fault.", "error");
     const faultMessage = "Camera Obstructed";
     saveData(faultMessage, 0, "N/A", true);
     statusLightEl.className = 'w-4 h-4 rounded-full bg-red-500';
     systemStatusText.textContent = `SYSTEM FAULT: ${faultMessage}`;
     showToast(faultMessage, "error");
});

themeToggle.addEventListener('click', () => {
    document.documentElement.classList.toggle('dark');
    const isDark = document.documentElement.classList.contains('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    themeIcon.innerHTML = isDark 
        ? `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path>` 
        : `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path>`;
    updateDashboard();
});

document.querySelectorAll('.time-filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        currentFilter = e.target.dataset.filter === 'all' ? 'all' : parseInt(e.target.dataset.filter);
        document.querySelectorAll('.time-filter-btn').forEach(b => b.classList.remove('bg-white', 'dark:bg-slate-900'));
        e.target.classList.add('bg-white', 'dark:bg-slate-900');
        updateDashboard();
    });
});

window.onload = () => {
    const isDark = localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) {
        document.documentElement.classList.add('dark');
        themeIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path>`;
    }
    initializeFirebase();
};

