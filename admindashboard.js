import data from './data.js';
import { db, collection, getDocs, query, orderBy } from './firebase.js'; 

window.onload = () => {
    initDashboard();
};

let chartInstances = {
    type: null,
    status: null,
    state: null,
    severity: null,
    year: null,
    response: null,
    solvedYear: null,
    risk: null,
    radar: null
};

let currentData = [...data];

function initDashboard() {
    populateFilters();
    updateDashboard();
    loadMessages(); 
    loadFeedback();
}

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

function updateKPIs() {
    const total = currentData.length;
    const solved = currentData.filter(d => d.case_status === 'closed').length;
    const rate = total > 0 ? Math.round((solved / total) * 100) : 0;
    const responses = currentData.map(d => d.response_time_minutes).filter(t => !isNaN(t));
    const avgResp = responses.length > 0 ? Math.round(responses.reduce((a, b) => a + b, 0) / responses.length) : 0;
    const highSev = currentData.filter(d => d.crime_severity_level === 'high').length;

    const totalEl = document.getElementById("totalCrimes");
    const currentTotalDisplayed = parseInt(totalEl.innerText) || 0;
    
    if(totalEl) animateValue("totalCrimes", currentTotalDisplayed, total, 300);
    
    document.getElementById("solvedRate").innerText = rate + "%";
    document.getElementById("avgResponse").innerText = avgResp + " min";
    document.getElementById("highSeverity").innerText = highSev;
}

function renderCharts() {
    Object.values(chartInstances).forEach(chart => { if(chart) chart.destroy(); });

    const typeCounts = {};
    currentData.forEach(d => { typeCounts[d.crime_type] = (typeCounts[d.crime_type] || 0) + 1; });

    const statusCounts = { 'open': 0, 'closed': 0 };
    currentData.forEach(d => {
        const status = d.case_status.toLowerCase();
        if (statusCounts[status] !== undefined) statusCounts[status]++;
    });

    const stateCounts = {};
    currentData.forEach(d => { stateCounts[d.state] = (stateCounts[d.state] || 0) + 1; });

    const severityCounts = { 'high': 0, 'medium': 0, 'low': 0 };
    currentData.forEach(d => {
        const sev = d.crime_severity_level ? d.crime_severity_level.toLowerCase() : 'low';
        if(severityCounts[sev] !== undefined) severityCounts[sev]++;
    });

    const yearCounts = {};
    currentData.forEach(d => { yearCounts[d.year] = (yearCounts[d.year] || 0) + 1; });
    const sortedYears = Object.keys(yearCounts).sort();

    const typeResponse = {};
    currentData.forEach(d => {
        if(!typeResponse[d.crime_type]) typeResponse[d.crime_type] = { total:0, count:0 };
        typeResponse[d.crime_type].total += d.response_time_minutes || 0;
        typeResponse[d.crime_type].count++;
    });
    const avgResponseLabels = Object.keys(typeResponse);
    const avgResponseData = avgResponseLabels.map(k => Math.round(typeResponse[k].total / typeResponse[k].count));

    const solvedByYear = {}; 
    const unsolvedByYear = {};
    sortedYears.forEach(y => { solvedByYear[y] = 0; unsolvedByYear[y] = 0; });
    currentData.forEach(d => {
        if(d.case_status === 'closed') solvedByYear[d.year]++;
        else unsolvedByYear[d.year]++;
    });

    const stateRisks = {};
    currentData.forEach(d => {
        if(d.crime_severity_level === 'high') stateRisks[d.state] = (stateRisks[d.state] || 0) + 1;
    });
    const sortedRisks = Object.entries(stateRisks).sort((a,b) => b[1] - a[1]).slice(0, 5);

    chartInstances.type = new Chart(document.getElementById('crimeTypeChart'), {
        type: 'bar',
        data: {
            labels: Object.keys(typeCounts),
            datasets: [{ label: 'Incidents', data: Object.values(typeCounts), backgroundColor: '#f59e0b', borderRadius: 4 }]
        },
        options: { responsive: true, maintainAspectRatio: false }
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
            datasets: [{ label: 'Total Crimes', data: Object.values(stateCounts), borderColor: '#0f172a', tension: 0.4, fill: false }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    chartInstances.severity = new Chart(document.getElementById('severityChart'), {
        type: 'pie',
        data: {
            labels: ['High', 'Medium', 'Low'],
            datasets: [{ data: [severityCounts.high, severityCounts.medium, severityCounts.low], backgroundColor: ['#dc2626', '#f59e0b', '#3b82f6'], borderWidth: 0 }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    chartInstances.year = new Chart(document.getElementById('yearChart'), {
        type: 'line',
        data: {
            labels: sortedYears,
            datasets: [{ label: 'Yearly Volume', data: sortedYears.map(y => yearCounts[y]), borderColor: '#6366f1', backgroundColor:'rgba(99, 102, 241, 0.2)', fill: true, tension: 0.3 }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    chartInstances.response = new Chart(document.getElementById('responseChart'), {
        type: 'bar',
        data: {
            labels: avgResponseLabels,
            datasets: [{ label: 'Mins', data: avgResponseData, backgroundColor: '#8b5cf6', indexAxis: 'y' }]
        },
        options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y' }
    });

    chartInstances.solvedYear = new Chart(document.getElementById('solvedYearChart'), {
        type: 'bar',
        data: {
            labels: sortedYears,
            datasets: [
                { label: 'Solved', data: sortedYears.map(y => solvedByYear[y]), backgroundColor: '#10b981' },
                { label: 'Unsolved', data: sortedYears.map(y => unsolvedByYear[y]), backgroundColor: '#ef4444' }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true } } }
    });

    chartInstances.risk = new Chart(document.getElementById('riskStateChart'), {
        type: 'polarArea',
        data: {
            labels: sortedRisks.map(i => i[0]),
            datasets: [{ data: sortedRisks.map(i => i[1]), backgroundColor: ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16'] }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    chartInstances.radar = new Chart(document.getElementById('radarChart'), {
        type: 'radar',
        data: {
            labels: ['High Severity', 'Unsolved', 'Slow Response', 'Violent Type', 'Urban Area'],
            datasets: [{
                label: 'Current Complexity',
                data: [severityCounts.high, statusCounts.open, 45, typeCounts['Assault'] || 10, 60],
                backgroundColor: 'rgba(255, 99, 132, 0.2)',
                borderColor: 'rgb(255, 99, 132)',
                pointBackgroundColor: 'rgb(255, 99, 132)'
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, elements: { line: { borderWidth: 3 } } }
    });
}

function animateValue(id, start, end, duration) {
    const obj = document.getElementById(id);
    if (!obj) return;
    if (start === end) return;

    let startTime = null;
    function animation(currentTime) {
        if (startTime === null) startTime = currentTime;
        const timeElapsed = currentTime - startTime;
        const progress = Math.min(timeElapsed / duration, 1);
        const value = Math.floor(progress * (end - start) + start);
        obj.innerText = value;
        if (timeElapsed < duration) {
            requestAnimationFrame(animation);
        } else {
            obj.innerText = end; 
        }
    }
    requestAnimationFrame(animation);
}

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