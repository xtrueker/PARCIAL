# Sistema Web de Gestión de Tutorías Académicas

Este proyecto es una plataforma integral diseñada para conectar a estudiantes y docentes, facilitando y registrando el apoyo académico a través de la gestión de tutorías.

---

## 📋 Tabla de Contenido
1. [Descripción General](#-descripción-general)
2. [Arquitectura y Módulos](#-arquitectura-y-módulos)
3. [Estructura de Roles](#-estructura-de-roles)
4. [Estructura del Repositorio (Ramas)](#-estructura-del-repositorio-ramas)
5. [Tecnologías y Configuración](#-tecnologías-y-configuración)

---

## 📖 Descripción General
El **Sistema Web de Gestión de Tutorías Académicas** permite a los estudiantes que necesitan refuerzo en diferentes asignaturas encontrar docentes disponibles, agendar sesiones, y realizar el seguimiento de su progreso académico de manera centralizada.

---

## 🏗️ Arquitectura y Módulos
El sistema está estructurado bajo los siguientes módulos funcionales clave:

1. **Registro de Usuarios (CRUD):** Registro, actualización y gestión de perfiles de Estudiantes y Docentes.
2. **Solicitud de Tutorías (CRUD):** Creación, edición, cancelación y consulta de solicitudes de tutoría por parte de los estudiantes.
3. **Gestión de Horarios:** Calendario de disponibilidad de los docentes y reserva de espacios.
4. **Asignación y Seguimiento (CRUD):** Asignación de docentes a solicitudes y registro de notas/comentarios de seguimiento post-tutoría.
5. **Visualización de Historial:** Registro histórico de tutorías completadas, pendientes y canceladas para ambos roles.

---

## 👥 Estructura de Roles
* **Estudiante:** Puede registrarse, buscar docentes, solicitar tutorías, ver sus horarios agendados y consultar su historial académico.
* **Docente:** Puede gestionar su disponibilidad de horario, aceptar/gestionar tutorías asignadas, registrar el seguimiento de cada sesión y ver su historial de tutorías impartidas.

---

## 🌿 Estructura del Repositorio (Ramas)
Para mantener un flujo de trabajo ordenado y seguir las mejores prácticas de integración continua, el repositorio utiliza un modelo de ramificación simplificado basado en Git Flow:

* `main`: Contiene el código de producción completamente funcional y estable.
* `develop`: Rama de integración donde se consolidan todas las nuevas características antes de ser desplegadas a producción.
* `feature/*`: Ramas temporales creadas para el desarrollo de características específicas (ej. `feature/registro-usuarios`, `feature/solicitud-tutorias`).
* `bugfix/*`: Ramas temporales para la corrección de errores detectados en la integración.

---

## ⚙️ Tecnologías y Configuración
* **Frontend:** HTML5, CSS3 y JavaScript moderno.
* **Base de Datos/Persistencia:** Memoria volátil / LocalStorage para demostración en el MVP.

### Instrucciones de Ejecución
*(Instrucciones de despliegue a ser añadidas tras la configuración del servidor de desarrollo).*
