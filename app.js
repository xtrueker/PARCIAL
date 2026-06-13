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

// ===== PREMIUM LAYOUT & WIZARD VARIABLES =====
let chartStatusDonutInstance = null;
let chartSubjectsBarInstance = null;

let myRequestsViewMode = 'cards';
let teacherRequestsViewMode = 'cards';
let availabilityViewMode = 'calendar';
let activeWizardStep = 1;

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
    const donutCtx = document.getElementById('chart-status-donut');
    const barCtx = document.getElementById('chart-subjects-bar');
    if (!donutCtx || !barCtx) return;
    
    const counts = {
        pending: requests.filter(r => r.status === 'pending').length,
        accepted: requests.filter(r => r.status === 'accepted').length,
        completed: requests.filter(r => r.status === 'completed').length,
        cancelled: requests.filter(r => r.status === 'cancelled').length,
        rejected: requests.filter(r => r.status === 'rejected').length
    };
    
    // Destroy previous instances if they exist
    if (chartStatusDonutInstance) {
        chartStatusDonutInstance.destroy();
    }
    if (chartSubjectsBarInstance) {
        chartSubjectsBarInstance.destroy();
    }
    
    // Create Donut Chart
    chartStatusDonutInstance = new Chart(donutCtx, {
        type: 'doughnut',
        data: {
            labels: ['Pendientes', 'Aceptadas', 'Finalizadas', 'Canceladas', 'Rechazadas'],
            datasets: [{
                data: [counts.pending, counts.accepted, counts.completed, counts.cancelled, counts.rejected],
                backgroundColor: [
                    '#f59e0b', // Pending (yellow)
                    '#4f46e5', // Accepted (indigo)
                    '#10b981', // Completed (green)
                    '#64748b', // Cancelled (gray)
                    '#ef4444'  // Rejected (red)
                ],
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        boxWidth: 12,
                        font: {
                            family: 'Inter',
                            size: 11,
                            weight: '600'
                        },
                        padding: 15
                    }
                }
            },
            cutout: '65%'
        }
    });
    
    // Calculate subjects count
    const subjectsMap = {};
    requests.forEach(r => {
        subjectsMap[r.subject] = (subjectsMap[r.subject] || 0) + 1;
    });
    
    // Sort and get top subjects
    const subjectsSorted = Object.entries(subjectsMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
        
    const barLabels = subjectsSorted.map(item => item[0]);
    const barData = subjectsSorted.map(item => item[1]);
    
    // If no data, show placeholder labels
    const hasData = barData.length > 0;
    const finalLabels = hasData ? barLabels : ['Cálculo', 'Álgebra', 'Física', 'Estadística', 'Programación'];
    const finalData = hasData ? barData : [0, 0, 0, 0, 0];
    
    // Create Bar Chart
    chartSubjectsBarInstance = new Chart(barCtx, {
        type: 'bar',
        data: {
            labels: finalLabels,
            datasets: [{
                label: 'Cantidad de Tutorías',
                data: finalData,
                backgroundColor: 'rgba(79, 70, 229, 0.85)',
                hoverBackgroundColor: '#4f46e5',
                borderRadius: 6,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: {
                            family: 'Inter',
                            size: 10,
                            weight: '500'
                        }
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        borderDash: [5, 5],
                        color: 'rgba(226, 232, 240, 0.8)'
                    },
                    ticks: {
                        stepSize: 1,
                        font: {
                            family: 'Inter',
                            size: 10,
                            weight: '500'
                        }
                    }
                }
            }
        }
    });
}

// ===== NEW REQUEST (Student) =====
async function loadNewRequest() {
    try {
        activeWizardStep = 1;
        updateWizardProgress();

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

        // Render visual cards for teachers
        renderTeachersVisualGrid();

        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        document.getElementById('req-date').min = tomorrow.toISOString().split('T')[0];

        // Clear slot grid
        document.getElementById('visual-time-slots').innerHTML = '<div style="grid-column: span 4; text-align: center; color: var(--text-light); font-size: 14px; padding: 15px;">Selecciona un docente y fecha primero para ver horarios.</div>';

        document.getElementById('request-error').classList.remove('show');
        document.getElementById('request-success').classList.remove('show');
    } catch (err) {
        console.error('Error en loadNewRequest:', err);
    }
}

function renderTeachersVisualGrid() {
    const grid = document.getElementById('teachers-visual-grid');
    if (!grid) return;
    
    const teachers = getAvailableTeachers();
    
    grid.innerHTML = teachers.map(t => {
        // Calculate average rating from DB.requests
        const tRequests = DB.requests.filter(r => r.teacherId === t.id && r.status === 'completed' && r.rating);
        const avgRating = tRequests.length > 0 ? (tRequests.reduce((acc, r) => acc + r.rating, 0) / tRequests.length).toFixed(1) : 'S/C';
        
        // Define some mock specialties based on their index/name
        const specialties = t.id === 1 ? 'Matemáticas, Álgebra, Cálculo' : t.id === 3 ? 'Física, Programación, Estadística' : 'Ciencias Generales';
        const initials = t.name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase();
        
        const isSelected = document.getElementById('req-teacher').value == t.id;
        
        return `
            <div class="teacher-card-visual ${isSelected ? 'selected' : ''}" data-id="${t.id}" onclick="selectTeacherVisual(${t.id})">
                <div class="teacher-avatar-circle">${initials}</div>
                <div class="teacher-info-box">
                    <div class="teacher-name-visual">${t.name}</div>
                    <div class="teacher-rating-stars">
                        <i class="fas fa-star"></i> <span>${avgRating}</span>
                        <span style="color:var(--text-light); font-size:10px; margin-left:4px;">(${tRequests.length} calif.)</span>
                    </div>
                    <div class="teacher-specialties">${specialties}</div>
                </div>
                <div class="selected-badge"><i class="fas fa-check"></i></div>
            </div>
        `;
    }).join('');
}

function selectTeacherVisual(teacherId) {
    document.getElementById('req-teacher').value = teacherId;
    document.querySelectorAll('.teacher-card-visual').forEach(card => {
        if (card.getAttribute('data-id') == teacherId) {
            card.classList.add('selected');
        } else {
            card.classList.remove('selected');
        }
    });
    
    // Clear time select and selected slot
    document.getElementById('req-time').value = '';
    
    // Trigger update timeslots
    updateTimeSlots(teacherId);
}

function selectTimeSlot(time) {
    document.getElementById('req-time').value = time;
    document.querySelectorAll('.time-slot-pill.available').forEach(pill => {
        if (pill.textContent.includes(time)) {
            pill.classList.add('selected');
        } else {
            pill.classList.remove('selected');
        }
    });
}

function wizardNext(step) {
    if (step === 2) {
        const teacherId = document.getElementById('req-teacher').value;
        const subject = document.getElementById('req-subject').value.trim();
        if (!teacherId) {
            alert('Por favor selecciona un docente.');
            return;
        }
        if (!subject) {
            alert('Por favor introduce la materia o tema.');
            return;
        }
        
        activeWizardStep = 2;
        updateWizardProgress();
        updateTimeSlots(teacherId);
    } else if (step === 3) {
        const date = document.getElementById('req-date').value;
        const time = document.getElementById('req-time').value;
        if (!date) {
            alert('Por favor selecciona una fecha.');
            return;
        }
        if (!time) {
            alert('Por favor selecciona una hora disponible.');
            return;
        }
        
        const teacherId = document.getElementById('req-teacher').value;
        const teacher = getUserById(parseInt(teacherId));
        const teacherName = teacher ? teacher.name : 'Docente';
        const subject = document.getElementById('req-subject').value;
        
        document.getElementById('summary-teacher').textContent = teacherName;
        document.getElementById('summary-subject').textContent = subject;
        document.getElementById('summary-date').textContent = formatDate(date);
        document.getElementById('summary-time').textContent = time + ' H';
        
        activeWizardStep = 3;
        updateWizardProgress();
    }
}

function wizardPrev(step) {
    activeWizardStep = step;
    updateWizardProgress();
}

function updateWizardProgress() {
    document.querySelectorAll('.wizard-step').forEach((el, index) => {
        el.style.display = (index + 1) === activeWizardStep ? 'block' : 'none';
    });
    
    const progress = activeWizardStep === 1 ? 0 : activeWizardStep === 2 ? 50 : 100;
    const progressBar = document.getElementById('wizard-progress-bar');
    if (progressBar) progressBar.style.width = progress + '%';
    
    document.querySelectorAll('.step-indicator').forEach((el, index) => {
        const stepNum = index + 1;
        el.classList.remove('active', 'completed');
        if (stepNum === activeWizardStep) {
            el.classList.add('active');
        } else if (stepNum < activeWizardStep) {
            el.classList.add('completed');
        }
    });
}

async function updateTimeSlots(teacherId) {
    try {
        const timeSelect = document.getElementById('req-time');
        const visualSlots = document.getElementById('visual-time-slots');
        const dateInput = document.getElementById('req-date').value;

        if (!teacherId) {
            timeSelect.innerHTML = '<option value="">Seleccionar horario...</option>';
            visualSlots.innerHTML = '<div style="grid-column: span 4; text-align: center; color: var(--text-light); font-size: 14px; padding: 15px;">Selecciona un docente y fecha primero para ver horarios.</div>';
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
            visualSlots.innerHTML = '<div style="grid-column: span 4; text-align: center; color: var(--text-light); font-size: 14px; padding: 15px;">Selecciona una fecha primero para ver horarios disponibles.</div>';
            return;
        }

        const dayName = new Date(dateInput + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long' });
        const dayCapitalized = dayName.charAt(0).toUpperCase() + dayName.slice(1);

        const dayAvail = availability.filter(a => a.day === dayCapitalized);

        if (dayAvail.length === 0) {
            timeSelect.innerHTML = '<option value="">El docente no tiene disponibilidad este día</option>';
            visualSlots.innerHTML = '<div style="grid-column: span 4; text-align: center; color: var(--danger); font-weight: 600; font-size: 14px; padding: 15px;"><i class="fas fa-exclamation-circle"></i> El docente no tiene disponibilidad registrada para los ' + dayCapitalized + 's.</div>';
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

        // Check slots capacity (maximum 2 accepted slots)
        let scheduledSessions = [];
        if (useSupabase) {
            const { data, error } = await supabaseClient
                .from('requests')
                .select('time')
                .eq('teacher_id', teacherId)
                .eq('date', dateInput)
                .eq('status', 'accepted');
            if (error) throw error;
            scheduledSessions = data || [];
        } else {
            scheduledSessions = DB.requests.filter(r => 
                r.teacherId === parseInt(teacherId) && 
                r.date === dateInput && 
                r.status === 'accepted'
            );
        }

        const slotCounts = {};
        scheduledSessions.forEach(s => {
            const timeVal = s.time.substring(0, 5);
            slotCounts[timeVal] = (slotCounts[timeVal] || 0) + 1;
        });

        timeSelect.innerHTML = '<option value="">Seleccionar hora...</option>' +
            slots.map(s => `<option value="${s}">${s}</option>`).join('');

        visualSlots.innerHTML = slots.map(s => {
            const count = slotCounts[s] || 0;
            const isFull = count >= 2;
            const isSelected = timeSelect.value === s;
            
            if (isFull) {
                return `<div class="time-slot-pill unavailable" title="Cupo de 2 tutorías lleno">
                    <i class="fas fa-ban"></i> ${s} (Lleno)
                </div>`;
            } else {
                const badge = count === 1 ? `<span style="font-size: 9px; background: var(--warning); color: white; padding: 1px 4px; border-radius: 4px; margin-left: 4px;">1/2 ocupado</span>` : '';
                return `<div class="time-slot-pill available ${isSelected ? 'selected' : ''}" onclick="selectTimeSlot('${s}')">
                    <i class="fas fa-clock"></i> ${s} ${badge}
                </div>`;
            }
        }).join('');
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
            const container = document.getElementById('my-requests-cards-container');
            if (container) container.innerHTML = '';
            emptyEl.classList.add('show');
            return;
        }

        emptyEl.classList.remove('show');

        // Render visual cards
        renderMyRequestsCards(requests);

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

        filterMyRequests();
    } catch (err) {
        console.error('Error en loadMyRequests:', err);
    }
}

function renderMyRequestsCards(requests) {
    const container = document.getElementById('my-requests-cards-container');
    if (!container) return;
    
    container.innerHTML = requests.sort((a, b) => {
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
        
        const initials = teacherName.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase();
        const canCancel = r.status === 'pending' || r.status === 'accepted';
        const canEdit = r.status === 'pending';

        return `
            <div class="request-card ${r.status}" onclick="openRequestDetails(${r.id})" style="cursor: pointer;">
                <div class="request-card-header">
                    <div class="user-meta">
                        <div class="user-circle">${initials}</div>
                        <div>
                            <div class="user-name">${teacherName}</div>
                            <div class="user-role-label">Docente Asignado</div>
                        </div>
                    </div>
                    <span class="status-badge status-${r.status}"><i class="fas ${getStatusIcon(r.status)}"></i> ${getStatusLabel(r.status)}</span>
                </div>
                <div class="subject-title">${r.subject}</div>
                <div style="margin-bottom: 8px;">
                    <div class="datetime-badge"><i class="far fa-calendar-alt"></i> ${formatDate(r.date)}</div>
                    <div class="datetime-badge"><i class="far fa-clock"></i> ${r.time} H</div>
                </div>
                <div style="font-size: 13px; color: var(--text-light); font-style: italic; max-height: 40px; overflow: hidden; text-overflow: ellipsis; margin-bottom: 16px;">
                    ${r.description ? `"${r.description}"` : 'Sin descripción de dudas'}
                </div>
                <div class="request-card-footer" onclick="event.stopPropagation();">
                    <div class="stars-container">
                        ${r.status === 'completed' && r.rating ? `<span class="stars-display">${getStarsHTML(r.rating)}</span>` : ''}
                        ${r.status === 'completed' && !r.rating ? `<button class="btn btn-sm btn-primary" onclick="openRatingModal(${r.id})"><i class="fas fa-star"></i> Calificar</button>` : ''}
                    </div>
                    <div class="card-actions">
                        ${canEdit ? `<button class="btn btn-sm btn-warning" onclick="editRequest(${r.id})" title="Editar"><i class="fas fa-edit"></i></button>` : ''}
                        ${canCancel ? `<button class="btn btn-sm btn-danger" onclick="cancelRequest(${r.id})" title="Cancelar"><i class="fas fa-ban"></i></button>` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function switchMyRequestsView(mode) {
    myRequestsViewMode = mode;
    
    const btnCards = document.getElementById('btn-my-req-cards');
    const btnTable = document.getElementById('btn-my-req-table');
    const viewCards = document.getElementById('my-requests-cards-view');
    const viewTable = document.getElementById('my-requests-table-view');
    
    if (mode === 'cards') {
        if (btnCards) btnCards.classList.add('active');
        if (btnTable) btnTable.classList.remove('active');
        if (viewCards) viewCards.style.display = 'block';
        if (viewTable) viewTable.style.display = 'none';
    } else {
        if (btnCards) btnCards.classList.remove('active');
        if (btnTable) btnTable.classList.add('active');
        if (viewCards) viewCards.style.display = 'none';
        if (viewTable) viewTable.style.display = 'block';
    }
}

function filterMyRequests() {
    const searchVal = document.getElementById('search-my-requests').value.toLowerCase().trim();
    
    // Filter table rows
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
    
    // Filter cards
    const cards = document.querySelectorAll('#my-requests-cards-container .request-card');
    let visibleCards = 0;
    cards.forEach(card => {
        const teacherName = card.querySelector('.user-name')?.textContent.toLowerCase() || '';
        const subject = card.querySelector('.subject-title')?.textContent.toLowerCase() || '';
        if (teacherName.includes(searchVal) || subject.includes(searchVal)) {
            card.style.display = 'flex';
            visibleCards++;
        } else {
            card.style.display = 'none';
        }
    });
    
    const emptyEl = document.getElementById('my-requests-empty');
    if (cards.length > 0 && visibleCards === 0) {
        emptyEl.classList.add('show');
    } else if (cards.length > 0) {
        emptyEl.classList.remove('show');
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
    const teacherId = useSupabase ? request.teacher_id : request.teacherId;
    document.getElementById('req-teacher').value = teacherId;
    document.getElementById('req-subject').value = request.subject;
    document.getElementById('req-date').value = request.date;
    
    // Highlight visual card selection
    setTimeout(() => {
        const cards = document.querySelectorAll('.teacher-card-visual');
        cards.forEach(card => {
            if (card.getAttribute('data-id') == teacherId) {
                card.classList.add('selected');
            } else {
                card.classList.remove('selected');
            }
        });
    }, 150);
    
    await updateTimeSlots(teacherId);
    setTimeout(() => {
        document.getElementById('req-time').value = request.time;
        // Highlight pill selection
        const pills = document.querySelectorAll('.time-slot-pill.available');
        pills.forEach(pill => {
            if (pill.textContent.includes(request.time)) {
                pill.classList.add('selected');
            }
        });
    }, 250);
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
            const calendarGrid = document.getElementById('weekly-calendar-grid-body');
            if (calendarGrid) calendarGrid.innerHTML = '';
            emptyEl.classList.add('show');
        } else {
            emptyEl.classList.remove('show');
            
            // Render calendar view
            renderWeeklyCalendar(avail);
            
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

function renderWeeklyCalendar(avail) {
    const gridBody = document.getElementById('weekly-calendar-grid-body');
    if (!gridBody) return;
    
    let html = '';
    const startHour = 8;
    const endHour = 22;
    
    // Generate base empty slots for the week
    for (let h = startHour; h <= endHour; h++) {
        const timeStr = `${h.toString().padStart(2, '0')}:00`;
        html += `<div class="calendar-hour-label">${timeStr}</div>`;
        for (let d = 1; d <= 6; d++) {
            html += `<div class="calendar-grid-cell" data-hour="${h}" data-day="${d}"></div>`;
        }
    }
    
    gridBody.innerHTML = html;
    
    const dayIndices = {
        'Lunes': 1,
        'Martes': 2,
        'Miércoles': 3,
        'Jueves': 4,
        'Viernes': 5,
        'Sábado': 6
    };
    
    avail.forEach(a => {
        const dayIdx = dayIndices[a.day];
        if (!dayIdx) return;
        
        const startH = parseInt(a.start.split(':')[0]);
        const endH = parseInt(a.end.split(':')[0]);
        const duration = endH - startH;
        if (duration <= 0) return;
        
        const colStart = dayIdx + 1;
        const rowStart = startH - startHour + 1;
        const rowEnd = rowStart + duration;
        
        const cardHtml = `
            <div class="calendar-avail-block" style="grid-column: ${colStart}; grid-row: ${rowStart} / ${rowEnd};">
                <div class="block-time"><i class="far fa-clock"></i> ${a.start} - ${a.end}</div>
                <div class="block-title">Disponible</div>
                <button class="block-delete-btn" onclick="deleteAvailability(${a.id})" title="Eliminar este bloque">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        `;
        gridBody.insertAdjacentHTML('beforeend', cardHtml);
    });
}

function switchAvailabilityView(mode) {
    availabilityViewMode = mode;
    
    const btnCal = document.getElementById('btn-avail-cal');
    const btnTab = document.getElementById('btn-avail-table');
    const viewCal = document.getElementById('availability-calendar-view');
    const viewTab = document.getElementById('availability-table-view');
    
    if (mode === 'calendar') {
        if (btnCal) btnCal.classList.add('active');
        if (btnTab) btnTab.classList.remove('active');
        if (viewCal) viewCal.style.display = 'block';
        if (viewTab) viewTab.style.display = 'none';
        loadAvailability();
    } else {
        if (btnCal) btnCal.classList.remove('active');
        if (btnTab) btnTab.classList.add('active');
        if (viewCal) viewCal.style.display = 'none';
        if (viewTab) viewTab.style.display = 'block';
        loadAvailability();
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
            const container = document.getElementById('teacher-requests-cards-container');
            if (container) container.innerHTML = '';
            emptyEl.classList.add('show');
            return;
        }

        emptyEl.classList.remove('show');

        // Render both views
        renderTeacherRequestsCards(requests);

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

        filterTeacherRequests();
    } catch (err) {
        console.error('Error en loadTeacherRequests:', err);
    }
}

function renderTeacherRequestsCards(requests) {
    const container = document.getElementById('teacher-requests-cards-container');
    if (!container) return;
    
    container.innerHTML = requests.sort((a, b) => {
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
        
        const initials = studentName.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase();
        const isPending = r.status === 'pending';

        return `
            <div class="request-card ${r.status}" onclick="openRequestDetails(${r.id})" style="cursor: pointer;">
                <div class="request-card-header">
                    <div class="user-meta">
                        <div class="user-circle">${initials}</div>
                        <div>
                            <div class="user-name">${studentName}</div>
                            <div class="user-role-label">Estudiante</div>
                        </div>
                    </div>
                    <span class="status-badge status-${r.status}"><i class="fas ${getStatusIcon(r.status)}"></i> ${getStatusLabel(r.status)}</span>
                </div>
                <div class="subject-title">${r.subject}</div>
                <div style="margin-bottom: 8px;">
                    <div class="datetime-badge"><i class="far fa-calendar-alt"></i> ${formatDate(r.date)}</div>
                    <div class="datetime-badge"><i class="far fa-clock"></i> ${r.time} H</div>
                </div>
                <div style="font-size: 13px; color: var(--text-light); font-style: italic; max-height: 40px; overflow: hidden; text-overflow: ellipsis; margin-bottom: 16px;">
                    ${r.description ? `"${r.description}"` : 'Sin descripción de dudas'}
                </div>
                <div class="request-card-footer" onclick="event.stopPropagation();">
                    <div class="rating-display">
                        ${r.rating ? `<span class="stars-display">${getStarsHTML(r.rating)}</span>` : '<span style="font-size: 12px; color:var(--text-light); font-style: italic;">Sin calificación aún</span>'}
                    </div>
                    <div class="card-actions">
                        ${isPending ? `
                            <button class="btn btn-sm btn-success" onclick="acceptRequest(${r.id})" title="Aceptar"><i class="fas fa-check"></i></button>
                            <button class="btn btn-sm btn-danger" onclick="rejectRequest(${r.id})" title="Rechazar"><i class="fas fa-times"></i></button>
                        ` : r.status === 'accepted' ? `
                            <button class="btn btn-sm btn-primary" onclick="completeRequest(${r.id})"><i class="fas fa-check-double"></i> Finalizar</button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function switchTeacherRequestsView(mode) {
    teacherRequestsViewMode = mode;
    
    const btnCards = document.getElementById('btn-teacher-req-cards');
    const btnTable = document.getElementById('btn-teacher-req-table');
    const viewCards = document.getElementById('teacher-requests-cards-view');
    const viewTable = document.getElementById('teacher-requests-table-view');
    
    if (mode === 'cards') {
        if (btnCards) btnCards.classList.add('active');
        if (btnTable) btnTable.classList.remove('active');
        if (viewCards) viewCards.style.display = 'block';
        if (viewTable) viewTable.style.display = 'none';
    } else {
        if (btnCards) btnCards.classList.remove('active');
        if (btnTable) btnTable.classList.add('active');
        if (viewCards) viewCards.style.display = 'none';
        if (viewTable) viewTable.style.display = 'block';
    }
}

function filterTeacherRequests() {
    const searchVal = document.getElementById('search-teacher-requests').value.toLowerCase().trim();
    
    // Filter table rows
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
    
    // Filter cards
    const cards = document.querySelectorAll('#teacher-requests-cards-container .request-card');
    let visibleCards = 0;
    cards.forEach(card => {
        const studentName = card.querySelector('.user-name')?.textContent.toLowerCase() || '';
        const subject = card.querySelector('.subject-title')?.textContent.toLowerCase() || '';
        if (studentName.includes(searchVal) || subject.includes(searchVal)) {
            card.style.display = 'flex';
            visibleCards++;
        } else {
            card.style.display = 'none';
        }
    });
    
    const emptyEl = document.getElementById('teacher-requests-empty');
    if (cards.length > 0 && visibleCards === 0) {
        emptyEl.classList.add('show');
    } else if (cards.length > 0) {
        emptyEl.classList.remove('show');
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

        // Calculate statistics for KPI cards
        const completed = requests.filter(r => r.status === 'completed');
        const cancelled = requests.filter(r => r.status === 'cancelled' || r.status === 'rejected');
        const rated = completed.filter(r => r.rating);
        const avgRating = rated.length > 0 ? (rated.reduce((acc, r) => acc + r.rating, 0) / rated.length).toFixed(1) : '0.0';
        
        // Mock each tutoring is 1 hour
        const totalHours = completed.length;
        
        document.getElementById('h-stat-completed').textContent = completed.length;
        document.getElementById('h-stat-cancelled').textContent = cancelled.length;
        document.getElementById('h-stat-rating').textContent = `${avgRating} ★`;
        document.getElementById('h-stat-hours').textContent = `${totalHours}h`;

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

function exportHistoryCSV() {
    let requests = [];
    if (currentUser.role === 'estudiante') {
        requests = DB.requests.filter(r => r.studentId === currentUser.id && r.status !== 'pending');
    } else {
        requests = DB.requests.filter(r => r.teacherId === currentUser.id && r.status !== 'pending');
    }
    
    if (requests.length === 0) {
        alert('No hay tutorías en el historial para exportar.');
        return;
    }
    
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // BOM for Excel encoding
    csvContent += "Materia/Tema,Estudiante/Docente,Fecha,Hora,Estado,Fecha de Solicitud,Calificación\r\n";
    
    requests.forEach(r => {
        let partnerName = 'Usuario';
        if (currentUser.role === 'estudiante') {
            const t = getUserById(r.teacherId);
            partnerName = t ? t.name : 'Docente';
        } else {
            const s = getUserById(r.studentId);
            partnerName = s ? s.name : 'Estudiante';
        }
        
        const createdDate = new Date(r.created_at || r.createdAt).toLocaleDateString('es-ES');
        const ratingText = r.rating ? `${r.rating} estrellas` : 'Sin calificar';
        const statusLabel = getStatusLabel(r.status);
        
        csvContent += `"${r.subject}","${partnerName}","${r.date}","${r.time}","${statusLabel}","${createdDate}","${ratingText}"\r\n`;
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `TutorConnect_Historial_${currentUser.name.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addNotification('Historial exportado como archivo CSV.', 'success');
}

function printReport() {
    window.print();
}

function filterHistory(filter) {
    historyFilter = filter;
    const buttons = document.querySelectorAll('#view-history .filter-btn');
    buttons.forEach(b => b.classList.remove('active'));
    if (event && event.target) event.target.classList.add('active');
    loadHistory();
}

// ===== REALTIME TABLE FILTERS =====
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