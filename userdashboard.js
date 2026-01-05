import data from './data.js';
import { auth, onAuthStateChanged } from './firebase.js'; 

window.onload = () => {
    checkAuth();
    initDashboard();
};

let chartInstances = {};
let currentData = [...data];

function checkAuth() {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            document.getElementById('userNameDisplay').innerText = user.email.split('@')[0];
        } else {
            // Optional: Redirect if not logged in
            // window.location.href = "login.html";
        }
    });
}

function initDashboard() {
    populateFilters();
    updateDashboard();
}

function populateFilters() {
    const years = [...new Set(data.map(d => Math.floor(d.year)))].sort();
    const types = [...new Set(data.map(d => d.crime_type))].sort();
    // Simulate Months (assuming data might not have month field, creating 1-12)
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    const yearSelect = document.getElementById('yearFilter');
    const typeSelect = document.getElementById('crimeFilter');
    const monthSelect = document.getElementById('monthFilter');

    if(yearSelect.options.length === 1) {
        years.forEach(y => {
            const opt = document.createElement('option');
            opt.value = y; opt.innerText = y; yearSelect.appendChild(opt);
        });
        types.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t; opt.innerText = t; typeSelect.appendChild(opt);
        });
        months.forEach((m, index) => {
            const opt = document.createElement('option');
            opt.value = index + 1; opt.innerText = m; monthSelect.appendChild(opt);
        });
    }
}

window.applyFilters = function() {
    const yearVal = document.getElementById('yearFilter').value;
    const typeVal = document.getElementById('crimeFilter').value;
    const monthVal = document.getElementById('monthFilter').value;

    currentData = data.filter(item => {
        // Mocking month extraction if date string exists, else random or ignore
        const itemDate = new Date(item.date || item.createdAt || new Date()); 
        const itemMonth = itemDate.getMonth() + 1;

        return (yearVal === "" || Math.floor(item.year) == yearVal) &&
               (typeVal === "" || item.crime_type === typeVal) &&
               (monthVal === "" || itemMonth == monthVal);
    });

    updateDashboard();
}

window.logout = function() {
    auth.signOut().then(() => {
        window.location.href = "login.html";
    });
}

function updateDashboard() {
    updateKPIs();
    renderCharts();
}

function updateKPIs() {
    const total = currentData.length;
    const solved = currentData.filter(d => d.case_status === 'closed').length;
    
    const responses = currentData.map(d => d.response_time_minutes).filter(t => !isNaN(t));
    const avg = responses.length > 0 ? Math.round(responses.reduce((a,b)=>a+b,0)/responses.length) : 0;

    animateValue("totalCrimes", total);
    animateValue("solvedCount", solved);
    document.getElementById("avgResponse").innerText = avg + " min";
}

function renderCharts() {
    // Destroy existing
    Object.keys(chartInstances).forEach(key => {
        if(chartInstances[key]) chartInstances[key].destroy();
    });

    // 1. Aggregations
    const countByYear = {};
    const countByType = {};
    const countByStatus = { 'open': 0, 'closed': 0 };
    const countBySeverity = { 'high': 0, 'medium': 0, 'low': 0 };
    const countByDay = { 'Sun':0, 'Mon':0, 'Tue':0, 'Wed':0, 'Thu':0, 'Fri':0, 'Sat':0 };
    const countByMonth = new Array(12).fill(0);
    const countByArea = {};
    const responseByType = {};

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    currentData.forEach(d => {
        // Year
        countByYear[d.year] = (countByYear[d.year] || 0) + 1;
        
        // Type
        countByType[d.crime_type] = (countByType[d.crime_type] || 0) + 1;
        
        // Status
        const status = d.case_status ? d.case_status.toLowerCase() : 'open';
        if(countByStatus[status] !== undefined) countByStatus[status]++;

        // Severity
        const sev = d.crime_severity_level ? d.crime_severity_level.toLowerCase() : 'low';
        if(countBySeverity[sev] !== undefined) countBySeverity[sev]++;

        // Date derived (Day/Month)
        const dateObj = new Date(d.date || d.year + "-01-01"); // Fallback
        countByDay[days[dateObj.getDay()]]++;
        countByMonth[dateObj.getMonth()]++;

        // Area
        countByArea[d.state] = (countByArea[d.state] || 0) + 1; // Using state as area for demo

        // Response Time
        if(!responseByType[d.crime_type]) responseByType[d.crime_type] = {sum:0, count:0};
        responseByType[d.crime_type].sum += (d.response_time_minutes || 0);
        responseByType[d.crime_type].count++;
    });

    const sortedYears = Object.keys(countByYear).sort();
    const sortedAreas = Object.entries(countByArea).sort((a,b) => b[1] - a[1]).slice(0, 5);
    const responseLabels = Object.keys(responseByType);
    const responseValues = responseLabels.map(k => Math.round(responseByType[k].sum / responseByType[k].count));

    // 2. Chart Configurations

    // Chart 1: Yearly Trend (Line)
    createChart('trendChart', 'line', sortedYears, sortedYears.map(y => countByYear[y]), 'Crime Trend', '#3b82f6', true);

    // Chart 2: Status (Doughnut)
    chartInstances.status = new Chart(document.getElementById('statusChart'), {
        type: 'doughnut',
        data: {
            labels: ['Open Cases', 'Closed Cases'],
            datasets: [{ data: [countByStatus.open, countByStatus.closed], backgroundColor: ['#ef4444', '#10b981'], borderWidth:0 }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    // Chart 3: Type (Pie)
    chartInstances.type = new Chart(document.getElementById('typeChart'), {
        type: 'pie',
        data: {
            labels: Object.keys(countByType),
            datasets: [{ data: Object.values(countByType), backgroundColor: ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316'], borderWidth:0 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
    });

    // Chart 4: Severity (Polar Area)
    chartInstances.severity = new Chart(document.getElementById('severityChart'), {
        type: 'polarArea',
        data: {
            labels: ['High', 'Medium', 'Low'],
            datasets: [{ data: [countBySeverity.high, countBySeverity.medium, countBySeverity.low], backgroundColor: ['#dc2626', '#f59e0b', '#3b82f6'] }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { r: { ticks: { display: false } } } }
    });

    // Chart 5: Day of Week (Bar)
    createChart('dayChart', 'bar', days, days.map(d => countByDay[d]), 'Incidents', '#8b5cf6');

    // Chart 6: Monthly (Bar)
    const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    createChart('monthlyChart', 'bar', monthLabels, countByMonth, 'Monthly Volume', '#06b6d4');

    // Chart 7: Top Areas (Horizontal Bar)
    chartInstances.area = new Chart(document.getElementById('areaChart'), {
        type: 'bar',
        data: {
            labels: sortedAreas.map(i => i[0]),
            datasets: [{ label: 'Incidents', data: sortedAreas.map(i => i[1]), backgroundColor: '#f59e0b', borderRadius: 4 }]
        },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false }
    });

    // Chart 8: Response Time (Bar)
    createChart('responseChart', 'bar', responseLabels, responseValues, 'Avg Response (min)', '#10b981');

    // Chart 9: Radar (Safety Metrics)
    chartInstances.radar = new Chart(document.getElementById('radarChart'), {
        type: 'radar',
        data: {
            labels: ['Volume', 'Severity', 'Unsolved Rate', 'Response Time', 'Frequency'],
            datasets: [{
                label: 'Current Metrics',
                data: [65, 59, 90, 81, 56], // Mocked relative metrics for visual
                fill: true,
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                borderColor: 'rgb(59, 130, 246)',
                pointBackgroundColor: 'rgb(59, 130, 246)',
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, elements: { line: { borderWidth: 3 } } }
    });
}

function createChart(id, type, labels, dataArr, label, color, fill=false) {
    const ctx = document.getElementById(id);
    if(!ctx) return;
    
    chartInstances[id] = new Chart(ctx, {
        type: type,
        data: {
            labels: labels,
            datasets: [{
                label: label,
                data: dataArr,
                backgroundColor: color,
                borderColor: color,
                tension: 0.4,
                fill: fill,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true } }
        }
    });
}

function animateValue(id, end) {
    const obj = document.getElementById(id);
    if(obj) obj.innerText = end;
}