
// Global variables
let threatData = {
    timeline: {
        labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '23:59'],
        datasets: [
            { label: 'Critical', data: [2, 5, 3, 8, 4, 6, 3], color: '#ff3d71' },
            { label: 'High', data: [5, 7, 4, 9, 6, 8, 5], color: '#ffaa00' },
            { label: 'Total', data: [12, 18, 14, 22, 16, 20, 14], color: '#00f0ff' }
        ]
    },
    distribution: {
        labels: ['Ransomware', 'Phishing', 'DDoS', 'Insider', 'Malware', 'Exploits'],
        data: [15, 25, 10, 5, 30, 15],
        colors: ['#ff3d71', '#ffaa00', '#00e096', '#00f0ff', '#8a2be2', '#ff6b81']
    },
    stats: {
        threats: 142,
        critical: 23,
        falsePositives: 8,
        responseTime: 3.2
    }
};

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
    quickScanBtn: document.querySelector('.btn-primary')
};

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    initCharts();
    initEventListeners();
    simulateRealTimeUpdates();
    animateElements();
});

// Chart Initialization
function initCharts() {
    // Threat Timeline Chart
    new Chart(elements.timelineChart.getContext('2d'), {
        type: 'line',
        data: {
            labels: threatData.timeline.labels,
            datasets: threatData.timeline.datasets.map(dataset => ({
                label: dataset.label,
                data: dataset.data,
                borderColor: dataset.color,
                backgroundColor: `${dataset.color}20`,
                borderWidth: 2,
                tension: 0.3,
                fill: true
            }))
        },
        options: getChartOptions('Threats per hour')
    });

    // Threat Distribution Chart
    new Chart(elements.distributionChart.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: threatData.distribution.labels,
            datasets: [{
                data: threatData.distribution.data,
                backgroundColor: threatData.distribution.colors,
                borderColor: '#0a0e17',
                borderWidth: 2
            }]
        },
        options: getChartOptions('Threat Type Distribution', true)
    });
}

// Chart Options Generator
function getChartOptions(title, isDoughnut = false) {
    const baseOptions = {
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
    
    return baseOptions;
}

// Event Listeners
function initEventListeners() {
    // Time filter buttons
    elements.timeFilter.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            document.querySelector('.time-filter button.active').classList.remove('active');
            e.target.classList.add('active');
            updateDataForTimeRange(e.target.textContent);
        }
    });

    // Quick scan button
    elements.quickScanBtn.addEventListener('click', () => {
        startQuickScan();
    });

    // Threat item click
    elements.threatList.addEventListener('click', (e) => {
        const threatItem = e.target.closest('.threat-item');
        if (threatItem) {
            showThreatDetails(threatItem);
        }
    });
}

// Time range data update
function updateDataForTimeRange(range) {
    // Simulate data changes based on time range
    const multipliers = {
        '24h': 1,
        '7d': 0.8,
        '30d': 0.6,
        '90d': 0.4,
        'Custom': 1.2
    };
    
    const multiplier = multipliers[range] || 1;
    
    threatData.timeline.datasets.forEach(dataset => {
        dataset.data = dataset.data.map(value => 
            Math.max(1, Math.round(value * multiplier * (0.8 + Math.random() * 0.4)))
        );
    });
    
    threatData.distribution.data = threatData.distribution.data.map(value => 
        Math.max(1, Math.round(value * multiplier * (0.7 + Math.random() * 0.6)))
    );
    
    // Update stats
    updateStats({
        threats: Math.round(threatData.stats.threats * multiplier),
        critical: Math.round(threatData.stats.critical * multiplier * 1.2),
        falsePositives: Math.min(15, Math.round(threatData.stats.falsePositives * (0.8 + Math.random() * 0.4))),
        responseTime: (threatData.stats.responseTime * (0.9 + Math.random() * 0.2)).toFixed(1)
    });
    
    // Re-render charts would need to be implemented with Chart.js update methods
    // In a real app, we would fetch new data from the server here
}

// Stats update
function updateStats(newStats) {
    Object.keys(newStats).forEach(key => {
        if (elements.statValues[key]) {
            animateValueChange(elements.statValues[key], parseInt(elements.statValues[key].textContent), newStats[key]);
        }
    });
    threatData.stats = {...threatData.stats, ...newStats};
}

// Value change animation
function animateValueChange(element, start, end) {
    const duration = 1000;
    const startTime = performance.now();
    
    function updateValue(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const value = Math.floor(start + (end - start) * progress);
        element.textContent = value;
        
        if (progress < 1) {
            requestAnimationFrame(updateValue);
        }
    }
    
    requestAnimationFrame(updateValue);
}

// Quick scan simulation
function startQuickScan() {
    const originalText = elements.quickScanBtn.innerHTML;
    elements.quickScanBtn.disabled = true;
    elements.quickScanBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Scanning...';
    
    // Simulate scan
    setTimeout(() => {
        // Generate random scan results
        const threatsFound = Math.floor(Math.random() * 5);
        const vulnerabilities = Math.floor(Math.random() * 3);
        
        // Update UI
        if (threatsFound > 0 || vulnerabilities > 0) {
            showScanResults(threatsFound, vulnerabilities);
        } else {
            showToast('Scan complete: No threats found', 'success');
        }
        
        elements.quickScanBtn.innerHTML = originalText;
        elements.quickScanBtn.disabled = false;
    }, 3000);
}

// Scan results modal
function showScanResults(threats, vulnerabilities) {
    // In a real app, this would be a proper modal
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
            <button class="btn btn-primary" id="resolveThreats">
                <i class="fas fa-bolt"></i> Resolve Threats
            </button>
        </div>
    `;
    
    showModal('Quick Scan Results', resultsHTML);
    
    document.getElementById('resolveThreats')?.addEventListener('click', () => {
        showToast('Threat resolution in progress...', 'info');
        setTimeout(() => {
            showToast('All threats resolved successfully!', 'success');
            closeModal();
        }, 2000);
    });
}

// Threat details
function showThreatDetails(threatItem) {
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
    
    const severity = threatItem.classList.contains('critical') ? 'critical' : 
                    threatItem.classList.contains('high') ? 'high' : 'medium';
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

// Modal system
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

// Toast notifications
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

// Real-time simulation
function simulateRealTimeUpdates() {
    // Simulate new threats
    setInterval(() => {
        addRandomThreat();
    }, 15000);
    
    // Simulate stats fluctuations
    setInterval(() => {
        updateStats({
            threats: threatData.stats.threats + Math.floor(Math.random() * 3),
            critical: threatData.stats.critical + (Math.random() > 0.7 ? 1 : 0),
            falsePositives: Math.max(2, Math.min(15, 
                threatData.stats.falsePositives + (Math.random() > 0.5 ? 0.2 : -0.2))),
            responseTime: Math.max(1.5, Math.min(5, 
                parseFloat(threatData.stats.responseTime) + (Math.random() > 0.5 ? 0.1 : -0.1))).toFixed(1)
        });
    }, 10000);
}

function addRandomThreat() {
    const threatTypes = [
        { 
            class: 'critical', 
            icon: 'skull', 
            name: 'Ransomware Attempt', 
            desc: 'Detected encryption process on Server-' + (Math.floor(Math.random() * 20) + 1 )
        },
        { 
            class: 'high', 
            icon: 'user-secret', 
            name: 'Brute Force Attack', 
            desc: Math.floor(Math.random() * 20) + ' failed logins on admin account' 
        },
        { 
            class: 'medium', 
            icon: 'network-wired', 
            name: 'Port Scanning', 
            desc: 'Multiple ports scanned from ' + generateRandomIP() 
        },
        { 
            class: 'high', 
            icon: 'code', 
            name: 'SQL Injection', 
            desc: 'Detected on ' + ['login form', 'search page', 'contact form'][Math.floor(Math.random() * 3)] 
        },
        { 
            class: 'medium', 
            icon: 'envelope', 
            name: 'Phishing Email', 
            desc: 'Detected in ' + ['CEO', 'HR', 'Finance'][Math.floor(Math.random() * 3)] + ' mailbox' 
        }
    ];
    
    const randomThreat = threatTypes[Math.floor(Math.random() * threatTypes.length)];
    const threatHTML = `
        <div class="threat-item ${randomThreat.class}">
            <div class="threat-icon">
                <i class="fas fa-${randomThreat.icon}"></i>
            </div>
            <div class="threat-content">
                <h5>${randomThreat.name}</h5>
                <p>${randomThreat.desc}</p>
            </div>
            <div class="threat-time">just now</div>
        </div>
    `;
    
    elements.threatList.insertAdjacentHTML('afterbegin', threatHTML);
    
    // Animate new threat
    anime({
        targets: elements.threatList.firstChild,
        translateX: [50, 0],
        opacity: [0, 1],
        duration: 500,
        easing: 'easeOutExpo'
    });
    
    // Keep only last 10 threats
    if (elements.threatList.children.length > 10) {
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
    
    // Show toast notification for critical threats
    if (randomThreat.class === 'critical') {
        showToast(`Critical threat detected: ${randomThreat.name}`, 'danger');
    }
}

function generateRandomIP() {
    return `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
}

// Initial animations
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
