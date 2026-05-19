// ============================================
// SKINCONCEPT DASHBOARD — Shared Module
// ============================================

// ============ FIREBASE ============
firebase.initializeApp({
    apiKey: "AIzaSyAdGdgPnS3Cw3Rpiubx6_s61FyfiTQxfFc",
    authDomain: "skinconcept-tool.firebaseapp.com",
    projectId: "skinconcept-tool",
    storageBucket: "skinconcept-tool.firebasestorage.app",
    messagingSenderId: "188823880943",
    appId: "1:188823880943:web:ae87750be002cbe491071a"
});
const db = firebase.firestore();

// ============ NAVIGATION ============
const NAV_ITEMS = [
    { href: 'index.html', icon: '\u2302', label: 'Home' },
    { href: 'http://localhost:3000', icon: '\u2728', label: 'Office', external: true },
    { href: 'aufgaben.html', icon: '\u2611', label: 'Aufgaben' },
    { href: 'kundenkartei.html', icon: '\uD83D\uDCC7', label: 'Kundenkartei' },
    { href: 'gutscheine.html', icon: '\uD83C\uDF81', label: 'Gutscheine' },
    { href: 'monatsabschluss.html', icon: '\uD83D\uDCCA', label: 'Elena Monatsabschluss' },
    { href: 'crm.html', icon: '\uD83D\uDC8E', label: 'CRM' },
    { href: 'hautapp.html', icon: '\u2728', label: 'HautApp' }
];

function initNavigation() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    const currentPage = window.location.pathname.split('/').pop() || 'index.html';

    sidebar.innerHTML = `
        <div class="sidebar-brand">
            <h1>SKINCONCEPT</h1>
            <span>Studio Hub</span>
        </div>
        <nav class="sidebar-nav">
            ${NAV_ITEMS.map(item => `
                <a href="${item.href}" ${item.external ? 'target="_blank" rel="noopener"' : ''} class="sidebar-link ${currentPage === item.href ? 'active' : ''}${item.external ? ' sidebar-link-external' : ''}">
                    <span class="icon">${item.icon}</span>
                    ${item.label}${item.external ? ' <span style="opacity:0.5; font-size:11px; margin-left:auto">↗</span>' : ''}
                </a>
            `).join('')}
        </nav>
        <div class="sidebar-footer">Skinconcept Hagner &middot; Morbach</div>
    `;

    // Mobile menu
    const toggle = document.querySelector('.menu-toggle');
    const overlay = document.querySelector('.sidebar-overlay');
    if (toggle) {
        toggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
            overlay.classList.toggle('open');
        });
    }
    if (overlay) {
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            overlay.classList.remove('open');
        });
    }
}

// ============ TOAST NOTIFICATIONS ============
function showToast(message, type = '') {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.className = 'toast' + (type ? ' ' + type : '');
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ============ UTILITY FUNCTIONS ============
function formatCurrency(amount) {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateShort(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

function todayStr() {
    return new Date().toISOString().slice(0, 10);
}

function getMonthName(monthIndex) {
    const months = ['Januar','Februar','M\u00e4rz','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
    return months[monthIndex];
}

function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// Get start of current week (Monday)
function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    return d;
}

// ============ INIT ============
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
});
