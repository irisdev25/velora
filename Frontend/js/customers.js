// frontend/js/customers.js

let allCustomers = [];
let selectedCustomerId = null;

document.addEventListener('DOMContentLoaded', () => {
    loadCustomers();
});

const loadCustomers = async () => {
    try {
        const listContainer = document.getElementById('customersList');
        if (listContainer) {
            listContainer.innerHTML = `
                <div class="skeleton-card"><div class="skeleton-base skeleton-avatar"></div><div style="flex:1"><div class="skeleton-base skeleton-text" style="width:50%"></div><div class="skeleton-base skeleton-text" style="width:70%"></div></div></div>
                <div class="skeleton-card"><div class="skeleton-base skeleton-avatar"></div><div style="flex:1"><div class="skeleton-base skeleton-text" style="width:40%"></div><div class="skeleton-base skeleton-text" style="width:60%"></div></div></div>
                <div class="skeleton-card"><div class="skeleton-base skeleton-avatar"></div><div style="flex:1"><div class="skeleton-base skeleton-text" style="width:60%"></div><div class="skeleton-base skeleton-text" style="width:50%"></div></div></div>
            `;
        }
        const customers = await ApiService.get('/customers');
        allCustomers = customers;
        renderCustomerList(customers);
    } catch (error) {
        console.error('Error loading customers:', error);
        document.getElementById('customersList').innerHTML = '<p class="error">Error al cargar clientes</p>';
    }
};

const renderCustomerList = (customers) => {
    const list = document.getElementById('customersList');
    if (customers.length === 0) {
        list.innerHTML = '<div style="text-align: center; margin-top:60px;"><i data-lucide="search-x" style="width:40px;height:40px;color:var(--text-muted);"></i><p class="text-secondary">No se encontraron clientes.</p></div>';
        if (window.lucide) window.lucide.createIcons();
        return;
    }

    list.innerHTML = customers.map(c => `
        <div class="customer-card ${selectedCustomerId === c.id ? 'active' : ''}" onclick="selectCustomer(${c.id})">
            <div style="display: flex; align-items: center; gap: 16px;">
                <div class="cust-avatar">${(c.name || 'C')[0].toUpperCase()}</div>
                <div class="cust-info">
                    <h4>${c.name}</h4>
                    <p>${c.email}</p>
                </div>
            </div>
            <div class="cust-stats">
                <span class="total-spent">$${parseFloat(c.total_spent || 0).toFixed(0)}</span>
                <span class="visit-count">${c.total_appointments} citas</span>
                ${c.total_appointments >= 3 ? '<div class="frequent-badge"><i data-lucide="star" style="width:8px;height:8px;"></i> Frecuente</div>' : ''}
            </div>
        </div>
    `).join('');
};

window.filterCustomers = () => {
    const query = document.getElementById('custSearch').value.toLowerCase();
    const filtered = allCustomers.filter(c => 
        c.name.toLowerCase().includes(query) || 
        c.email.toLowerCase().includes(query)
    );
    renderCustomerList(filtered);
};

window.selectCustomer = async (id) => {
    selectedCustomerId = id;
    
    // Marcar como activo en la lista de forma robusta
    document.querySelectorAll('.customer-card').forEach(el => {
        el.classList.remove('active');
        // Usar una comparación basada en el onclick o un data-id si lo tuviéramos
        if (el.getAttribute('onclick').includes(`selectCustomer(${id})`)) {
            el.classList.add('active');
        }
    });

    const detailPanel = document.getElementById('customerDetail');
    detailPanel.innerHTML = '<div style="text-align: center; margin: auto;"><p>Cargando detalles...</p></div>';

    try {
        const data = await ApiService.get(`/customers/${id}`);
        const { profile, history, notes: customerNotes } = data;

        detailPanel.innerHTML = `
            <div class="detail-header">
                <div class="detail-avatar-large">${profile.name[0].toUpperCase()}</div>
                <h2 class="detail-name">${profile.name}</h2>
                <p class="detail-email">${profile.email}</p>
                <div class="quick-actions">
                    <a href="mailto:${profile.email}" class="action-btn-circle" title="Contactar por Email"><i data-lucide="mail"></i></a>
                    ${profile.phone ? `<a href="tel:${profile.phone}" class="action-btn-circle" title="Llamar"><i data-lucide="phone"></i></a>` : ''}
                </div>
            </div>

            <div class="kpi-grid">
                <div class="kpi-card">
                    <div class="kpi-label">Lifetime Value</div>
                    <div class="kpi-value" style="color: var(--accent-lime);">$${parseFloat(profile.total_spent || 0).toFixed(2)}</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-label">Frecuencia</div>
                    <div class="kpi-value">${profile.total_appointments} visitas</div>
                </div>
            </div>

            <div class="history-section">
                <h3 style="font-size: 15px; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
                    <i data-lucide="history" style="width:16px;"></i> Historial de Actividad
                </h3>
                ${history.length === 0 ? '<p class="text-muted">No hay citas registradas.</p>' : 
                  history.map(h => `
                    <div class="history-item">
                        <div class="history-header">
                            <span class="history-service">${h.service_name}</span>
                            <span class="history-price">$${parseFloat(h.price).toFixed(2)}</span>
                        </div>
                        <div class="history-meta">
                            <span>${window.formatDateSpanish(h.appointment_date)} • ${h.appointment_time.substring(0, 5)}</span>
                            <span class="status-badge status-${h.status}">${h.status}</span>
                        </div>
                    </div>
                `).join('')}
            </div>

            <div class="notes-section">
                <h3 style="font-size: 15px; margin-bottom: 4px;">Notas Internas</h3>
                <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px;">Cronología de seguimiento privada.</p>
                
                <div id="notesTimeline" class="notes-timeline">
                    ${customerNotes.length === 0 ? '<p class="text-muted" id="noNotesMsg">Aún no hay notas para este cliente.</p>' : 
                      customerNotes.map(n => `
                        <div class="note-bubble">
                            <p class="note-content">${n.content}</p>
                            <span class="note-date">${new Date(n.created_at).toLocaleString()}</span>
                        </div>
                    `).join('')}
                </div>

                <div class="add-note-container" style="margin-top: 20px;">
                    <textarea id="newNoteContent" class="notes-area" rows="2" placeholder="Escribe algo importante sobre este cliente..."></textarea>
                    <button onclick="saveNotes()" class="btn-primary" style="margin-top: 10px; width: 100%; padding: 12px;">Agregar Nota</button>
                </div>
            </div>
        `;
        if (window.lucide) window.lucide.createIcons();
    } catch (error) {
        console.error('Error fetching details:', error);
        detailPanel.innerHTML = '<div style="text-align: center; margin: auto;"><p class="error">Error al cargar detalles.</p></div>';
    }
};

window.saveNotes = async () => {
    const content = document.getElementById('newNoteContent').value;
    if (!content.trim()) return;

    try {
        const newNote = await ApiService.post(`/customers/${selectedCustomerId}/notes`, { content });
        
        // Quitar mensaje de "no hay notas" si existe
        const noNotesMsg = document.getElementById('noNotesMsg');
        if (noNotesMsg) noNotesMsg.remove();

        // Añadir a la lista visualmente arriba
        const timeline = document.getElementById('notesTimeline');
        const noteDiv = document.createElement('div');
        noteDiv.className = 'note-bubble';
        noteDiv.innerHTML = `
            <p class="note-content">${newNote.content}</p>
            <span class="note-date">${new Date(newNote.created_at).toLocaleString()}</span>
        `;
        timeline.prepend(noteDiv);
        
        // Limpiar input
        document.getElementById('newNoteContent').value = '';
        window.showToast('Nota agregada', 'success');
    } catch (error) {
        console.error(error);
        window.showToast('Error al guardar nota', 'error');
    }
};
