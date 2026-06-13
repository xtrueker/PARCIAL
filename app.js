// ===== SUPABASE CLIENT CONFIGURATION =====
// Reemplaza estos valores con la URL y la Anon Key de tu proyecto de Supabase
const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';

// Verificar si se han configurado credenciales reales
const isPlaceholder = SUPABASE_URL.includes('YOUR_PROJECT_ID') || SUPABASE_ANON_KEY === 'YOUR_ANON_KEY';
const useSupabase = (typeof supabase !== 'undefined') && !isPlaceholder;

let supabaseClient = null;
if (useSupabase) {
    try {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } catch (err) {
        console.error('Error al inicializar cliente Supabase:', err);
    }
}

// ===== DATA STORE (LocalStorage Fallback) =====
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
        { id: 3, studentId: 2, teacherId: 3, subject: 'Física', date: '2025-06-10', time: '09:00', description: 'Cinemática', status: 'completed', createdAt: '2025-06-05T08:00:00', rating: 5 },
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

// ===== NOTIFICATIONS STORE =====
const notifications = [];

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

// ===== STAR RATINGS HELPER =====
function getStarsHTML(rating) {
    let html = '';
    for (let i = 1; i <= 5; i++) {
        html += `<i class="fas fa-star ${i <= rating ? 'active' : ''}"></i>`;
    }
    return html;
}

// ===== NOTIFICATION SYSTEM =====
function addNotification(message, type = 'info') {
    const notif = {
        id: Date.now(),
        message,
        type,
        unread: true,
        time: new Date()
    };
    notifications.unshift(notif);
    renderNotifications();
}

function toggleNotifications(event) {
    if (event) event.stopPropagation();
    const panel = document.getElementById('notifications-panel');
    if (panel) {
        panel.classList.toggle('show');
        if (panel.classList.contains('show')) {
            notifications.forEach(n => n.unread = false);
            renderNotifications();
        }
    }
}

function clearNotifications() {
    notifications.length = 0;
    renderNotifications();
}

function renderNotifications() {
    const list = document.getElementById('notifications-list');
    const badge = document.getElementById('notifications-count');
    const unreadCount = notifications.filter(n => n.unread).length;
    
    if (badge) {
        badge.textContent = unreadCount;
        badge.style.display = unreadCount > 0 ? 'flex' : 'none';
    }
    
    if (list) {
        if (notifications.length === 0) {
            list.innerHTML = '<p class="empty-state">No tienes notificaciones nuevas</p>';
        } else {
            list.innerHTML = notifications.map(n => `
                <div class="notification-item ${n.unread ? 'unread' : ''}">
                    <div>${n.message}</div>
                    <span class="time">${new Date(n.time).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
            `).join('');
        }
    }
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

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errorDiv = document.getElementById('login-error');

    if (useSupabase) {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            errorDiv.textContent = 'Error al iniciar sesión: ' + error.message;
            errorDiv.classList.add('show');
            return;
        }

        // Obtener el perfil del usuario de la tabla profiles
        const { data: profile, error: profileErr } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

        if (profileErr || !profile) {
            errorDiv.textContent = 'Error al obtener el perfil de usuario.';
            errorDiv.classList.add('show');
            return;
        }

        currentUser = { id: profile.id, name: profile.name, email: profile.email, role: profile.role };
    } else {
        const user = DB.users.find(u => u.email === email && u.password === hashPassword(password));

        if (!user) {
            errorDiv.textContent = 'Correo o contraseña incorrectos';
            errorDiv.classList.add('show');
            return;
        }

        currentUser = { id: user.id, name: user.name, email: user.email, role: user.role };
    }

    sessionStorage.setItem('tc_currentUser', JSON.stringify(currentUser));
    errorDiv.classList.remove('show');
    addNotification(`¡Bienvenido de vuelta, ${currentUser.name}!`, 'success');
    showMainScreen();
}

async function handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const role = document.getElementById('reg-role').value;
    const errorDiv = document.getElementById('register-error');
    const successDiv = document.getElementById('register-success');

    if (useSupabase) {
        const { data, error } = await supabaseClient.auth.signUp({
            email,
            password,
            options: {
                data: {
                    name,
                    role
                }
            }
        });

        if (error) {
            errorDiv.textContent = 'Error al registrar usuario: ' + error.message;
            errorDiv.classList.add('show');
            successDiv.classList.remove('show');
            return;
        }
    } else {
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
    }

    errorDiv.classList.remove('show');
    successDiv.textContent = '¡Cuenta creada exitosamente! Ahora puedes iniciar sesión.';
    successDiv.classList.add('show');

    document.getElementById('register-form').reset();

    setTimeout(() => {
        switchAuthTab('login');
        successDiv.classList.remove('show');
    }, 2000);
}

async function logout() {
    if (useSupabase) {
        await supabaseClient.auth.signOut();
    }
    addNotification('Cerraste sesión correctamente.', 'info');
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

async function navigateTo(view) {
    try {
        currentView = view;

        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if(item.getAttribute('onclick').includes(`navigateTo('${view}')`)) {
                item.classList.add('active');
            }
        });
        
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));

        const viewEl = document.getElementById('view-' + view);
        if (viewEl) {
            viewEl.classList.add('active');
        }

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

        if (view === 'dashboard') await loadDashboard();
        if (view === 'new-request') await loadNewRequest();
        if (view === 'my-requests') await loadMyRequests();
        if (view === 'availability') await loadAvailability();
        if (view === 'requests') await loadTeacherRequests();
        if (view === 'history') await loadHistory();

    } catch (err) {
        console.error('Error en navigateTo:', err);
    }
}

// ===== DASHBOARD =====
async function loadDashboard() {
    try {
        let requests = [];
        if (useSupabase) {
            let query = supabaseClient
                .from('requests')
                .select('*, student:student_id(name), teacher:teacher_id(name)');
            
            if (currentUser.role === 'estudiante') {
                query = query.eq('student_id', currentUser.id);
            } else {
                query = query.eq('teacher_id', currentUser.id);
            }
            
            const { data, error } = await query;
            if (error) throw error;
            requests = data || [];
        } else {
            if (currentUser.role === 'estudiante') {
                requests = getStudentRequests(currentUser.id);
            } else {
                requests = getTeacherRequests(currentUser.id);
            }
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

        // Cargar gráfico estadístico
        updateDashboardChart(requests);

        const upcoming = requests.filter(r => 
            r.status === 'accepted' && 
            new Date(r.date + 'T' + r.time) > new Date()
        ).slice(0, 3);

        const upcomingEl = document.getElementById('upcoming-sessions');
        if (upcoming.length === 0) {
            upcomingEl.innerHTML = '<p class="empty-state">No tienes tutorías programadas</p>';
        } else {
            upcomingEl.innerHTML = upcoming.map(r => {
                let partnerName = 'Usuario';
                if (useSupabase) {
                    partnerName = currentUser.role === 'estudiante' 
                        ? (r.teacher ? r.teacher.name : 'Docente') 
                        : (r.student ? r.student.name : 'Estudiante');
                } else {
                    const partner = currentUser.role === 'estudiante' ? getUserById(r.teacherId) : getUserById(r.studentId);
                    partnerName = partner ? partner.name : 'Usuario';
                }
                return `
                    <div class="session-item">
                        <i class="fas fa-calendar-check"></i>
                        <div class="session-info">
                            <div class="session-title">${r.subject}</div>
                            <div class="session-meta">Con ${partnerName} • ${formatDate(r.date)} a las ${r.time}</div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        const recent = [...requests].sort((a, b) => {
            const dateA = new Date(a.created_at || a.createdAt);
            const dateB = new Date(b.created_at || b.createdAt);
            return dateB - dateA;
        }).slice(0, 5);
        
        const activityEl = document.getElementById('recent-activity');
        if (recent.length === 0) {
            activityEl.innerHTML = '<p class="empty-state">Sin actividad reciente</p>';
        } else {
            activityEl.innerHTML = recent.map(r => {
                let partnerName = 'Usuario';
                if (useSupabase) {
                    partnerName = currentUser.role === 'estudiante' 
                        ? (r.teacher ? r.teacher.name : 'Docente') 
                        : (r.student ? r.student.name : 'Estudiante');
                } else {
                    const partner = currentUser.role === 'estudiante' ? getUserById(r.teacherId) : getUserById(r.studentId);
                    partnerName = partner ? partner.name : 'Usuario';
                }
                return `
                    <div class="activity-item">
                        <i class="fas ${getStatusIcon(r.status)}"></i>
                        <div class="activity-info">
                            <div class="activity-title">${r.subject} - ${getStatusLabel(r.status)}</div>
                            <div class="activity-meta">${partnerName} • ${formatDate(r.date)}</div>
                        </div>
                    </div>
                `;
            }).join('');
        }
    } catch (err) {
        console.error('Error en loadDashboard:', err);
    }
}

function updateDashboardChart(requests) {
    const chartGroup = document.getElementById('dashboard-chart-group');
    if (!chartGroup) return;
    
    const counts = {
        pending: requests.filter(r => r.status === 'pending').length,
        accepted: requests.filter(r => r.status === 'accepted').length,
        completed: requests.filter(r => r.status === 'completed').length,
        cancelled: requests.filter(r => r.status === 'cancelled').length
    };
    
    const total = counts.pending + counts.accepted + counts.completed + counts.cancelled;
    const getPercent = (val) => total > 0 ? Math.round((val / total) * 100) : 0;
    
    chartGroup.innerHTML = `
        <div class="chart-bar-row">
            <span class="chart-label">Pendientes</span>
            <div class="chart-track">
                <div class="chart-fill pending" style="width: ${getPercent(counts.pending)}%"></div>
            </div>
            <span class="chart-value">${counts.pending}</span>
        </div>
        <div class="chart-bar-row">
            <span class="chart-label">Aceptadas</span>
            <div class="chart-track">
                <div class="chart-fill accepted" style="width: ${getPercent(counts.accepted)}%"></div>
            </div>
            <span class="chart-value">${counts.accepted}</span>
        </div>
        <div class="chart-bar-row">
            <span class="chart-label">Finalizadas</span>
            <div class="chart-track">
                <div class="chart-fill completed" style="width: ${getPercent(counts.completed)}%"></div>
            </div>
            <span class="chart-value">${counts.completed}</span>
        </div>
        <div class="chart-bar-row">
            <span class="chart-label">Canceladas</span>
            <div class="chart-track">
                <div class="chart-fill cancelled" style="width: ${getPercent(counts.cancelled)}%"></div>
            </div>
            <span class="chart-value">${counts.cancelled}</span>
        </div>
    `;
}

// ===== NEW REQUEST (Student) =====
async function loadNewRequest() {
    try {
        const teacherSelect = document.getElementById('req-teacher');
        let teachers = [];
        
        if (useSupabase) {
            const { data, error } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('role', 'docente');
            if (error) throw error;
            teachers = data || [];
        } else {
            teachers = getAvailableTeachers();
        }

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

async function updateTimeSlots(teacherId) {
    try {
        const timeSelect = document.getElementById('req-time');
        const dateInput = document.getElementById('req-date').value;

        if (!teacherId) {
            timeSelect.innerHTML = '<option value="">Seleccionar horario...</option>';
            return;
        }

        let availability = [];
        if (useSupabase) {
            const { data, error } = await supabaseClient
                .from('availability')
                .select('*')
                .eq('teacher_id', teacherId);
            if (error) throw error;
            availability = data || [];
        } else {
            availability = getTeacherAvailability(useSupabase ? teacherId : parseInt(teacherId));
        }

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

async function handleNewRequest(e) {
    e.preventDefault();
    const teacherIdRaw = document.getElementById('req-teacher').value;
    const teacherId = useSupabase ? teacherIdRaw : parseInt(teacherIdRaw);
    const subject = document.getElementById('req-subject').value.trim();
    const date = document.getElementById('req-date').value;
    const time = document.getElementById('req-time').value;
    const description = document.getElementById('req-description').value.trim();
    const errorDiv = document.getElementById('request-error');
    const successDiv = document.getElementById('request-success');

    if (!teacherIdRaw || !time) {
        errorDiv.textContent = 'Selecciona un docente y horario válidos';
        errorDiv.classList.add('show');
        return;
    }

    if (!is24HoursAdvance(date, time)) {
        errorDiv.textContent = 'Las solicitudes deben realizarse con mínimo 24 horas de antelación';
        errorDiv.classList.add('show');
        return;
    }

    if (useSupabase) {
        const { data: sameSlot, error: checkError } = await supabaseClient
            .from('requests')
            .select('id')
            .eq('teacher_id', teacherId)
            .eq('date', date)
            .eq('time', time)
            .eq('status', 'accepted');

        if (checkError) {
            errorDiv.textContent = 'Error al verificar disponibilidad: ' + checkError.message;
            errorDiv.classList.add('show');
            return;
        }

        if (sameSlot && sameSlot.length >= 2) {
            errorDiv.textContent = 'Este horario ya tiene 2 tutorías asignadas. Selecciona otro.';
            errorDiv.classList.add('show');
            return;
        }

        const { error } = await supabaseClient
            .from('requests')
            .insert({
                student_id: currentUser.id,
                teacher_id: teacherId,
                subject: subject,
                date: date,
                time: time,
                description: description,
                status: 'pending'
            });

        if (error) {
            errorDiv.textContent = 'Error al enviar solicitud: ' + error.message;
            errorDiv.classList.add('show');
            return;
        }
    } else {
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
    }

    addNotification(`Nueva solicitud creada para ${subject}`, 'info');
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
async function loadMyRequests() {
    try {
        let requests = [];
        if (useSupabase) {
            const { data, error } = await supabaseClient
                .from('requests')
                .select('*, teacher:teacher_id(name)')
                .eq('student_id', currentUser.id);
            if (error) throw error;
            requests = data || [];
        } else {
            requests = getStudentRequests(currentUser.id);
        }

        const tableBody = document.getElementById('my-requests-table');
        const emptyEl = document.getElementById('my-requests-empty');

        if (requests.length === 0) {
            tableBody.innerHTML = '';
            emptyEl.classList.add('show');
            return;
        }

        emptyEl.classList.remove('show');

        tableBody.innerHTML = requests.sort((a, b) => {
            const dateA = new Date(a.created_at || a.createdAt);
            const dateB = new Date(b.created_at || b.createdAt);
            return dateB - dateA;
        }).map(r => {
            let teacherName = 'Docente';
            if (useSupabase) {
                teacherName = r.teacher ? r.teacher.name : 'Docente';
            } else {
                const teacher = getUserById(r.teacherId);
                teacherName = teacher ? teacher.name : 'Docente';
            }
            const canCancel = r.status === 'pending' || r.status === 'accepted';
            const canEdit = r.status === 'pending';

            return `
                <tr onclick="openRequestDetails(${r.id})" style="cursor: pointer;">
                    <td>${teacherName}</td>
                    <td>${r.subject}</td>
                    <td>${formatDate(r.date)}</td>
                    <td>${r.time}</td>
                    <td><span class="status-badge status-${r.status}"><i class="fas ${getStatusIcon(r.status)}"></i> ${getStatusLabel(r.status)}</span></td>
                    <td onclick="event.stopPropagation();">
                        ${canEdit ? `<button class="btn btn-sm btn-warning" onclick="editRequest(${r.id})"><i class="fas fa-edit"></i></button>` : ''}
                        ${canCancel ? `<button class="btn btn-sm btn-danger" onclick="cancelRequest(${r.id})"><i class="fas fa-ban"></i></button>` : ''}
                        ${r.status === 'completed' && !r.rating ? `<button class="btn btn-sm btn-primary" onclick="openRatingModal(${r.id})"><i class="fas fa-star"></i> Calificar</button>` : ''}
                        ${r.status === 'completed' && r.rating ? `<span class="stars-display">${getStarsHTML(r.rating)}</span>` : ''}
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.error('Error en loadMyRequests:', err);
    }
}

async function cancelRequest(requestId) {
    if (!confirm('¿Estás seguro de que deseas cancelar esta solicitud?')) return;

    if (useSupabase) {
        const { error } = await supabaseClient
            .from('requests')
            .update({ status: 'cancelled' })
            .eq('id', requestId);
        if (error) {
            alert('Error al cancelar la solicitud: ' + error.message);
            return;
        }
    } else {
        const request = DB.requests.find(r => r.id === requestId);
        if (request) {
            request.status = 'cancelled';
            saveData();
        }
    }
    
    addNotification('Tutoría cancelada correctamente.', 'warning');
    await loadMyRequests();
}

async function editRequest(requestId) {
    let request;
    if (useSupabase) {
        const { data, error } = await supabaseClient
            .from('requests')
            .select('*')
            .eq('id', requestId)
            .single();
        if (error || !data) {
            alert('Error al recuperar la solicitud.');
            return;
        }
        request = data;
    } else {
        request = DB.requests.find(r => r.id === requestId);
    }
    if (!request) return;

    navigateTo('new-request');
    document.getElementById('req-teacher').value = useSupabase ? request.teacher_id : request.teacherId;
    document.getElementById('req-subject').value = request.subject;
    document.getElementById('req-date').value = request.date;
    await updateTimeSlots(useSupabase ? request.teacher_id : request.teacherId);
    setTimeout(() => {
        document.getElementById('req-time').value = request.time;
    }, 100);
    document.getElementById('req-description').value = request.description;

    if (useSupabase) {
        await supabaseClient.from('requests').delete().eq('id', requestId);
    } else {
        DB.requests = DB.requests.filter(r => r.id !== requestId);
        saveData();
    }
}

// ===== AVAILABILITY (Teacher) =====
async function loadAvailability() {
    try {
        let avail = [];
        if (useSupabase) {
            const { data, error } = await supabaseClient
                .from('availability')
                .select('*')
                .eq('teacher_id', currentUser.id);
            if (error) throw error;
            avail = data || [];
        } else {
            avail = getTeacherAvailability(currentUser.id);
        }
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

async function handleAddAvailability(e) {
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

    if (useSupabase) {
        const { error } = await supabaseClient
            .from('availability')
            .insert({
                teacher_id: currentUser.id,
                day,
                start,
                end
            });
        if (error) {
            errorDiv.textContent = 'Error al agregar disponibilidad: ' + error.message;
            errorDiv.classList.add('show');
            return;
        }
    } else {
        const newAvail = {
            id: Date.now(),
            teacherId: currentUser.id,
            day,
            start,
            end
        };

        DB.availability.push(newAvail);
        saveData();
    }

    addNotification(`Bloque de disponibilidad agregado para los ${day}`, 'success');
    errorDiv.classList.remove('show');
    successDiv.textContent = 'Horario agregado correctamente';
    successDiv.classList.add('show');

    document.getElementById('avail-day').value = '';
    document.getElementById('avail-start').value = '';
    document.getElementById('avail-end').value = '';

    await loadAvailability();

    setTimeout(() => successDiv.classList.remove('show'), 2000);
}

async function deleteAvailability(id) {
    if (!confirm('¿Eliminar este bloque de disponibilidad?')) return;
    
    if (useSupabase) {
        const { error } = await supabaseClient
            .from('availability')
            .delete()
            .eq('id', id);
        if (error) {
            alert('Error al eliminar bloque: ' + error.message);
            return;
        }
    } else {
        DB.availability = DB.availability.filter(a => a.id !== id);
        saveData();
    }
    
    addNotification('Bloque de disponibilidad eliminado.', 'info');
    await loadAvailability();
}

// ===== TEACHER REQUESTS =====
let currentFilter = 'all';

async function loadTeacherRequests() {
    try {
        let requests = [];
        if (useSupabase) {
            let query = supabaseClient
                .from('requests')
                .select('*, student:student_id(name)')
                .eq('teacher_id', currentUser.id);

            if (currentFilter !== 'all') {
                query = query.eq('status', currentFilter);
            }
            const { data, error } = await query;
            if (error) throw error;
            requests = data || [];
        } else {
            requests = getTeacherRequests(currentUser.id);
            if (currentFilter !== 'all') {
                requests = requests.filter(r => r.status === currentFilter);
            }
        }

        const tableBody = document.getElementById('teacher-requests-table');
        const emptyEl = document.getElementById('teacher-requests-empty');

        if (requests.length === 0) {
            tableBody.innerHTML = '';
            emptyEl.classList.add('show');
            return;
        }

        emptyEl.classList.remove('show');

        tableBody.innerHTML = requests.sort((a, b) => {
            const dateA = new Date(a.created_at || a.createdAt);
            const dateB = new Date(b.created_at || b.createdAt);
            return dateB - dateA;
        }).map(r => {
            let studentName = 'Estudiante';
            if (useSupabase) {
                studentName = r.student ? r.student.name : 'Estudiante';
            } else {
                const student = getUserById(r.studentId);
                studentName = student ? student.name : 'Estudiante';
            }
            const isPending = r.status === 'pending';

            return `
                <tr onclick="openRequestDetails(${r.id})" style="cursor: pointer;">
                    <td>${studentName}</td>
                    <td>${r.subject}</td>
                    <td>${formatDate(r.date)}</td>
                    <td>${r.time}</td>
                    <td><span class="status-badge status-${r.status}"><i class="fas ${getStatusIcon(r.status)}"></i> ${getStatusLabel(r.status)}</span></td>
                    <td onclick="event.stopPropagation();">
                        ${isPending ? `
                            <button class="btn btn-sm btn-success" onclick="acceptRequest(${r.id})"><i class="fas fa-check"></i></button>
                            <button class="btn btn-sm btn-danger" onclick="rejectRequest(${r.id})"><i class="fas fa-times"></i></button>
                        ` : r.status === 'accepted' ? `
                            <button class="btn btn-sm btn-primary" onclick="completeRequest(${r.id})"><i class="fas fa-check-double"></i> Finalizar</button>
                        ` : '-'}
                        ${r.rating ? `<span class="stars-display" style="display:block;margin-top:4px;">${getStarsHTML(r.rating)}</span>` : ''}
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

async function acceptRequest(requestId) {
    if (useSupabase) {
        const { data: request, error: fetchError } = await supabaseClient
            .from('requests')
            .select('*')
            .eq('id', requestId)
            .single();
        if (fetchError || !request) {
            alert('Error al recuperar detalles de la solicitud.');
            return;
        }

        const { data: sameSlot, error: checkError } = await supabaseClient
            .from('requests')
            .select('id')
            .eq('teacher_id', currentUser.id)
            .eq('date', request.date)
            .eq('time', request.time)
            .eq('status', 'accepted');

        if (checkError) {
            alert('Error al verificar disponibilidad.');
            return;
        }

        if (sameSlot && sameSlot.length >= 2) {
            alert('No puedes aceptar más de 2 tutorías en el mismo bloque horario (Regla de Carga Académica)');
            return;
        }

        const { error: updateError } = await supabaseClient
            .from('requests')
            .update({ status: 'accepted' })
            .eq('id', requestId);

        if (updateError) {
            alert('Error al aceptar la solicitud: ' + updateError.message);
            return;
        }
    } else {
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
    }
    
    addNotification('Aceptaste la tutoría académica.', 'success');
    await loadTeacherRequests();
}

async function rejectRequest(requestId) {
    if (!confirm('¿Rechazar esta solicitud?')) return;
    
    if (useSupabase) {
        const { error } = await supabaseClient
            .from('requests')
            .update({ status: 'rejected' })
            .eq('id', requestId);
        if (error) {
            alert('Error al rechazar la solicitud: ' + error.message);
            return;
        }
    } else {
        const request = DB.requests.find(r => r.id === requestId);
        if (request) {
            request.status = 'rejected';
            saveData();
        }
    }
    
    addNotification('Rechazaste la solicitud de tutoría.', 'warning');
    await loadTeacherRequests();
}

async function completeRequest(requestId) {
    if (!confirm('¿Marcar esta tutoría como finalizada?')) return;
    
    if (useSupabase) {
        const { error } = await supabaseClient
            .from('requests')
            .update({ status: 'completed' })
            .eq('id', requestId);
        if (error) {
            alert('Error al finalizar la tutoría: ' + error.message);
            return;
        }
    } else {
        const request = DB.requests.find(r => r.id === requestId);
        if (request) {
            request.status = 'completed';
            saveData();
        }
    }
    
    addNotification('Tutoría académica finalizada.', 'success');
    await loadTeacherRequests();
}

// ===== HISTORY =====
let historyFilter = 'all';

async function loadHistory() {
    try {
        let requests = [];
        if (useSupabase) {
            let query = supabaseClient
                .from('requests')
                .select('*, student:student_id(name), teacher:teacher_id(name)')
                .or(`student_id.eq.${currentUser.id},teacher_id.eq.${currentUser.id}`);

            if (historyFilter !== 'all') {
                query = query.eq('status', historyFilter);
            } else {
                query = query.neq('status', 'pending');
            }
            
            const { data, error } = await query;
            if (error) throw error;
            requests = data || [];
        } else {
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
            let partnerName = 'Usuario';
            if (useSupabase) {
                partnerName = currentUser.role === 'estudiante' 
                    ? (r.teacher ? r.teacher.name : 'Docente') 
                    : (r.student ? r.student.name : 'Estudiante');
            } else {
                const partner = currentUser.role === 'estudiante' ? getUserById(r.teacherId) : getUserById(r.studentId);
                partnerName = partner ? partner.name : 'Usuario';
            }

            const createdDate = new Date(r.created_at || r.createdAt).toLocaleDateString('es-ES');

            return `
                <tr onclick="openRequestDetails(${r.id})" style="cursor: pointer;">
                    <td>${partnerName}</td>
                    <td>${r.subject}</td>
                    <td>${formatDate(r.date)}</td>
                    <td>${r.time}</td>
                    <td><span class="status-badge status-${r.status}"><i class="fas ${getStatusIcon(r.status)}"></i> ${getStatusLabel(r.status)}</span></td>
                    <td>${createdDate}</td>
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

// ===== REALTIME TABLE FILTERS =====
function filterMyRequestsTable() {
    const searchVal = document.getElementById('search-my-requests').value.toLowerCase().trim();
    const rows = document.querySelectorAll('#my-requests-table tr');
    rows.forEach(row => {
        const teacherName = row.cells[0]?.textContent.toLowerCase() || '';
        const subject = row.cells[1]?.textContent.toLowerCase() || '';
        if (teacherName.includes(searchVal) || subject.includes(searchVal)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

function filterTeacherRequestsTable() {
    const searchVal = document.getElementById('search-teacher-requests').value.toLowerCase().trim();
    const rows = document.querySelectorAll('#teacher-requests-table tr');
    rows.forEach(row => {
        const studentName = row.cells[0]?.textContent.toLowerCase() || '';
        const subject = row.cells[1]?.textContent.toLowerCase() || '';
        if (studentName.includes(searchVal) || subject.includes(searchVal)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

function filterHistoryTable() {
    const searchVal = document.getElementById('search-history').value.toLowerCase().trim();
    const rows = document.querySelectorAll('#history-table tr');
    rows.forEach(row => {
        const partnerName = row.cells[0]?.textContent.toLowerCase() || '';
        const subject = row.cells[1]?.textContent.toLowerCase() || '';
        if (partnerName.includes(searchVal) || subject.includes(searchVal)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

// ===== RATING SYSTEM & STAR PICKER =====
let currentSelectedRating = 5;

function openRatingModal(requestId) {
    currentSelectedRating = 5;
    const html = `
        <h3 style="margin-bottom: 16px; font-size: 20px; color: var(--primary); display:flex; align-items:center; gap:8px;">
            <i class="fas fa-star"></i> Calificar Tutoría
        </h3>
        <p style="font-size: 14px; color: var(--text-light); margin-bottom: 20px;">
            Califica la calidad del acompañamiento brindado por tu docente.
        </p>
        <div style="display: flex; flex-direction: column; align-items: center; gap: 16px;">
            <div class="stars-input" id="stars-selector">
                <i class="fas fa-star active" data-value="1" onclick="setModalRating(1)"></i>
                <i class="fas fa-star active" data-value="2" onclick="setModalRating(2)"></i>
                <i class="fas fa-star active" data-value="3" onclick="setModalRating(3)"></i>
                <i class="fas fa-star active" data-value="4" onclick="setModalRating(4)"></i>
                <i class="fas fa-star active" data-value="5" onclick="setModalRating(5)"></i>
            </div>
            <div id="rating-text" style="font-weight: 700; font-size: 16px; color: var(--warning);">¡Excelente! (5/5)</div>
            <button class="btn btn-primary" style="margin-top: 16px; width: 100%;" onclick="submitRating(${requestId})">
                Guardar Calificación
            </button>
        </div>
    `;
    showModal(html);
}

function setModalRating(val) {
    currentSelectedRating = val;
    const stars = document.querySelectorAll('#stars-selector i');
    stars.forEach(s => {
        const starVal = parseInt(s.getAttribute('data-value'));
        if (starVal <= val) {
            s.classList.add('active');
        } else {
            s.classList.remove('active');
        }
    });

    const labels = {
        1: 'Muy Deficiente (1/5)',
        2: 'Deficiente (2/5)',
        3: 'Aceptable (3/5)',
        4: 'Muy Bueno (4/5)',
        5: '¡Excelente! (5/5)'
    };
    document.getElementById('rating-text').textContent = labels[val];
}

async function submitRating(requestId) {
    if (useSupabase) {
        const { error } = await supabaseClient
            .from('requests')
            .update({ rating: currentSelectedRating })
            .eq('id', requestId);
        if (error) {
            alert('Error al guardar calificación: ' + error.message);
            return;
        }
    } else {
        const request = DB.requests.find(r => r.id === requestId);
        if (request) {
            request.rating = currentSelectedRating;
            saveData();
        }
    }
    
    addNotification(`Calificaste la tutoría con ${currentSelectedRating} estrellas`, 'success');
    closeModal();
    await loadMyRequests();
}

// ===== DETAILED MODAL CARD =====
async function openRequestDetails(requestId) {
    let request;
    if (useSupabase) {
        const { data, error } = await supabaseClient
            .from('requests')
            .select('*, student:student_id(name, email), teacher:teacher_id(name, email)')
            .eq('id', requestId)
            .single();
        if (error || !data) return;
        request = data;
    } else {
        request = DB.requests.find(r => r.id === requestId);
    }
    if (!request) return;

    let studentName = 'Estudiante';
    let studentEmail = '';
    let teacherName = 'Docente';
    let teacherEmail = '';
    
    if (useSupabase) {
        studentName = request.student ? request.student.name : 'Estudiante';
        studentEmail = request.student ? request.student.email : '';
        teacherName = request.teacher ? request.teacher.name : 'Docente';
        teacherEmail = request.teacher ? request.teacher.email : '';
    } else {
        const student = getUserById(request.studentId);
        studentName = student ? student.name : 'Estudiante';
        studentEmail = student ? student.email : '';
        const teacher = getUserById(request.teacherId);
        teacherName = teacher ? teacher.name : 'Docente';
        teacherEmail = teacher ? teacher.email : '';
    }

    const createdDate = new Date(request.created_at || request.createdAt).toLocaleString('es-ES');

    let ratingSection = '';
    if (request.rating) {
        ratingSection = `
            <div style="margin-top: 16px; padding: 12px; background: #fffbeb; border: 1px solid #fef3c7; border-radius: var(--radius-sm);">
                <div style="font-weight: 700; color: #b45309; font-size: 13px; margin-bottom: 4px;">Calificación del Estudiante:</div>
                <div class="stars-display">${getStarsHTML(request.rating)}</div>
            </div>
        `;
    }

    const html = `
        <h3 style="margin-bottom: 20px; font-size: 22px; color: var(--primary); display: flex; align-items: center; gap: 8px;">
            <i class="fas fa-info-circle"></i> Detalles de la Tutoría
        </h3>
        <div style="display: grid; gap: 16px; font-size: 15px; color: var(--text);">
            <div>
                <strong>Materia / Tema:</strong>
                <div style="margin-top: 4px; padding: 8px 12px; background: var(--secondary-light); border-radius: 6px; font-weight: 600; color: var(--primary);">${request.subject}</div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                <div>
                    <strong>Estudiante:</strong>
                    <div>${studentName}</div>
                    <div style="font-size: 12px; color: var(--text-light);">${studentEmail}</div>
                </div>
                <div>
                    <strong>Docente:</strong>
                    <div>${teacherName}</div>
                    <div style="font-size: 12px; color: var(--text-light);">${teacherEmail}</div>
                </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                <div>
                    <strong>Fecha Pactada:</strong>
                    <div>${formatDate(request.date)}</div>
                </div>
                <div>
                    <strong>Hora Pactada:</strong>
                    <div>${request.time}</div>
                </div>
            </div>
            <div>
                <strong>Descripción / Dudas del Estudiante:</strong>
                <div style="margin-top: 4px; padding: 12px; background: var(--secondary-light); border-radius: 6px; font-style: italic;">
                    ${request.description || 'Sin descripción adicional'}
                </div>
            </div>
            <div>
                <strong>Estado:</strong>
                <div style="margin-top: 4px;">
                    <span class="status-badge status-${request.status}">
                        <i class="fas ${getStatusIcon(request.status)}"></i> ${getStatusLabel(request.status)}
                    </span>
                </div>
            </div>
            <div>
                <strong>Fecha de Creación:</strong>
                <div style="font-size: 13px; color: var(--text-light);">${createdDate}</div>
            </div>
            ${ratingSection}
        </div>
    `;
    showModal(html);
}

// ===== MODAL WINDOW =====
function showModal(content) {
    document.getElementById('modal-body').innerHTML = content;
    document.getElementById('modal').classList.add('show');
}

function closeModal() {
    document.getElementById('modal').classList.remove('show');
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
    // Sincronizar indicador visual de base de datos
    const indicator = document.getElementById('supabase-indicator');
    const text = document.getElementById('supabase-status-text');
    if (indicator && text) {
        if (useSupabase) {
            indicator.className = 'supabase-badge connected';
            text.innerHTML = '<i class="fas fa-check-circle"></i> Conectado a Supabase';
        } else {
            indicator.className = 'supabase-badge fallback';
            text.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Usando almacenamiento local (Mock)';
        }
    }

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

    // Cerrar modal al hacer clic afuera
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            closeModal();
        }
        
        // Cerrar panel de notificaciones al hacer clic fuera
        const panel = document.getElementById('notifications-panel');
        const notifToggle = document.querySelector('.notifications-toggle');
        if (panel && panel.classList.contains('show') && !panel.contains(e.target) && (!notifToggle || !notifToggle.contains(e.target))) {
            panel.classList.remove('show');
        }
    });
});