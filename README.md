[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-StudyFlow-E0A96D)](https://wolver-fik.github.io/StudyFlow/)

[English](#english) · [Español](#español)

---

<a id="english"></a>
## English

**StudyFlow** is a calm, editorial-style study planner that runs entirely in your browser. Plan your week, log study time, keep an eye on exams and understand your grades — no account, no server, no tracking.

### Features

- **Subjects** with weekly hour goals and a syllabus progress slider.
- **Weekly schedule** with classes and study blocks, plus a per-day agenda.
- **Exams & deadlines** with live countdowns (days, hours and minutes).
- **Grades** with configurable numeric or A–F scales, weights and a dynamic "average needed" calculation.
- **Focus timer** with Pomodoro and free-stopwatch modes, draggable and minimizable, with automatic time logging.
- **14-day chart** of study time, colored by subject.
- **Backup & restore** as JSON or CSV, entirely local.
- **Offline PWA**: installable on desktop and mobile, works without a network after the first visit.
- **8 languages** with automatic detection and a selector in the header: English, Español, Português, Français, Italiano, Deutsch, Русский and 日本語.

### Live demo

<https://wolver-fik.github.io/StudyFlow/>

### Install as an app

1. Open the site in Chrome, Edge or Safari.
2. Use the browser menu and choose **Install app** / **Add to Home Screen**.
3. StudyFlow opens in its own window and is available offline.

### Run locally

The app has no build step. Because the service worker and `fetch` need HTTP, serve the folder instead of opening `index.html` directly:

```bash
python -m http.server 8000
# then open http://localhost:8000/
```

### Project structure

```
index.html              App shell, language selector and PWA links
manifest.webmanifest    Install metadata and icons
sw.js                   Network-First service worker
css/styles.css          Warm editorial theme (#0D0D0D + #E0A96D)
js/storage.js           State, migrations, sample data and JSON/CSV export
js/app.js               Views, timer, modals and interactions
js/i18n/i18n.js         Translation core (detect, t, count, num, date)
js/i18n/<code>.js       Eight language dictionaries
icons/                  SVG source, Pillow generator and PNG icons
```

### Language notes

Your interface language is detected from the browser on the first visit and then saved in `localStorage`. Content you create (subject names, notes, exam titles) is your own data and is never rewritten when you switch languages. The initial demo content carries an internal i18n key, so subjects, tasks, exams and grades keep translating while you use the demo; as soon as you edit one of them, it becomes your own text and stays fixed.

### Regenerating icons

```bash
pip install Pillow
python icons/make_icons.py
```

### License

Copyright (c) 2026 Wolver-Fik. Licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE). Noncommercial use only.

---

<a id="español"></a>
## Español

**StudyFlow** es un planificador de estudio de estilo editorial que funciona por completo en tu navegador. Planificá la semana, registrá tu tiempo de estudio, seguí los exámenes y entendé tus notas: sin cuenta, sin servidor, sin rastreo.

### Funciones

- **Materias** con objetivo semanal de horas y barra de avance del temario.
- **Horario semanal** con clases y bloques de estudio, y una agenda por día.
- **Exámenes y entregas** con cuenta regresiva en vivo (días, horas y minutos).
- **Notas** con escalas numéricas o A–F configurables, pesos y un cálculo dinámico del promedio necesario para aprobar.
- **Temporizador de enfoque** con Pomodoro y cronómetro libre, arrastrable y minimizable, que registra el tiempo automáticamente.
- **Gráfico de 14 días** del tiempo estudiado, coloreado por materia.
- **Respaldo y restauración** en JSON o CSV, completamente local.
- **PWA sin conexión**: se instala en escritorio y móvil, y funciona sin red después de la primera visita.
- **8 idiomas** con detección automática y selector en el encabezado: English, Español, Português, Français, Italiano, Deutsch, Русский y 日本語.

### Demo en vivo

<https://wolver-fik.github.io/StudyFlow/>

### Instalar como aplicación

1. Abrí el sitio en Chrome, Edge o Safari.
2. En el menú del navegador elegí **Instalar aplicación** / **Agregar a la pantalla de inicio**.
3. StudyFlow se abre en su propia ventana y funciona sin conexión.

### Ejecutar en local

La app no requiere compilación. El service worker necesita HTTP, por lo que conviene servir la carpeta en lugar de abrir `index.html` directamente:

```bash
python -m http.server 8000
# luego abrir http://localhost:8000/
```

### Estructura del proyecto

```
index.html              Estructura, selector de idioma y enlaces PWA
manifest.webmanifest    Metadatos de instalación e iconos
sw.js                   Service worker Network-First
css/styles.css          Tema editorial cálido (#0D0D0D + #E0A96D)
js/storage.js           Estado, migraciones, datos de ejemplo y exportación JSON/CSV
js/app.js               Vistas, temporizador, modales e interacciones
js/i18n/i18n.js         Núcleo de traducción (detección, t, count, num, date)
js/i18n/<code>.js       Ocho diccionarios de idioma
icons/                  SVG fuente, generador con Pillow e iconos PNG
```

### Notas sobre idiomas

El idioma de la interfaz se detecta del navegador en la primera visita y se guarda en `localStorage`. El contenido que creás (nombres de materias, notas, títulos de exámenes) es tuyo y nunca se reescribe al cambiar de idioma. El contenido de demostración inicial lleva una clave i18n interna: materias, tareas, exámenes y notas siguen traduciéndose mientras uses el demo; en cuanto editás uno de esos textos, pasa a ser tuyo y queda fijo.

### Regenerar los iconos

```bash
pip install Pillow
python icons/make_icons.py
```

### Licencia

Copyright (c) 2026 Wolver-Fik. Bajo la [PolyForm Noncommercial License 1.0.0](LICENSE). Solo uso no comercial.
