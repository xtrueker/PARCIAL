// ===== DATA STORE (LocalStorage) =====
const DB = {
    users: JSON.parse(localStorage.getItem('tc_users')) || [
        { id: 1, name: 'Victor Campo', email: 'victorecampo22@gmail.com', password: hashPassword('123456'), role: 'docente' },
        { id: 2, name: 'Ana García', email: 'ana@ejemplo.com', password: hashPassword('123456'), role: 'estudiante' },
        { id: 3, name: 'Carlos López', email: 'carlos@ejemplo.com', password: hashPassword('123456'), role: 'docente' },
        { id: 4, name: 'María Rodríguez', email: 'maria@ejemplo.com', password: hashPassword('123456'), role: 'estudiante' }
    ],
    requests: JSON.parse(localStorage.getItem('tc_requests')) || [
        { id: 1, studentId: 2, teacherId: 1, subject: 'Cálculo Diferencial', date: '2025-06-15', time: '10:00', description: 'Necesito ayuda con derivadas', status: 'accepted', createdAt: '2025-06-10T10:00:00' },
        { id: 2, studentId: 4, teacherId: 1, subject: 'Álgebra Lineal', date: '2025-06-16', time: '14:00', description: 'Matrices y determinantes', status: 'pending', createdAt: '2025-06-11T09:00:00' },
        { id: 3, studentId: 2, teacherId: 3, subject: 'Física', date: '2025-06-10', time: '09:00', description: 'Cinemática', status: 'completed', createdAt: '2025-06-05T08:00:00' },
        { id: 4, studentId: 4, teacherId: 1, subject: 'Programación', date: '2025-06-12', time: '16:00', description: 'Estructuras de datos', status: 'rejected', createdAt: '2025-06-08T11:00:00' },
        { id: 5, studentId: 2, teacherId: 1, subject: 'Estadística', date: '2025-06-20', time: '11:00', description: 'Distribuciones de probabilidad', status: 'cancelled', createdAt: '2025-06-09T14:00:00' }
    ],
    availability: JSON.parse(localStorage.getItem('tc_availability')) || [
        { id: 1, teacherId: 1, day: 'Lunes', start: '08:00', end: '12:00' },
        { id: 2, teacherId: 1, day: 'Miércoles', start: '14:00', end: '18:00' },
        { id: 3, teacherId: 1, day: 'Viernes', start: '10:00', end: '14:00' },
        { id: 4, teacherId: 3, day: 'Martes', start: '09:00', end: '13:00' },
        { id: 5, teacherId: 3, day: 'Jueves', start: '15:00', end: '19:00' }
    ]
};

let currentUser = JSON.parse(sessionStorage.getItem('tc_currentUser')) || null;
let currentView = 'dashboard';

// ===== UTILITIES =====
function hashPassword(password) {
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
        const char = password.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString(16);
}

function saveData() {
    localStorage.setItem('tc_users', JSON.stringify(DB.users));
    localStorage.setItem('tc_requests', JSON.stringify(DB.requests));
    localStorage.setItem('tc_availability', JSON.stringify(DB.availability));
}

function formatDate(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

function getStatusLabel(status) {
    const labels = {
        pending: 'Pendiente',
        accepted: 'Aceptada',
        rejected: 'Rechazada',
        completed: 'Finalizada',
        cancelled: 'Cancelada'
    };
    return labels[status] || status;
}

function getStatusIcon(status) {
    const icons = {
        pending: 'fa-clock',
        accepted: 'fa-check-circle',
        rejected: 'fa-times-circle',
        completed: 'fa-check-double',
        cancelled: 'fa-ban'
    };
    return icons[status] || 'fa-circle';
}

function getUserById(id) {
    return DB.users.find(u => u.id === id);
}

function getTeacherAvailability(teacherId) {
    return DB.availability.filter(a => a.teacherId === teacherId);
}

function getTeacherRequests(teacherId) {
    return DB.requests.filter(r => r.teacherId === teacherId);
}

function getStudentRequests(studentId) {
    return DB.requests.filter(r => r.studentId === studentId);
}

function getAvailableTeachers() {
    return DB.users.filter(u => u.role === 'docente');
}

function isSlotAvailable(teacherId, date, time) {
    const dayName = new Date(date + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long' });
    const dayCapitalized = dayName.charAt(0).toUpperCase() + dayName.slice(1);

    const avail = DB.availability.find(a => 
        a.teacherId === teacherId && 
        a.day === dayCapitalized &&
        time >= a.start && 
        time < a.end
    );

    if (!avail) return false;

    const sameSlot = DB.requests.filter(r => 
        r.teacherId === teacherId && 
        r.date === date && 
        r.time === time && 
        r.status === 'accepted'
    );

    return sameSlot.length < 2;
}

function is24HoursAdvance(date, time) {
    const now = new Date();
    const requested = new Date(date + 'T' + time);
    const diffHours = (requested - now) / (1000 * 60 * 60);
    return diffHours >= 24;
}

// ===== AUTH FUNCTIONS =====
function switchAuthTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.add('hidden'));

    if (tab === 'login') {
        document.querySelectorAll('.auth-tab')[0].classList.add('active');
        document.getElementById('login-form').classList.remove('hidden');
    } else {
        document.querySelectorAll('.auth-tab')[1].classList.add('active');
        document.getElementById('register-form').classList.remove('hidden');
    }
}

function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errorDiv = document.getElementById('login-error');

    const user = DB.users.find(u => u.email === email && u.password === hashPassword(password));

    if (!user) {
        errorDiv.textContent = 'Correo o contraseña incorrectos';
        errorDiv.classList.add('show');
        return;
    }

    currentUser = { id: user.id, name: user.name, email: user.email, role: user.role };
    sessionStorage.setItem('tc_currentUser', JSON.stringify(currentUser));

    errorDiv.classList.remove('show');
    showMainScreen();
}

function handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const role = document.getElementById('reg-role').value;
    const errorDiv = document.getElementById('register-error');
    const successDiv = document.getElementById('register-success');

    if (DB.users.some(u => u.email === email)) {
        errorDiv.textContent = 'Este correo ya está registrado';
        errorDiv.classList.add('show');
        successDiv.classList.remove('show');
        return;
    }

    const newUser = {
        id: Date.now(),
        name,
        email,
        password: hashPassword(password),
        role
    };

    DB.users.push(newUser);
    saveData();

    errorDiv.classList.remove('show');
    successDiv.textContent = '¡Cuenta creada exitosamente! Ahora puedes iniciar sesión.';
    successDiv.classList.add('show');

    document.getElementById('register-form').reset();

    setTimeout(() => {
        switchAuthTab('login');
        successDiv.classList.remove('show');
    }, 2000);
}

function logout() {
    currentUser = null;
    sessionStorage.removeItem('tc_currentUser');
    document.getElementById('main-screen').classList.remove('active');
    document.getElementById('auth-screen').classList.add('active');
    document.getElementById('login-form').reset();
    document.getElementById('register-form').reset();
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
}

// ===== NAVIGATION =====
function showMainScreen() {
    document.getElementById('auth-screen').classList.remove('active');
    document.getElementById('main-screen').classList.add('active');

    document.getElementById('user-name').textContent = currentUser.name;
    document.getElementById('user-role').textContent = currentUser.role === 'docente' ? 'PROFESOR' : 'ESTUDIANTE';
    document.getElementById('user-avatar').textContent = currentUser.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

    if (currentUser.role === 'estudiante') {
        document.getElementById('student-nav').classList.remove('hidden');
        document.getElementById('teacher-nav').classList.add('hidden');
    } else {
        document.getElementById('student-nav').classList.add('hidden');
        document.getElementById('teacher-nav').classList.remove('hidden');
    }

    navigateTo('dashboard');
}

function navigateTo(view) {
    try {
        currentView = view;

        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));

        const viewEl = document.getElementById('view-' + view);
        if (viewEl) viewEl.classList.add('active');

        const titles = {
            dashboard: 'Panel de Control',
            'new-request': 'Nueva Solicitud',
            'my-requests': 'Mis Solicitudes',
            availability: 'Gestión de Horarios',
            requests: 'Solicitudes Recibidas',
            history: 'Historial de Tutorías'
        };
        document.getElementById('page-title').textContent = titles[view] || 'Panel';

        document.getElementById('current-date').textContent = new Date().toLocaleDateString('es-ES', { 
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
        });

        if (view === 'dashboard') loadDashboard();
        if (view === 'new-request') loadNewRequest();
        if (view === 'my-requests') loadMyRequests();
        if (view === 'availability') loadAvailability();
        if (view === 'requests') loadTeacherRequests();
        if (view === 'history') loadHistory();

    } catch (err) {
        console.error('Error en navigateTo:', err);
    }
}

// ===== DASHBOARD =====
function loadDashboard() {
    try {
        let requests;
        if (currentUser.role === 'estudiante') {
            requests = getStudentRequests(currentUser.id);
        } else {
            requests = getTeacherRequests(currentUser.id);
        }

        const counts = {
            total: requests.length,
            pending: requests.filter(r => r.status === 'pending').length,
            accepted: requests.filter(r => r.status === 'accepted').length,
            completed: requests.filter(r => r.status === 'completed').length,
            rejected: requests.filter(r => r.status === 'rejected').length,
            cancelled: requests.filter(r => r.status === 'cancelled').length
        };

        document.getElementById('stat-total').textContent = counts.total;
        document.getElementById('stat-pending').textContent = counts.pending;
        document.getElementById('stat-accepted').textContent = counts.accepted;
        document.getElementById('stat-completed').textContent = counts.completed;
        document.getElementById('stat-rejected').textContent = counts.rejected;
        document.getElementById('stat-cancelled').textContent = counts.cancelled;

        const upcoming = requests.filter(r => 
            r.status === 'accepted' && 
            new Date(r.date + 'T' + r.time) > new Date()
        ).slice(0, 3);

        const upcomingEl = document.getElementById('upcoming-sessions');
        if (upcoming.length === 0) {
            upcomingEl.innerHTML = '<p class="empty-state">No tienes tutorías programadas</p>';
        } else {
            upcomingEl.innerHTML = upcoming.map(r => {
                const partner = currentUser.role === 'estudiante' ? getUserById(r.teacherId) : getUserById(r.studentId);
                return `
                    <div class="session-item">
                        <i class="fas fa-calendar-check"></i>
                        <div class="session-info">
                            <div class="session-title">${r.subject}</div>
                            <div class="session-meta">Con ${partner ? partner.name : 'Usuario'} • ${formatDate(r.date)} a las ${r.time}</div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        const recent = [...requests].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
        const activityEl = document.getElementById('recent-activity');
        if (recent.length === 0) {
            activityEl.innerHTML = '<p class="empty-state">Sin actividad reciente</p>';
        } else {
            activityEl.innerHTML = recent.map(r => {
                const partner = currentUser.role === 'estudiante' ? getUserById(r.teacherId) : getUserById(r.studentId);
                return `
                    <div class="activity-item">
                        <i class="fas ${getStatusIcon(r.status)}"></i>
                        <div class="activity-info">
                            <div class="activity-title">${r.subject} - ${getStatusLabel(r.status)}</div>
                            <div class="activity-meta">${partner ? partner.name : 'Usuario'} • ${formatDate(r.date)}</div>
                        </div>
                    </div>
                `;
            }).join('');
        }
    } catch (err) {
        console.error('Error en loadDashboard:', err);
    }
}

// ===== NEW REQUEST (Student) =====
function loadNewRequest() {
    try {
        const teacherSelect = document.getElementById('req-teacher');
        const teachers = getAvailableTeachers();

        teacherSelect.innerHTML = '<option value="">Seleccionar docente...</option>' +
            teachers.map(t => `<option value="${t.id}">${t.name}</option>`).join('');

        teacherSelect.onchange = function() {
            updateTimeSlots(this.value);
        };

        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        document.getElementById('req-date').min = tomorrow.toISOString().split('T')[0];

        document.getElementById('request-error').classList.remove('show');
        document.getElementById('request-success').classList.remove('show');
    } catch (err) {
        console.error('Error en loadNewRequest:', err);
    }
}

function updateTimeSlots(teacherId) {
    try {
        const timeSelect = document.getElementById('req-time');
        const dateInput = document.getElementById('req-date').value;

        if (!teacherId) {
            timeSelect.innerHTML = '<option value="">Seleccionar horario...</option>';
            return;
        }

        const availability = getTeacherAvailability(parseInt(teacherId));

        if (!dateInput) {
            timeSelect.innerHTML = '<option value="">Primero selecciona una fecha</option>';
            return;
        }

        const dayName = new Date(dateInput + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long' });
        const dayCapitalized = dayName.charAt(0).toUpperCase() + dayName.slice(1);

        const dayAvail = availability.filter(a => a.day === dayCapitalized);

        if (dayAvail.length === 0) {
            timeSelect.innerHTML = '<option value="">El docente no tiene disponibilidad este día</option>';
            return;
        }

        let slots = [];
        dayAvail.forEach(a => {
            const start = parseInt(a.start.split(':')[0]);
            const end = parseInt(a.end.split(':')[0]);
            for (let h = start; h < end; h++) {
                slots.push(`${h.toString().padStart(2, '0')}:00`);
            }
        });

        timeSelect.innerHTML = '<option value="">Seleccionar hora...</option>' +
            slots.map(s => `<option value="${s}">${s}</option>`).join('');
    } catch (err) {
        console.error('Error en updateTimeSlots:', err);
    }
}

function handleNewRequest(e) {
    e.preventDefault();
    const teacherId = parseInt(document.getElementById('req-teacher').value);
    const subject = document.getElementById('req-subject').value.trim();
    const date = document.getElementById('req-date').value;
    const time = document.getElementById('req-time').value;
    const description = document.getElementById('req-description').value.trim();
    const errorDiv = document.getElementById('request-error');
    const successDiv = document.getElementById('request-success');

    if (!teacherId || !time) {
        errorDiv.textContent = 'Selecciona un docente y horario válidos';
        errorDiv.classList.add('show');
        return;
    }

    if (!is24HoursAdvance(date, time)) {
        errorDiv.textContent = 'Las solicitudes deben realizarse con mínimo 24 horas de antelación';
        errorDiv.classList.add('show');
        return;
    }

    if (!isSlotAvailable(teacherId, date, time)) {
        errorDiv.textContent = 'Este horario ya tiene 2 tutorías asignadas. Selecciona otro.';
        errorDiv.classList.add('show');
        return;
    }

    const newRequest = {
        id: Date.now(),
        studentId: currentUser.id,
        teacherId,
        subject,
        date,
        time,
        description,
        status: 'pending',
        createdAt: new Date().toISOString()
    };

    DB.requests.push(newRequest);
    saveData();

    errorDiv.classList.remove('show');
    successDiv.textContent = '¡Solicitud enviada exitosamente!';
    successDiv.classList.add('show');

    document.querySelector('#view-new-request form').reset();

    setTimeout(() => {
        successDiv.classList.remove('show');
        navigateTo('my-requests');
    }, 1500);
}

// ===== MY REQUESTS (Student) =====
function loadMyRequests() {
    try {
        const requests = getStudentRequests(currentUser.id);
        const tableBody = document.getElementById('my-requests-table');
        const emptyEl = document.getElementById('my-requests-empty');

        if (requests.length === 0) {
            tableBody.innerHTML = '';
            emptyEl.classList.add('show');
            return;
        }

        emptyEl.classList.remove('show');

        tableBody.innerHTML = requests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(r => {
            const teacher = getUserById(r.teacherId);
            const canCancel = r.status === 'pending' || r.status === 'accepted';
            const canEdit = r.status === 'pending';

            return `
                <tr>
                    <td>${teacher ? teacher.name : 'Docente'}</td>
                    <td>${r.subject}</td>
                    <td>${formatDate(r.date)}</td>
                    <td>${r.time}</td>
                    <td><span class="status-badge status-${r.status}"><i class="fas ${getStatusIcon(r.status)}"></i> ${getStatusLabel(r.status)}</span></td>
                    <td>
                        ${canEdit ? `<button class="btn btn-sm btn-warning" onclick="editRequest(${r.id})"><i class="fas fa-edit"></i></button>` : ''}
                        ${canCancel ? `<button class="btn btn-sm btn-danger" onclick="cancelRequest(${r.id})"><i class="fas fa-ban"></i></button>` : ''}
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.error('Error en loadMyRequests:', err);
    }
}

function cancelRequest(requestId) {
    if (!confirm('¿Estás seguro de que deseas cancelar esta solicitud?')) return;

    const request = DB.requests.find(r => r.id === requestId);
    if (request) {
        request.status = 'cancelled';
        saveData();
        loadMyRequests();
    }
}

function editRequest(requestId) {
    const request = DB.requests.find(r => r.id === requestId);
    if (!request) return;

    navigateTo('new-request');
    document.getElementById('req-teacher').value = request.teacherId;
    document.getElementById('req-subject').value = request.subject;
    document.getElementById('req-date').value = request.date;
    updateTimeSlots(request.teacherId);
    setTimeout(() => {
        document.getElementById('req-time').value = request.time;
    }, 100);
    document.getElementById('req-description').value = request.description;

    DB.requests = DB.requests.filter(r => r.id !== requestId);
    saveData();
}

// ===== AVAILABILITY (Teacher) =====
function loadAvailability() {
    try {
        const avail = getTeacherAvailability(currentUser.id);
        const tableBody = document.getElementById('availability-table');
        const emptyEl = document.getElementById('availability-empty');

        if (avail.length === 0) {
            tableBody.innerHTML = '';
            emptyEl.classList.add('show');
        } else {
            emptyEl.classList.remove('show');
            tableBody.innerHTML = avail.map(a => `
                <tr>
                    <td>${a.day}</td>
                    <td>${a.start}</td>
                    <td>${a.end}</td>
                    <td>
                        <button class="btn btn-sm btn-danger" onclick="deleteAvailability(${a.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
        }

        document.getElementById('avail-error').classList.remove('show');
        document.getElementById('avail-success').classList.remove('show');
    } catch (err) {
        console.error('Error en loadAvailability:', err);
    }
}

function handleAddAvailability(e) {
    e.preventDefault();
    const day = document.getElementById('avail-day').value;
    const start = document.getElementById('avail-start').value;
    const end = document.getElementById('avail-end').value;
    const errorDiv = document.getElementById('avail-error');
    const successDiv = document.getElementById('avail-success');

    if (start >= end) {
        errorDiv.textContent = 'La hora de inicio debe ser menor que la hora de fin';
        errorDiv.classList.add('show');
        return;
    }

    const newAvail = {
        id: Date.now(),
        teacherId: currentUser.id,
        day,
        start,
        end
    };

    DB.availability.push(newAvail);
    saveData();

    errorDiv.classList.remove('show');
    successDiv.textContent = 'Horario agregado correctamente';
    successDiv.classList.add('show');

    document.getElementById('avail-day').value = '';
    document.getElementById('avail-start').value = '';
    document.getElementById('avail-end').value = '';

    loadAvailability();

    setTimeout(() => successDiv.classList.remove('show'), 2000);
}

function deleteAvailability(id) {
    if (!confirm('¿Eliminar este bloque de disponibilidad?')) return;
    DB.availability = DB.availability.filter(a => a.id !== id);
    saveData();
    loadAvailability();
}

// ===== TEACHER REQUESTS =====
let currentFilter = 'all';

function loadTeacherRequests() {
    try {
        let requests = getTeacherRequests(currentUser.id);

        if (currentFilter !== 'all') {
            requests = requests.filter(r => r.status === currentFilter);
        }

        const tableBody = document.getElementById('teacher-requests-table');
        const emptyEl = document.getElementById('teacher-requests-empty');

        if (requests.length === 0) {
            tableBody.innerHTML = '';
            emptyEl.classList.add('show');
            return;
        }

        emptyEl.classList.remove('show');

        tableBody.innerHTML = requests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(r => {
            const student = getUserById(r.studentId);
            const isPending = r.status === 'pending';

            return `
                <tr>
                    <td>${student ? student.name : 'Estudiante'}</td>
                    <td>${r.subject}</td>
                    <td>${formatDate(r.date)}</td>
                    <td>${r.time}</td>
                    <td><span class="status-badge status-${r.status}"><i class="fas ${getStatusIcon(r.status)}"></i> ${getStatusLabel(r.status)}</span></td>
                    <td>
                        ${isPending ? `
                            <button class="btn btn-sm btn-success" onclick="acceptRequest(${r.id})"><i class="fas fa-check"></i></button>
                            <button class="btn btn-sm btn-danger" onclick="rejectRequest(${r.id})"><i class="fas fa-times"></i></button>
                        ` : r.status === 'accepted' ? `
                            <button class="btn btn-sm btn-primary" onclick="completeRequest(${r.id})"><i class="fas fa-check-double"></i> Finalizar</button>
                        ` : '-'}
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.error('Error en loadTeacherRequests:', err);
    }
}

function filterRequests(filter) {
    currentFilter = filter;
    const buttons = document.querySelectorAll('#view-requests .filter-btn');
    buttons.forEach(b => b.classList.remove('active'));
    if (event && event.target) event.target.classList.add('active');
    loadTeacherRequests();
}

function acceptRequest(requestId) {
    const request = DB.requests.find(r => r.id === requestId);
    if (!request) return;

    const sameSlot = DB.requests.filter(r => 
        r.teacherId === currentUser.id && 
        r.date === request.date && 
        r.time === request.time && 
        r.status === 'accepted' &&
        r.id !== requestId
    );

    if (sameSlot.length >= 2) {
        alert('No puedes aceptar más de 2 tutorías en el mismo bloque horario (Regla de Carga Académica)');
        return;
    }

    request.status = 'accepted';
    saveData();
    loadTeacherRequests();
}

function rejectRequest(requestId) {
    if (!confirm('¿Rechazar esta solicitud?')) return;
    const request = DB.requests.find(r => r.id === requestId);
    if (request) {
        request.status = 'rejected';
        saveData();
        loadTeacherRequests();
    }
}

function completeRequest(requestId) {
    if (!confirm('¿Marcar esta tutoría como finalizada?')) return;
    const request = DB.requests.find(r => r.id === requestId);
    if (request) {
        request.status = 'completed';
        saveData();
        loadTeacherRequests();
    }
}

// ===== HISTORY =====
let historyFilter = 'all';

function loadHistory() {
    try {
        let requests;
        if (currentUser.role === 'estudiante') {
            requests = getStudentRequests(currentUser.id);
        } else {
            requests = getTeacherRequests(currentUser.id);
        }

        if (historyFilter !== 'all') {
            requests = requests.filter(r => r.status === historyFilter);
        } else {
            requests = requests.filter(r => r.status !== 'pending');
        }

        const tableBody = document.getElementById('history-table');
        const emptyEl = document.getElementById('history-empty');

        if (requests.length === 0) {
            tableBody.innerHTML = '';
            emptyEl.classList.add('show');
            return;
        }

        emptyEl.classList.remove('show');

        tableBody.innerHTML = requests.sort((a, b) => new Date(b.date) - new Date(a.date)).map(r => {
            const partner = currentUser.role === 'estudiante' ? getUserById(r.teacherId) : getUserById(r.studentId);

            return `
                <tr>
                    <td>${partner ? partner.name : 'Usuario'}</td>
                    <td>${r.subject}</td>
                    <td>${formatDate(r.date)}</td>
                    <td>${r.time}</td>
                    <td><span class="status-badge status-${r.status}"><i class="fas ${getStatusIcon(r.status)}"></i> ${getStatusLabel(r.status)}</span></td>
                    <td>${new Date(r.createdAt).toLocaleDateString('es-ES')}</td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.error('Error en loadHistory:', err);
    }
}

function filterHistory(filter) {
    historyFilter = filter;
    const buttons = document.querySelectorAll('#view-history .filter-btn');
    buttons.forEach(b => b.classList.remove('active'));
    if (event && event.target) event.target.classList.add('active');
    loadHistory();
}

// ===== MODAL =====
function showModal(content) {
    document.getElementById('modal-body').innerHTML = content;
    document.getElementById('modal').classList.add('show');
}

function closeModal() {
    document.getElementById('modal').classList.remove('show');
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
    if (currentUser) {
        showMainScreen();
    }

    const dateInput = document.getElementById('req-date');
    if (dateInput) {
        dateInput.addEventListener('change', function() {
            const teacherId = document.getElementById('req-teacher').value;
            if (teacherId) {
                updateTimeSlots(teacherId);
            }
        });
    }

    // Close modal on outside click
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            closeModal();
        }
    });
});