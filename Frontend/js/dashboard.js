// dashboard2.js — Panel de control Velora

let incomeChart, barChart2;
let calendarInstance;
let unreadCount = 0;
let lastUnreadCount = 0;
let currentEventId = null;
let calendarCollapsed = false;

// Sonido de notificación
const notificationSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');

// ── Toggle Calendario Desplegable ──
window.toggleCalendar = function () {
    calendarCollapsed = !calendarCollapsed;
    const body = document.getElementById('calBody');
    const chevron = document.getElementById('calChevron');
    if (body) body.classList.toggle('collapsed', calendarCollapsed);
    if (chevron) chevron.classList.toggle('collapsed', calendarCollapsed);
    // Re-renderizar cuando se abre
    if (!calendarCollapsed && calendarInstance) {
        setTimeout(() => calendarInstance.updateSize(), 420);
    }
};

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
    setGreeting();
    setTimeout(() => {
        fetchDashboardData();
        fetchAdvancedStats();
        fetchAnalytics();
        fetchNotifications();
    }, 300);
    if (window.lucide) window.lucide.createIcons();

    // Iniciar el sistema de actualización automática (Real-time polling)
    // Verificamos cambios cada 15 segundos sin recargar la página
    setInterval(() => {
        fetchDashboardData(true); // Actualización silenciosa
        fetchNotifications();
    }, 15000);

    // Registro de Service Worker para PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(err => console.log('SW registration failed:', err));
    }
});

function setGreeting() {
    const h = new Date().getHours();
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const name = user.name ? user.name.split(' ')[0] : '';
    const greet = h < 12 ? 'Buenos días' : h < 18 ? 'Buenas tardes' : 'Buenas noches';
    const el = document.getElementById('dashGreeting');
    if (el) el.textContent = name ? `${greet}, ${name} 👋` : greet;

    const av = document.getElementById('userAvatar');
    if (av && name) av.textContent = name[0].toUpperCase();
}

// ── Fetch main data ───────────────────────────────────────────
window.fetchDashboardData = async function () {
    try {
        const [appointments, services, customers] = await Promise.all([
            ApiService.get('/appointments'),
            ApiService.get('/services'),
            ApiService.get('/customers').catch(() => [])
        ]);
        updateStats(appointments, services, customers);
        renderDashServices(services.slice(0, 5));
        renderRecentAppointments(appointments.slice(0, 5));
        renderCalendar(appointments);
    } catch (err) {
        console.error('fetchDashboardData error:', err);
    }
};

function updateStats(appointments, services, customers) {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const todayCount = appointments.filter(a => normalizeDateToIso(a.appointment_date) === todayStr).length;

    setEl('todayBookings', todayCount);
    setEl('totalServices', services.length);
    setEl('kpiBookings', appointments.length);
    setEl('kpiClients', Array.isArray(customers) ? customers.length : 0);
}

// ── Services Panel ────────────────────────────────────────────
const SERVICE_ICONS = ['scissors', 'heart', 'zap', 'star', 'activity', 'briefcase'];
function renderDashServices(services) {
    const container = document.getElementById('dashServicesList');
    if (!container) return;

    if (!services || services.length === 0) {
        container.innerHTML = `<div class="empty-state"><p>No hay servicios aún.<br><a href="/pages/services.html" class="dash-see-all">Crear servicio</a></p></div>`;
        return;
    }

    container.innerHTML = services.map((s, i) => `
        <div class="dash-service-item">
            <div class="dash-service-icon">
                <i data-lucide="${SERVICE_ICONS[i % SERVICE_ICONS.length]}"></i>
            </div>
            <div class="dash-service-info">
                <div class="dash-service-name">${s.name}</div>
                <div class="dash-service-desc">${s.description ? s.description.substring(0, 30) + '...' : 'Sin descripción'}</div>
            </div>
            <span class="dash-service-time">${s.duration || '--'} min</span>
            <span class="dash-service-badge">● Active</span>
        </div>
    `).join('');

    if (window.lucide) window.lucide.createIcons();
}

// ── Recent Appointments ───────────────────────────────────────
function renderRecentAppointments(appointments) {
    const container = document.getElementById('recentAppointments');
    if (!container) return;

    if (!appointments || appointments.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon"><i data-lucide="calendar-x"></i></div>
                <h3 class="empty-state-title">No hay citas aún</h3>
                <p class="empty-state-description">Comparte tu enlace de reservas para empezar a recibir clientes.</p>
                <button onclick="copyBookingLink()" class="dash-btn-primary btn-sm">Copiar enlace</button>
            </div>`;
        if (window.lucide) window.lucide.createIcons();
        return;
    }

    const statusMap = { confirmed: 'Confirmada', pending: 'Por confirmar', cancelled: 'Cancelada', completed: 'Completada', pending_payment: 'Verificar pago' };

    container.innerHTML = appointments.map(apt => {
        const hora = (apt.appointment_time || '--:--').substring(0, 5);
        const fecha = window.formatDateSpanish ? window.formatDateSpanish(apt.appointment_date) : apt.appointment_date;
        const estado = apt.status || 'pending';
        return `
            <div class="appointment-item">
                <div class="appointment-info">
                    <h4>${apt.client_name || 'Cliente'}</h4>
                    <p>${apt.service_name || 'Servicio'} • ${fecha} • ${hora}</p>
                </div>
                <span class="status-badge status-${estado}">${statusMap[estado] || estado}</span>
            </div>`;
    }).join('');
}

// ── Analytics ─────────────────────────────────────────────────
window.fetchAnalytics = async function () {
    try {
        const data = await ApiService.get('/analytics/stats');
        renderIncomeLineChart(data.income);
        renderBarChart(data.income);
        updateKpiFromAnalytics(data.kpis);
    } catch (err) {
        console.error('fetchAnalytics error:', err);
    }
};

function renderIncomeLineChart(incomeData) {
    const ctx = document.getElementById('incomeChart');
    if (!ctx) return;
    if (incomeChart) incomeChart.destroy();

    const labels = incomeData.length ? incomeData.map(d => d.month) : ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'];
    const totals = incomeData.length ? incomeData.map(d => parseFloat(d.total) || 0) : [0, 0, 0, 0, 0, 0];

    incomeChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                data: totals,
                borderColor: '#a855f7',
                backgroundColor: 'rgba(168,85,247,0.12)',
                tension: 0.45, fill: true,
                pointRadius: 4, pointBackgroundColor: '#a855f7', pointBorderWidth: 2, borderWidth: 2
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1a1628', titleColor: '#e2e0f0', bodyColor: '#a09db8', borderColor: 'rgba(168,85,247,0.3)', borderWidth: 1 } },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.04)' }, border: { display: false }, ticks: { color: '#4a4760', font: { size: 10 } } },
                x: { grid: { display: false }, border: { display: false }, ticks: { color: '#4a4760', font: { size: 10 } } }
            }
        }
    });
}

function renderBarChart(incomeData) {
    const ctx = document.getElementById('barChart');
    if (!ctx) return;
    if (barChart2) barChart2.destroy();

    const labels = incomeData.length ? incomeData.map(d => d.month) : ['Ene', 'Feb', 'Mar', 'Abr'];
    const totals = incomeData.length ? incomeData.map(d => parseFloat(d.total) || 0) : [0, 0, 0, 0];

    barChart2 = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                data: totals,
                backgroundColor: ['rgba(124,58,237,0.7)', 'rgba(168,85,247,0.7)', 'rgba(167,139,250,0.7)', 'rgba(196,181,253,0.7)'],
                borderRadius: 6, borderSkipped: false
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.04)' }, border: { display: false }, ticks: { color: '#4a4760', font: { size: 10 } } },
                x: { grid: { display: false }, border: { display: false }, ticks: { color: '#4a4760', font: { size: 10 } } }
            }
        }
    });
}

function updateKpiFromAnalytics(kpis) {
    if (!kpis) return;
    const rev = parseFloat(kpis.total_revenue) || 0;
    setEl('kpiRevenue', `$${rev.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    setEl('todayBookings', kpis.today_count || 0);
}

// ── Advanced Stats ────────────────────────────────────────────
window.fetchAdvancedStats = async function () {
    try {
        const data = await ApiService.get('/stats');
        if (data.occupationRate !== undefined) {
            setEl('kpiCompletion', data.occupationRate + '%');
        }
        const variation = parseFloat(data.weekComparison?.variation || 0);
        setEl('kpiGrowth', (variation >= 0 ? '+' : '') + variation + '%');
        const growthEl = document.getElementById('kpiGrowth');
        if (growthEl) growthEl.className = 'dash-kpi-value ' + (variation >= 0 ? 'dash-kpi-green' : 'dash-kpi-red');
    } catch (err) {
        console.error('fetchAdvancedStats error:', err);
    }
};

// ── Calendar ──────────────────────────────────────────────────
function renderCalendar(appointments) {
    const el = document.getElementById('calendar');
    if (!el) return;

    const events = appointments.map(apt => {
        const dateIso = normalizeDateToIso(apt.appointment_date);
        if (!dateIso) return null;
        const time = apt.appointment_time || '12:00';
        const colors = { confirmed: '#10b981', completed: '#818cf8', cancelled: '#ef4444' };
        const bg = colors[apt.status] || '#a855f7';
        return { id: apt.id, title: `${apt.client_name} - ${apt.service_name}`, start: `${dateIso}T${time}`, backgroundColor: bg, borderColor: bg, extendedProps: { ...apt } };
    }).filter(Boolean);

    if (calendarInstance) calendarInstance.destroy();

    calendarInstance = new FullCalendar.Calendar(el, {
        initialView: 'dayGridMonth',
        headerToolbar: { left: '', center: '', right: '' },
        locale: 'es',
        height: 'auto',
        buttonText: { today: 'Hoy', month: 'Mes', week: 'Semana', day: 'Día' },
        events,
        eventClick: info => openEventModal(info.event),
        eventDrop: info => updateApptDateTime(info.event.id, info.event.start, info.revert),
        editable: true,
        datesSet: info => {
            const titleEl = document.getElementById('calendarMonthTitle');
            if (titleEl) {
                const d = info.view.currentStart;
                const mes = d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
                titleEl.textContent = 'Calendario — ' + mes.charAt(0).toUpperCase() + mes.slice(1);
            }
        }
    });
    calendarInstance.render();

    // Botones prev/next personalizados (remover listener previo si existe)
    const prevBtn = document.getElementById('calPrev');
    const nextBtn = document.getElementById('calNext');
    if (prevBtn) { const clone = prevBtn.cloneNode(true); prevBtn.parentNode.replaceChild(clone, prevBtn); clone.addEventListener('click', () => calendarInstance.prev()); }
    if (nextBtn) { const clone = nextBtn.cloneNode(true); nextBtn.parentNode.replaceChild(clone, nextBtn); clone.addEventListener('click', () => calendarInstance.next()); }
    if (window.lucide) window.lucide.createIcons();
}

async function updateApptDateTime(id, newDateObj, revertFunc) {
    if (!confirm('¿Mover esta cita a la nueva fecha?')) { revertFunc(); return; }
    const dateIso = newDateObj.toISOString().split('T')[0];
    const timeStr = newDateObj.toTimeString().substring(0, 5);
    try {
        await ApiService.patch(`/appointments/${id}`, { appointment_date: dateIso, appointment_time: timeStr });
        if (window.showToast) window.showToast('Cita reprogramada', 'success');
    } catch (err) {
        if (window.showToast) window.showToast('Error al reprogramar: ' + err.message, 'error');
        revertFunc();
    }
}

window.goToToday = function () { if (calendarInstance) calendarInstance.today(); };

// ── Modal ─────────────────────────────────────────────────────
function openEventModal(event) {
    currentEventId = event.id;
    const p = event.extendedProps;
    setEl('modalClientName', p.client_name || 'Cliente');
    setEl('modalServiceName', p.service_name || 'Servicio');
    const d = event.start;
    setEl('modalDate', d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }));
    setEl('modalTime', (p.appointment_time || '--:--').substring(0, 5));
    const phoneEl = document.getElementById('modalPhone');
    if (phoneEl) { phoneEl.textContent = p.client_phone || 'No proporcionado'; phoneEl.href = p.client_phone ? `tel:${p.client_phone}` : '#'; }
    const statusMap = { pending: 'Por confirmar', confirmed: 'Confirmada', completed: 'Completada', cancelled: 'Cancelada', pending_payment: 'Verificar pago' };
    setEl('modalStatus', statusMap[p.status] || p.status || '-');
    document.getElementById('eventModal').style.display = 'flex';
}

window.closeEventModal = function () {
    document.getElementById('eventModal').style.display = 'none';
    currentEventId = null;
};

document.getElementById('btnCompleteAppt')?.addEventListener('click', () => updateApptStatus('completed'));
document.getElementById('btnCancelAppt')?.addEventListener('click', () => updateApptStatus('cancelled'));

async function updateApptStatus(status) {
    if (!currentEventId) return;
    let reason = null;
    if (status === 'cancelled') {
        reason = prompt('Motivo de cancelación (se enviará al cliente):');
        if (reason === null) return;
        if (!reason.trim()) { alert('Debes ingresar un motivo.'); return; }
    }
    try {
        await ApiService.patch(`/appointments/${currentEventId}`, { status, rejection_reason: reason });
        closeEventModal();
        if (window.showToast) window.showToast(status === 'cancelled' ? 'Cita cancelada' : 'Estado actualizado', 'success');
        fetchDashboardData();
        fetchAdvancedStats();
    } catch (err) { alert('Error: ' + err.message); }
}

// ── Notifications ─────────────────────────────────────────────
window.toggleNotifications = function () {
    const d = document.getElementById('notificationsDropdown');
    if (d) d.style.display = d.style.display === 'none' ? 'flex' : 'none';
};

window.fetchNotifications = async function () {
    try {
        const [notifications, countData] = await Promise.all([
            ApiService.get('/notifications'),
            ApiService.get('/notifications/unread-count')
        ]);
        unreadCount = countData.unreadCount || 0;

        // Si hay nuevas notificaciones, sonar
        if (unreadCount > lastUnreadCount) {
            notificationSound.play().catch(e => console.log('Audio play blocked:', e));
        }
        lastUnreadCount = unreadCount;

        const badge = document.getElementById('notificationBadge');
        if (badge) { badge.textContent = unreadCount > 99 ? '99+' : unreadCount; badge.style.display = unreadCount > 0 ? 'flex' : 'none'; }

        const list = document.getElementById('notificationsList');
        if (list) {
            if (!notifications.length) { list.innerHTML = '<div class="dash-notif-empty">No hay notificaciones</div>'; return; }
            list.innerHTML = notifications.map(n => `
                <div onclick="markNotificationAsRead(${n.id})" style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.04);cursor:pointer;font-size:13px;">
                    <div style="font-weight:600;color:#e2e0f0;margin-bottom:3px">${n.title}</div>
                    <div style="color:#6b6880">${n.message}</div>
                </div>`).join('');
        }
    } catch (err) { console.error('fetchNotifications error:', err); }
};

window.markNotificationAsRead = async (id) => {
    try { await ApiService.put(`/notifications/${id}/read`); fetchNotifications(); } catch (e) { }
};

window.markAllNotificationsAsRead = async () => {
    if (!unreadCount) return;
    try { await ApiService.put('/notifications/read-all'); fetchNotifications(); toggleNotifications(); } catch (e) { }
};

// ── Booking link ──────────────────────────────────────────────
window.copyBookingLink = function () {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (!user.id) { if (window.showToast) window.showToast('Error: usuario no encontrado', 'error'); return; }
    const url = `${window.location.origin}/pages/booking#business=${user.id}`;
    navigator.clipboard.writeText(url).then(() => {
        if (window.showToast) window.showToast('¡Enlace copiado!', 'success');
    }).catch(() => { if (window.showToast) window.showToast('No se pudo copiar', 'error'); });
};

// ── Helpers ───────────────────────────────────────────────────
function setEl(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
