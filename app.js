// Global Threat Data Store
let threatData = {
    timeline: { labels: [], datasets: [] },
    distribution: { labels: [], data: [], colors: [] },
    stats: { threats: 0, critical: 0, falsePositives: 0, responseTime: 0 },
    alerts: []
};

// Configuration
const API_BASE_URL = 'http://127.0.0.1:5000';
const POLL_INTERVAL = 3000; // 3 seconds for real-time updates
const MAX_RETRIES = 5;
let currentRetries = 0;
let pollingInterval;

// DOM Elements
const elements = {
    timelineChart: document.getElementById('timelineChart'),
    distributionChart: document.getElementById('distributionChart'),
    threatList: document.querySelector('.threat-list-content'),
    statCards: document.querySelectorAll('.stat-card'),
    statValues: {
        threats: document.querySelector('.stat-card:nth-child(1) .stat-value'),
        critical: document.querySelector('.stat-card:nth-child(2) .stat-value'),
        falsePositives: document.querySelector('.stat-card:nth-child(3) .stat-value'),
        responseTime: document.querySelector('.stat-card:nth-child(4) .stat-value')
    },
    timeFilter: document.querySelector('.time-filter'),
    quickScanBtn: document.querySelector('.btn-primary'),
    connectionStatus: document.getElementById('connectionStatus'),
    reconnectBtn: document.getElementById('reconnectBtn'),
    loadingIndicator: document.getElementById('loadingIndicator')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', function() {
    initCharts();
    initEventListeners();
    loadInitialData();
    animateElements();
});

// ======================== Data Fetching ========================

async function loadInitialData() {
    try {
        showLoading(true);
        updateConnectionStatus('connecting');
        
        const [stats, timeline, distribution] = await Promise.all([
            fetchAPI('/api/stats'),
            fetchAPI('/api/timeline'),
            fetchAPI('/api/distribution')
        ]);

        threatData = {
            timeline: timeline.data || { labels: [], datasets: [] },
            distribution: distribution.data || { labels: [], data: [], colors: [] },
            stats: stats.data || { threats: 0, critical: 0, falsePositives: 0, responseTime: 0 },
            alerts: []
        };

        updateAllCharts();
        updateStats(threatData.stats);
        updateConnectionStatus('connected');
        startPolling();
        
    } catch (error) {
        console.error("Initial load failed:", error);
        handleDataError(error);
    } finally {
        showLoading(false);
    }
}

async function fetchAPI(endpoint) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
}

function startPolling() {
    // Clear any existing interval
    if (pollingInterval) clearInterval(pollingInterval);
    
    pollingInterval = setInterval(async () => {
        try {
            const updates = await fetchAPI('/api/updates');
            processUpdates(updates);
            currentRetries = 0; // Reset retry counter on success
            updateConnectionStatus('connected');
        } catch (error) {
            console.error("Polling error:", error);
            currentRetries++;
            
            if (currentRetries >= MAX_RETRIES) {
                updateConnectionStatus('disconnected');
                clearInterval(pollingInterval);
            }
        }
    }, POLL_INTERVAL);
}

function processUpdates(updates) {
    if (!updates) return;

    // Update timeline if present
    if (updates.timeline) {
        // Merge new timeline data
        threatData.timeline.labels = [...threatData.timeline.labels, ...updates.timeline.labels];
        updates.timeline.datasets.forEach((newDataset, i) => {
            if (threatData.timeline.datasets[i]) {
                threatData.timeline.datasets[i].data = [
                    ...threatData.timeline.datasets[i].data,
                    ...newDataset.data
                ];
            }
        });
        updateTimelineChart();
    }
    
    // Update distribution if present
    if (updates.distribution) {
        threatData.distribution = updates.distribution;
        updateDistributionChart();
    }
    
    // Update stats if present
    if (updates.stats) {
        threatData.stats = { ...threatData.stats, ...updates.stats };
        updateStats(updates.stats);
    }
    
    // Add new threat alert if present
    if (updates.newAlert) {
        addNewThreatAlert(updates.newAlert);
    }
}

// ======================== UI Updates ========================

function updateAllCharts() {
    updateTimelineChart();
    updateDistributionChart();
}

function updateTimelineChart() {
    if (!window.timelineChart) return;
    
    window.timelineChart.data.labels = threatData.timeline.labels;
    window.timelineChart.data.datasets.forEach((dataset, i) => {
        if (threatData.timeline.datasets[i]) {
            dataset.data = threatData.timeline.datasets[i].data;
            if (threatData.timeline.datasets[i].color) {
                dataset.borderColor = threatData.timeline.datasets[i].color;
                dataset.backgroundColor = `${threatData.timeline.datasets[i].color}20`;
            }
        }
    });
    
    // Limit to last 100 data points for performance
    if (window.timelineChart.data.labels.length > 100) {
        window.timelineChart.data.labels = window.timelineChart.data.labels.slice(-100);
        window.timelineChart.data.datasets.forEach(dataset => {
            dataset.data = dataset.data.slice(-100);
        });
    }
    
    window.timelineChart.update();
}

function updateDistributionChart() {
    if (!window.distributionChart) return;
    
    window.distributionChart.data.labels = threatData.distribution.labels;
    window.distributionChart.data.datasets[0].data = threatData.distribution.data;
    
    if (threatData.distribution.colors) {
        window.distributionChart.data.datasets[0].backgroundColor = threatData.distribution.colors;
    }
    
    window.distributionChart.update();
}

function updateStats(newStats) {
    Object.keys(newStats).forEach(key => {
        if (elements.statValues[key]) {
            animateValueChange(
                elements.statValues[key],
                parseFloat(elements.statValues[key].textContent) || 0,
                newStats[key]
            );
        }
    });
}

function animateValueChange(element, start, end) {
    const duration = 800;
    const startTime = performance.now();
    
    function updateValue(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const value = start + (end - start) * progress;
        element.textContent = typeof end === 'number' ? 
            Math.floor(value) : value.toFixed(1);
        
        if (progress < 1) {
            requestAnimationFrame(updateValue);
        }
    }
    
    requestAnimationFrame(updateValue);
}

// ======================== Threat Management ========================

function addNewThreatAlert(threat) {
    if (!threat) return;
    
    // Add to alerts history
    threat.timestamp = new Date().toISOString();
    threatData.alerts.unshift(threat);
    
    // Keep only the last 50 alerts
    if (threatData.alerts.length > 50) {
        threatData.alerts.pop();
    }
    
    // Create and append alert element
    const threatHTML = `
        <div class="threat-item ${threat.severity}">
            <div class="threat-icon">
                <i class="fas fa-${threat.icon || 'exclamation-triangle'}"></i>
            </div>
            <div class="threat-content">
                <h5>${threat.name}</h5>
                <p>${threat.description}</p>
            </div>
            <div class="threat-time">just now</div>
        </div>
    `;

    elements.threatList.insertAdjacentHTML('afterbegin', threatHTML);
    
    // Animate entry
    anime({
        targets: elements.threatList.firstChild,
        translateX: [50, 0],
        opacity: [0, 1],
        duration: 500,
        easing: 'easeOutExpo'
    });

    // Limit to 15 visible threats
    if (elements.threatList.children.length > 15) {
        anime({
            targets: elements.threatList.lastChild,
            opacity: 0,
            height: 0,
            marginBottom: 0,
            paddingTop: 0,
            paddingBottom: 0,
            duration: 300,
            easing: 'easeInQuad',
            complete: () => elements.threatList.lastChild.remove()
        });
    }

    // Show alert for critical threats
    if (threat.severity === 'critical') {
        showToast(`Critical threat: ${threat.name}`, 'danger');
    }
}

// ======================== User Interactions ========================

function initEventListeners() {
    // Time filter buttons
    if (elements.timeFilter) {
        elements.timeFilter.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON') {
                document.querySelector('.time-filter button.active')?.classList.remove('active');
                e.target.classList.add('active');
                updateDataForTimeRange(e.target.textContent.trim());
            }
        });
    }

    // Quick scan button
    if (elements.quickScanBtn) {
        elements.quickScanBtn.addEventListener('click', startQuickScan);
    }

    // Threat item click
    if (elements.threatList) {
        elements.threatList.addEventListener('click', (e) => {
            const threatItem = e.target.closest('.threat-item');
            if (threatItem) showThreatDetails(threatItem);
        });
    }

    // Reconnect button
    if (elements.reconnectBtn) {
        elements.reconnectBtn.addEventListener('click', () => {
            elements.reconnectBtn.disabled = true;
            loadInitialData().finally(() => {
                elements.reconnectBtn.disabled = false;
            });
        });
    }
}

async function updateDataForTimeRange(range) {
    try {
        showLoading(true);
        const data = await fetchAPI(`/api/threats?range=${encodeURIComponent(range)}`);
        
        threatData.timeline = data.timeline || threatData.timeline;
        threatData.distribution = data.distribution || threatData.distribution;
        threatData.stats = data.stats || threatData.stats;
        
        updateAllCharts();
        updateStats(threatData.stats);
        
    } catch (error) {
        console.error("Time range update failed:", error);
        showToast("Failed to load time range data", "danger");
    } finally {
        showLoading(false);
    }
}

async function startQuickScan() {
    const originalText = elements.quickScanBtn.innerHTML;
    elements.quickScanBtn.disabled = true;
    elements.quickScanBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Scanning...';
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/quick-scan`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const result = await response.json();
        
        if (result.threatsFound > 0 || result.vulnerabilities > 0) {
            showScanResults(result.threatsFound, result.vulnerabilities);
        } else {
            showToast('Scan complete: No threats found', 'success');
        }
    } catch (error) {
        console.error("Scan error:", error);
        showToast("Scan failed", "danger");
    } finally {
        elements.quickScanBtn.innerHTML = originalText;
        elements.quickScanBtn.disabled = false;
    }
}

// ======================== UI Components ========================

function showScanResults(threats, vulnerabilities) {
    const resultsHTML = `
        <div class="scan-results">
            <h4><i class="fas fa-search"></i> Scan Results</h4>
            <div class="result-item ${threats ? 'danger' : 'success'}">
                <i class="fas fa-${threats ? 'exclamation-triangle' : 'check-circle'}"></i>
                <span>${threats} active threats detected</span>
            </div>
            <div class="result-item ${vulnerabilities ? 'warning' : 'success'}">
                <i class="fas fa-${vulnerabilities ? 'bug' : 'shield-alt'}"></i>
                <span>${vulnerabilities} vulnerabilities found</span>
            </div>
        </div>
    `;
    
    showModal('Quick Scan Results', resultsHTML);
    
}

function showThreatDetails(threatItem) {
    const severity = threatItem.classList.contains('critical') ? 'critical' : 
                    threatItem.classList.contains('high') ? 'high' : 'medium';
    
    const threatTypes = {
        critical: {
            title: 'Critical Threat',
            icon: 'skull',
            color: '#ff3d71',
            actions: ['Isolate', 'Terminate', 'Investigate']
        },
        high: {
            title: 'High Severity Threat',
            icon: 'user-secret',
            color: '#ffaa00',
            actions: ['Block', 'Analyze', 'Monitor']
        },
        medium: {
            title: 'Medium Severity Threat',
            icon: 'exclamation-circle',
            color: '#00e096',
            actions: ['Log', 'Review', 'Notify']
        }
    };
    
    const threatType = threatTypes[severity];
    const title = threatItem.querySelector('h5').textContent;
    const description = threatItem.querySelector('p').textContent;
    
    const actionsHTML = threatType.actions.map(action => `
        <button class="action-btn" style="border-color: ${threatType.color}">
            <i class="fas fa-${getActionIcon(action)}"></i> ${action}
        </button>
    `).join('');
    
    const detailsHTML = `
        <div class="threat-details">
            <div class="threat-header" style="color: ${threatType.color}">
                <i class="fas fa-${threatType.icon}"></i>
                <h3>${threatType.title}</h3>
            </div>
            <div class="threat-content">
                <h4>${title}</h4>
                <p>${description}</p>
                <div class="threat-meta">
                    <div><i class="fas fa-clock"></i> ${threatItem.querySelector('.threat-time').textContent}</div>
                    <div><i class="fas fa-server"></i> Server-${Math.floor(Math.random() * 20) + 1}</div>
                    <div><i class="fas fa-user"></i> ${Math.random() > 0.5 ? 'External' : 'Internal'}</div>
                </div>
            </div>
            <div class="threat-actions">
                ${actionsHTML}
            </div>
        </div>
    `;
    
    showModal('Threat Details', detailsHTML);
}

function getActionIcon(action) {
    const icons = {
        'Isolate': 'network-wired',
        'Terminate': 'power-off',
        'Investigate': 'search',
        'Block': 'ban',
        'Analyze': 'chart-bar',
        'Monitor': 'eye',
        'Log': 'clipboard-list',
        'Review': 'clipboard-check',
        'Notify': 'bell'
    };
    return icons[action] || 'cog';
}

// ======================== Utility Functions ========================

function showLoading(show) {
    if (elements.loadingIndicator) {
        elements.loadingIndicator.style.display = show ? 'block' : 'none';
    }
}

function updateConnectionStatus(status) {
    if (!elements.connectionStatus) return;
    
    const statusConfig = {
        connected: {
            class: 'connected',
            icon: 'check-circle',
            text: 'Connected'
        },
        disconnected: {
            class: 'disconnected',
            icon: 'exclamation-triangle',
            text: 'Disconnected'
        },
        connecting: {
            class: 'connecting',
            icon: 'sync-alt fa-spin',
            text: 'Connecting...'
        }
    };
    
    const config = statusConfig[status] || statusConfig.disconnected;
    
    elements.connectionStatus.className = `connection-status ${config.class}`;
    elements.connectionStatus.innerHTML = `<i class="fas fa-${config.icon}"></i> ${config.text}`;
    
    if (elements.reconnectBtn) {
        elements.reconnectBtn.style.display = status === 'disconnected' ? 'block' : 'none';
    }
}

function handleDataError(error) {
    console.error("Data error:", error);
    updateConnectionStatus('disconnected');
    showToast("Connection to server failed", "danger");
    
    // Schedule retry
    if (currentRetries < MAX_RETRIES) {
        setTimeout(() => {
            currentRetries++;
            loadInitialData();
        }, 5000);
    }
}

function showModal(title, content) {
    const modalHTML = `
        <div class="modal-overlay">
            <div class="modal">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    const modal = document.querySelector('.modal-overlay');
    anime({
        targets: modal,
        opacity: [0, 1],
        duration: 300,
        easing: 'easeOutQuad'
    });
    
    anime({
        targets: modal.querySelector('.modal'),
        scale: [0.9, 1],
        opacity: [0, 1],
        duration: 400,
        easing: 'easeOutBack'
    });
    
    document.querySelector('.modal-close').addEventListener('click', closeModal);
}

function closeModal() {
    const modal = document.querySelector('.modal-overlay');
    if (modal) {
        anime({
            targets: modal,
            opacity: 0,
            duration: 200,
            easing: 'easeInQuad',
            complete: () => modal.remove()
        });
    }
}

function showToast(message, type = 'info') {
    const colors = {
        info: '#00f0ff',
        success: '#00e096',
        warning: '#ffaa00',
        danger: '#ff3d71'
    };
    
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.style.borderLeft = `4px solid ${colors[type]}`;
    toast.innerHTML = `
        <i class="fas fa-${getToastIcon(type)}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(toast);
    
    anime({
        targets: toast,
        translateX: ['100%', 0],
        opacity: [0, 1],
        duration: 400,
        easing: 'easeOutExpo'
    });
    
    setTimeout(() => {
        anime({
            targets: toast,
            translateX: '100%',
            opacity: 0,
            duration: 400,
            easing: 'easeInExpo',
            complete: () => toast.remove()
        });
    }, 5000);
}

function getToastIcon(type) {
    const icons = {
        info: 'info-circle',
        success: 'check-circle',
        warning: 'exclamation-triangle',
        danger: 'times-circle'
    };
    return icons[type] || 'info-circle';
}

// ======================== Chart Initialization ========================

function initCharts() {
    // Timeline Chart
    window.timelineChart = new Chart(elements.timelineChart.getContext('2d'), {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Threats',
                data: [],
                borderColor: '#00f0ff',
                backgroundColor: 'rgba(0, 240, 255, 0.1)',
                borderWidth: 2,
                tension: 0.3,
                fill: true
            }]
        },
        options: getChartOptions('Threats Over Time')
    });

    // Distribution Chart
    window.distributionChart = new Chart(elements.distributionChart.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: [
                    '#ff3d71', '#ffaa00', '#00e096', '#00f0ff', '#8a2be2'
                ],
                borderColor: '#0a0e17',
                borderWidth: 2
            }]
        },
        options: getChartOptions('Threat Distribution', true)
    });
}

function getChartOptions(title, isDoughnut = false) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top',
                labels: { color: '#e0f7fa' }
            },
            tooltip: {
                mode: isDoughnut ? 'point' : 'index',
                intersect: false,
                callbacks: isDoughnut ? {
                    label: (context) => {
                        const label = context.label || '';
                        const value = context.raw || 0;
                        const total = context.dataset.data.reduce((a, b) => a + b, 0);
                        const percentage = Math.round((value / total) * 100);
                        return `${label}: ${value} (${percentage}%)`;
                    }
                } : {}
            },
            title: {
                display: !!title,
                text: title,
                color: '#e0f7fa',
                font: { size: 14 }
            }
        },
        scales: isDoughnut ? {} : {
            x: {
                grid: { color: 'rgba(224, 247, 250, 0.1)' },
                ticks: { color: '#e0f7fa' }
            },
            y: {
                grid: { color: 'rgba(224, 247, 250, 0.1)' },
                ticks: { color: '#e0f7fa' },
                beginAtZero: true
            }
        },
        interaction: {
            mode: 'nearest',
            axis: 'x',
            intersect: false
        },
        cutout: isDoughnut ? '70%' : undefined
    };
}

// ======================== Animations ========================

function animateElements() {
    // Stat cards animation
    anime({
        targets: '.stat-card',
        translateY: [20, 0],
        opacity: [0, 1],
        delay: anime.stagger(100),
        duration: 800,
        easing: 'easeOutExpo'
    });
    
    // Sidebar items animation
    anime({
        targets: '.sidebar-menu li',
        translateX: [-20, 0],
        opacity: [0, 1],
        delay: anime.stagger(50),
        duration: 500,
        easing: 'easeOutQuad'
    });
    
    // Background animation
    anime({
        targets: 'body',
        backgroundPosition: ['0% 0%', '100% 100%'],
        duration: 30000,
        easing: 'linear',
        loop: true,
        direction: 'alternate'
    });
}