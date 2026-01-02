import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    getFirestore, getDoc, doc, collection, addDoc, Timestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ✅ IMPORT YOUR LOCAL DATA FILE
import rawData from './data.js';

// --- 1. FIREBASE CONFIG ---
const firebaseConfig = {
    apiKey: "AIzaSyA3gQMnJh0L8Bc6CNRJ_oTh6xqabVP2-P4",
    authDomain: "crime-rate-anaylsis.firebaseapp.com",
    projectId: "crime-rate-anaylsis",
    storageBucket: "crime-rate-anaylsis.firebasestorage.app",
    messagingSenderId: "640438558864",
    appId: "1:640438558864:web:42745954d83ea46cecf815"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Global Variables
let userSpecificData = [];
let charts = {};
let currentUserState = "";

// --- 2. AUTH & USER DATA ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            // 1. Get User Details from Firestore
            const userDoc = await getDoc(doc(db, "users", user.uid));

            if (userDoc.exists()) {
                const userData = userDoc.data();

                // Update Name on Dashboard
                document.getElementById("userNameDisplay").innerText = userData.firstName || "User";

                // 2. Get User State & Normalize it (Trim spaces + Lowercase)
                if (userData.state) {
                    currentUserState = userData.state.toLowerCase().trim();
                    document.getElementById("dashboardTitle").innerText = `DASHBOARD – ${currentUserState.toUpperCase()}`;

                    // 3. Load & Filter Data based on this state
                    processCrimeData(user.uid);
                } else {
                    alert("State not found in your profile. Please update your profile.");
                }
            } else {
                console.error("User document does not exist in Firestore.");
            }
        } catch (error) {
            console.error("Error fetching user data:", error);
        }

        // 4. Log Activity
        logActivity(user.uid, "Login", "User accessed dashboard");
    } else {
        window.location.href = "login.html";
    }
});

// --- 3. PROCESS DATA (Replaces Fetch) ---
function processCrimeData(uid) {
    if (!currentUserState) return;

    // ✅ FILTER LOGIC: Match data.js state with User's state
    // We convert both to lowercase to ensure 'Telangana' matches 'telangana'
    userSpecificData = rawData.filter(d =>
        d.state && d.state.toLowerCase().trim() === currentUserState
    );

    console.log(`User State: ${currentUserState}`);
    console.log(`Matched Records: ${userSpecificData.length}`);

    if (userSpecificData.length === 0) {
        alert(`No records found for ${currentUserState.toUpperCase()}. showing 0 records.`);
    }

    // Populate Filters based on the filtered data
    loadFilters(userSpecificData);

    // Render Dashboard
    updateDashboard(userSpecificData);
}

// --- 4. FILTER LOGIC ---
function loadFilters(data) {
    // Populate Months
    const uniqueMonths = [...new Set(data.map(d => d.month))].sort((a, b) => a - b);
    populateFilter("monthFilter", uniqueMonths, true);

    // Populate Years
    populateFilter("yearFilter", [...new Set(data.map(d => d.year))].sort());

    // Populate Crime Types
    populateFilter("crimeFilter", [...new Set(data.map(d => d.crime_type))].sort());
}

function populateFilter(id, values, isMonth = false) {
    const select = document.getElementById(id);
    select.innerHTML = select.options[0].outerHTML; // Reset to default option

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    values.forEach(val => {
        const option = document.createElement("option");
        option.value = val;
        option.textContent = isMonth ? monthNames[val - 1] : String(val).toUpperCase();
        select.appendChild(option);
    });
}

// Apply Filters Button Logic
window.applyFilters = function () {
    const month = document.getElementById("monthFilter").value;
    const year = document.getElementById("yearFilter").value;
    const crime = document.getElementById("crimeFilter").value;

    // Start with the state-specific data
    let filtered = userSpecificData;

    if (month) filtered = filtered.filter(d => d.month == month);
    if (year) filtered = filtered.filter(d => d.year == year);
    if (crime) filtered = filtered.filter(d => d.crime_type === crime);

    updateDashboard(filtered);
};

// --- 5. DASHBOARD UPDATES ---
function updateDashboard(data) {
    // KPI Updates
    document.getElementById("totalCrimes").innerText = data.length.toLocaleString();

    const closedCases = data.filter(d => d.case_status === "closed").length;
    document.getElementById("solvedCount").innerText = closedCases.toLocaleString();

    // Avg Response Time
    const totalResp = data.reduce((acc, curr) => acc + (curr.response_time_minutes || 0), 0);
    const avgResp = data.length ? Math.round(totalResp / data.length) : 0;
    document.getElementById("avgResponse").innerText = avgResp + " min";

    drawCharts(data);
}

// --- 6. CHART DRAWING ---
function drawCharts(data) {
    // Destroy old charts if they exist
    Object.values(charts).forEach(chart => {
        if (chart) chart.destroy();
    });

    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'bottom', labels: { color: '#ffffff' } }
        },
        scales: {
            x: { ticks: { color: '#cbd5e1' }, grid: { color: '#334155' } },
            y: { ticks: { color: '#cbd5e1' }, grid: { color: '#334155' } }
        }
    };

    // 1. Pie: Crime Types
    const typeCounts = countBy(data, "crime_type");
    const sortedTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

    charts.pie = new Chart(document.getElementById("pieChart"), {
        type: "doughnut",
        data: {
            labels: sortedTypes.map(t => t[0].toUpperCase()),
            datasets: [{
                data: sortedTypes.map(t => t[1]),
                backgroundColor: ["#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6"],
                borderWidth: 0
            }]
        },
        options: { ...commonOptions, scales: {} }
    });
    // --- 2. AUTH & USER DATA ---
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // Proceed with loading dashboard
            try {
                const userDoc = await getDoc(doc(db, "users", user.uid));
                // ... rest of your dashboard loading logic ...
            } catch (error) {
                console.error(error);
            }
        } else {
            // Only redirect if explicitly NOT logged in
            // Store current URL to redirect back after login if needed
            localStorage.setItem("redirectAfterLogin", window.location.href);
            window.location.href = "login.html";
        }
    });

    // 2. Line: Trends
    const yearCounts = countBy(data, "year");
    charts.line = new Chart(document.getElementById("lineChart"), {
        type: "line",
        data: {
            labels: Object.keys(yearCounts).sort(),
            datasets: [{
                label: "Incidents",
                data: Object.keys(yearCounts).sort().map(k => yearCounts[k]),
                borderColor: "#38bdf8",
                backgroundColor: "rgba(56, 189, 248, 0.2)",
                fill: true,
                tension: 0.4
            }]
        },
        options: commonOptions
    });

    // 3. Bar: Response Time
    const respCounts = countBy(data, "response_time_bucket");
    charts.bar = new Chart(document.getElementById("barChart"), {
        type: "bar",
        data: {
            labels: Object.keys(respCounts),
            datasets: [{
                label: "Count",
                data: Object.values(respCounts),
                backgroundColor: "#10B981"
            }]
        },
        options: commonOptions
    });

    // 4. Stacked: Severity
    const sevCounts = countBy(data, "crime_severity_level");
    charts.stacked = new Chart(document.getElementById("stackedBarChart"), {
        type: "bar",
        data: {
            labels: ["Severity"],
            datasets: [
                { label: 'High', data: [sevCounts['high'] || 0], backgroundColor: '#EF4444' },
                { label: 'Medium', data: [sevCounts['medium'] || 0], backgroundColor: '#F59E0B' },
                { label: 'Low', data: [sevCounts['low'] || 0], backgroundColor: '#10B981' }
            ]
        },
        options: {
            ...commonOptions,
            indexAxis: 'y',
            scales: { x: { stacked: true }, y: { stacked: true } }
        }
    });

    // 5. Cluster: Area Type
    const areaCounts = countBy(data, "area_type");
    charts.cluster = new Chart(document.getElementById("clusterBarChart"), {
        type: "bar",
        data: {
            labels: Object.keys(areaCounts),
            datasets: [{
                label: "Count",
                data: Object.values(areaCounts),
                backgroundColor: "#8B5CF6"
            }]
        },
        options: commonOptions
    });
}

function countBy(data, key) {
    return data.reduce((acc, item) => {
        const val = item[key];
        if (val) acc[val] = (acc[val] || 0) + 1;
        return acc;
    }, {});
}

// --- 7. LOGGING ---
async function logActivity(uid, action, details) {
    if (!uid) return;
    try {
        await addDoc(collection(db, "activity_logs"), {
            userId: uid,
            action: action,
            details: details,
            timestamp: Timestamp.now()
        });
        loadUserActivity(uid);
    } catch (e) { console.error("Log error", e); }
}

async function loadUserActivity(uid) {
    const tableBody = document.getElementById("activityTableBody");
    // Note: Simple display logic. For production, requires composite index in Firestore.
    // We simulate a basic display here.
    try {
        // Without index, complex queries fail. Simple solution for demo:
        // Use a simpler query or catch error gracefully.
        tableBody.innerHTML = "<tr><td colspan='3' class='text-center'>Activity logging active...</td></tr>";
    } catch (e) { console.log(e); }
}

// --- 8. LOGOUT ---
window.logout = async function () {
    await signOut(auth);
    localStorage.clear();
    window.location.href = "login.html";
};