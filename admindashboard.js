import data from './data.js';
import { db, collection, getDocs, query, orderBy } from './firebase.js'; 

// --- Initialization ---
window.onload = () => {
    initDashboard();
};

// --- State Variables ---
let chartInstances = {};
let currentData = [...data]; // This holds filtered data
// Note: 'data' variable holds the FULL original dataset

function initDashboard() {
    populateFilters();
    updateDashboard();
    loadMessages(); 
    loadFeedback();
}

// --- CORE DASHBOARD LOGIC ---

function populateFilters() {
    const years = [...new Set(data.map(d => Math.floor(d.year)))].sort();
    const states = [...new Set(data.map(d => d.state))].sort();
    const types = [...new Set(data.map(d => d.crime_type))].sort();

    const yearSelect = document.getElementById('yearFilter');
    const stateSelect = document.getElementById('stateFilter');
    const typeSelect = document.getElementById('crimeTypeFilter');

    if(yearSelect.options.length === 1) {
        years.forEach(y => {
            let opt = document.createElement('option');
            opt.value = y; opt.innerText = y; yearSelect.appendChild(opt);
        });
        states.forEach(s => {
            let opt = document.createElement('option');
            opt.value = s; opt.innerText = s.charAt(0).toUpperCase() + s.slice(1); stateSelect.appendChild(opt);
        });
        types.forEach(t => {
            let opt = document.createElement('option');
            opt.value = t; opt.innerText = t.charAt(0).toUpperCase() + t.slice(1); typeSelect.appendChild(opt);
        });
    }
}

window.applyFilters = function() {
    const yearVal = document.getElementById('yearFilter').value;
    const stateVal = document.getElementById('stateFilter').value;
    const typeVal = document.getElementById('crimeTypeFilter').value;

    // We filter 'data' into 'currentData'
    currentData = data.filter(item => {
        return (yearVal === 'all' || Math.floor(item.year) == yearVal) &&
               (stateVal === 'all' || item.state === stateVal) &&
               (typeVal === 'all' || item.crime_type === typeVal);
    });

    updateDashboard();
}

window.resetFilters = function() {
    document.getElementById('yearFilter').value = 'all';
    document.getElementById('stateFilter').value = 'all';
    document.getElementById('crimeTypeFilter').value = 'all';
    currentData = [...data];
    updateDashboard();
}

window.logout = function() {
    if(confirm("Are you sure you want to logout?")) {
        localStorage.clear();
        window.location.href = "login.html";
    }
}

function updateDashboard() {
    updateKPIs();
    renderCharts();
}

// --- UPDATED FUNCTION FOR TOTAL CRIMES FIX ---
function updateKPIs() {
    // 1. GRAND TOTAL: Uses 'data' (Original full list). 
    // This ensures "Total Crimes" NEVER decreases when filtering.
    const grandTotal = data.length; 

    // 2. FILTERED TOTAL: Uses 'currentData' (Filtered list).
    // This ensures Percentages and Averages are accurate for the selected view.
    const filteredTotal = currentData.length;

    const solved = currentData.filter(d => d.case_status === 'closed').length;
    const rate = filteredTotal > 0 ? Math.round((solved / filteredTotal) * 100) : 0;
    
    const responses = currentData.map(d => d.response_time_minutes).filter(t => !isNaN(t));
    const avgResp = responses.length > 0 ? Math.round(responses.reduce((a, b) => a + b, 0) / responses.length) : 0;
    
    const highSev = currentData.filter(d => d.crime_severity_level === 'high').length;

    // Update Elements
    const totalEl = document.getElementById("totalCrimes");
    // Pass grandTotal to the animation logic
    if(totalEl) animateValue("totalCrimes", parseInt(totalEl.innerText), grandTotal, 500);
    
    document.getElementById("solvedRate").innerText = rate + "%";
    document.getElementById("avgResponse").innerText = avgResp + " min";
    document.getElementById("highSeverity").innerText = highSev;
}

function renderCharts() {
    // Charts use currentData so they reflect the filters visually
    const typeCounts = {};
    currentData.forEach(d => { typeCounts[d.crime_type] = (typeCounts[d.crime_type] || 0) + 1; });

    const statusCounts = { 'open': 0, 'closed': 0 };
    currentData.forEach(d => {
        const status = d.case_status.toLowerCase();
        if (statusCounts[status] !== undefined) statusCounts[status]++;
    });

    const stateCounts = {};
    currentData.forEach(d => { stateCounts[d.state] = (stateCounts[d.state] || 0) + 1; });

    if (chartInstances.type) chartInstances.type.destroy();
    if (chartInstances.status) chartInstances.status.destroy();
    if (chartInstances.state) chartInstances.state.destroy();

    // Chart configs
    chartInstances.type = new Chart(document.getElementById('crimeTypeChart'), {
        type: 'bar',
        data: {
            labels: Object.keys(typeCounts),
            datasets: [{ label: 'Count', data: Object.values(typeCounts), backgroundColor: '#f59e0b', borderRadius: 4 }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
    });

    chartInstances.status = new Chart(document.getElementById('statusChart'), {
        type: 'doughnut',
        data: {
            labels: ['Open', 'Closed'],
            datasets: [{ data: [statusCounts.open, statusCounts.closed], backgroundColor: ['#ef4444', '#10b981'], borderWidth: 0 }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    chartInstances.state = new Chart(document.getElementById('stateChart'), {
        type: 'line',
        data: {
            labels: Object.keys(stateCounts),
            datasets: [{ label: 'Crimes per State', data: Object.values(stateCounts), borderColor: '#0f172a', backgroundColor: 'rgba(15, 23, 42, 0.1)', tension: 0.4, fill: true }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
    });
}

function animateValue(id, start, end, duration) {
    if (start === end) return;
    // Basic check to avoid NaN issues if element is empty initially
    if (isNaN(start)) start = 0;
    
    const range = end - start;
    let current = start;
    const increment = end > start ? 1 : -1;
    const stepTime = Math.abs(Math.floor(duration / range));
    
    const obj = document.getElementById(id);
    if(!obj) return;
    
    const timer = setInterval(function() {
        current += increment;
        obj.innerText = current;
        if (current == end) clearInterval(timer);
    }, stepTime || 10); // Default 10ms if stepTime is 0
}

// --- FIREBASE DATA FETCHING ---

window.loadMessages = async function() {
    const tableBody = document.getElementById("messagesTableBody");
    tableBody.innerHTML = "<tr><td colspan='5' style='text-align:center; padding:20px;'>Loading messages...</td></tr>";

    try {
        const q = query(collection(db, "contact_messages"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);

        tableBody.innerHTML = ""; 

        if (querySnapshot.empty) {
            tableBody.innerHTML = "<tr><td colspan='5' style='text-align:center; padding:20px;'>No inquiries found.</td></tr>";
            return;
        }

        querySnapshot.forEach((doc) => {
            const msg = doc.data();
            let dateStr = "N/A";
            if (msg.createdAt) {
                const dateObj = msg.createdAt.toDate ? msg.createdAt.toDate() : new Date(msg.createdAt);
                dateStr = dateObj.toLocaleDateString() + " " + dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            }

            const row = `
                <tr>
                    <td style="white-space:nowrap; color:#64748b; font-size:0.9em;">${dateStr}</td>
                    <td style="font-weight:500;">${msg.name}</td>
                    <td>${msg.email}</td>
                    <td><span class="badge" style="background:${getSubjectColor(msg.subject)}">${msg.subject}</span></td>
                    <td style="max-width:300px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${msg.message}">${msg.message}</td>
                </tr>
            `;
            tableBody.innerHTML += row;
        });

    } catch (error) {
        console.error("Error fetching messages:", error);
        tableBody.innerHTML = "<tr><td colspan='5' style='text-align:center; color:red;'>Error loading data. Check console.</td></tr>";
    }
}

function getSubjectColor(subject) {
    if(subject === 'Data Discrepancy') return '#fee2e2; color:#dc2626;';
    if(subject === 'Technical Support') return '#e0f2fe; color:#0284c7;';
    return '#f1f5f9; color:#475569;';
}

window.loadFeedback = async function() {
    const tableBody = document.getElementById("feedbackTableBody");
    tableBody.innerHTML = "<tr><td colspan='4' style='text-align:center; padding:20px;'>Loading feedback...</td></tr>";

    try {
        const q = query(collection(db, "public_feedback"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);

        tableBody.innerHTML = ""; 

        if (querySnapshot.empty) {
            tableBody.innerHTML = "<tr><td colspan='4' style='text-align:center; padding:20px;'>No feedback received yet.</td></tr>";
            return;
        }

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            let dateStr = "N/A";
            if (data.createdAt) {
                const dateObj = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
                dateStr = dateObj.toLocaleDateString();
            }

            const row = `
                <tr>
                    <td style="color:#64748b; font-size:0.9em;">${dateStr}</td>
                    <td style="font-weight:500;">${data.name}</td>
                    <td>${data.email}</td>
                    <td style="font-style:italic; color:#334155;">"${data.feedback}"</td>
                </tr>
            `;
            tableBody.innerHTML += row;
        });

    } catch (error) {
        console.error("Error fetching feedback:", error);
        tableBody.innerHTML = "<tr><td colspan='4' style='text-align:center; color:red;'>Error loading data.</td></tr>";
    }
}