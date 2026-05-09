// frontend/js/appointments.js
const fetchAppointments = async () => {
  try {
    const appointments = await ApiService.get('/appointments');
    displayAppointments(appointments);
  } catch (error) {
    console.error('Error fetching appointments:', error);
  }
};

// Display appointments in table
const displayAppointments = (appointments) => {
  const container = document.getElementById('appointmentsTable');
  
  if (appointments.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon"><i data-lucide="calendar-x"></i></div><p class="empty-state-title">Sin citas registradas</p><p class="empty-state-description">Aún no tienes citas agendadas.</p></div>';
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  let html = '<div style="overflow-x:auto;"><table class="appointments-table">' +
    '<thead><tr><th>Cliente</th><th>Servicio</th><th>Fecha</th><th>Hora</th><th>Estado</th><th>Acciones</th></tr></thead>' +
    '<tbody>';
  
  appointments.forEach(apt => {
    const fechaFormateada = window.formatDateSpanish(apt.appointment_date);
    
    let estadoTexto = apt.status;
    if (estadoTexto === 'confirmed') estadoTexto = 'Confirmada';
    else if (estadoTexto === 'pending_payment') estadoTexto = 'Verificar pago';
    else if (estadoTexto === 'pending') estadoTexto = 'Por confirmar';
    else if (estadoTexto === 'pending_verification') estadoTexto = 'Verificar pago';
    else if (estadoTexto === 'cancelled') estadoTexto = 'Cancelada';
    else if (estadoTexto === 'completed') estadoTexto = 'Completada';
    
    const hasProof = apt.proof_of_payment_url;
    
    html += '<tr>' +
      '<td>' + (apt.client_name || '') + '</td>' +
      '<td><div style="display:flex; align-items:center; gap:8px;"><i data-lucide="' + window.getServiceIcon(apt.service_name) + '" style="width:16px; height:16px; opacity:0.7;"></i>' + (apt.service_name || 'Servicio') + '</div></td>' +
      '<td>' + fechaFormateada + '</td>' +
      '<td>' + (apt.appointment_time || '') + '</td>' +
      '<td>' +
        '<span class="status-badge status-' + apt.status + '">' + estadoTexto + '</span>' +
        (hasProof ? '<br><a href="' + BASE_URL + apt.proof_of_payment_url + '" target="_blank" class="proof-link" style="font-size:0.75rem; color:var(--accent-lime);">Ver Comprobante</a>' : '') +
      '</td>' +
      '<td>' +
      '<select onchange="updateStatus(' + apt.id + ', this.value, this)" class="status-select">' +
      '<option value="pending" ' + (apt.status === 'pending' ? 'selected' : '') + '>Por confirmar</option>' +
      '<option value="pending_payment" ' + (apt.status === 'pending_payment' || apt.status === 'pending_verification' ? 'selected' : '') + '>Verificar pago</option>' +
      '<option value="confirmed" ' + (apt.status === 'confirmed' ? 'selected' : '') + '>Confirmada</option>' +
      '<option value="completed" ' + (apt.status === 'completed' ? 'selected' : '') + '>Completada</option>' +
      '<option value="cancelled" ' + (apt.status === 'cancelled' ? 'selected' : '') + '>Cancelada</option>' +
      '</select>' +
      '</td>' +
      '</tr>';
  });
  
  html += '</tbody></table></div>';
  container.innerHTML = html;
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // Inject rejection modal if not exists
  if (!document.getElementById('rejectModal')) {
    const modal = document.createElement('div');
    modal.id = 'rejectModal';
    modal.style.cssText = 'display:none; position:fixed; inset:0; background:rgba(0,0,0,0.7); backdrop-filter:blur(8px); z-index:9999; align-items:center; justify-content:center;';
    modal.innerHTML = `
      <div style="background:#1a1628; border:1px solid rgba(255,255,255,0.08); border-radius:20px; padding:32px; width:90%; max-width:420px; position:relative; box-shadow:0 30px 80px rgba(0,0,0,0.6);">
        <div style="background:rgba(239,68,68,0.1); width:56px; height:56px; border-radius:14px; display:flex; align-items:center; justify-content:center; margin:0 auto 16px; color:#ef4444;">
          <i data-lucide="x-octagon" style="width:28px; height:28px;"></i>
        </div>
        <h3 style="font-size:20px; font-weight:700; color:#f0eeff; text-align:center; margin-bottom:8px;">Motivo de cancelación</h3>
        <p style="font-size:13px; color:#6b6880; text-align:center; margin-bottom:20px;">Este mensaje le llegará al cliente por correo electrónico.</p>
        <textarea id="rejectReasonInput" rows="4" placeholder="Ej: El profesional no está disponible ese día..." style="width:100%; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:14px; color:#e2e0f0; font-size:14px; resize:none; font-family:inherit; margin-bottom:20px;"></textarea>
        <div style="display:flex; gap:10px;">
          <button id="rejectCancelBtn" style="flex:1; padding:12px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:12px; color:#a09db8; font-size:14px; font-weight:600; cursor:pointer;">Volver</button>
          <button id="rejectConfirmBtn" style="flex:1; padding:12px; background:#ef4444; border:none; border-radius:12px; color:#fff; font-size:14px; font-weight:700; cursor:pointer;">Cancelar cita</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    if (window.lucide) window.lucide.createIcons();
  }
};

// Update appointment status
const updateStatus = async (id, status, selectEl) => {
  if (status === 'cancelled') {
    // Show custom modal instead of prompt()
    const modal = document.getElementById('rejectModal');
    const reasonInput = document.getElementById('rejectReasonInput');
    const confirmBtn = document.getElementById('rejectConfirmBtn');
    const cancelBtn = document.getElementById('rejectCancelBtn');
    
    reasonInput.value = '';
    modal.style.display = 'flex';

    // Clean up previous listeners
    const newConfirm = confirmBtn.cloneNode(true);
    const newCancel = cancelBtn.cloneNode(true);
    confirmBtn.replaceWith(newConfirm);
    cancelBtn.replaceWith(newCancel);

    document.getElementById('rejectCancelBtn').onclick = () => {
      modal.style.display = 'none';
      fetchAppointments(); // revert select
    };

    document.getElementById('rejectConfirmBtn').onclick = async () => {
      const reason = document.getElementById('rejectReasonInput').value.trim();
      if (!reason) {
        document.getElementById('rejectReasonInput').style.borderColor = '#ef4444';
        return;
      }
      modal.style.display = 'none';
      try {
        await ApiService.patch(`/appointments/${id}`, { status: 'cancelled', rejection_reason: reason });
        fetchAppointments();
        if (window.showToast) window.showToast('Cita cancelada', 'success');
      } catch (error) {
        console.error('Error:', error);
        if (window.showToast) window.showToast(error.message || 'Error al cancelar', 'error');
        fetchAppointments();
      }
    };
    return;
  }

  try {
    const updateData = { status };
    if (status === 'confirmed') {
        updateData.payment_status = 'paid';
    }
    await ApiService.patch(`/appointments/${id}`, updateData);
    fetchAppointments();
    if (window.showToast) window.showToast('Estado actualizado', 'success');
  } catch (error) {
    console.error('Error:', error);
    if (window.showToast) window.showToast(error.message || 'Error al actualizar el estado', 'error');
    fetchAppointments();
  }
};

// Initialize
document.addEventListener('DOMContentLoaded', fetchAppointments);