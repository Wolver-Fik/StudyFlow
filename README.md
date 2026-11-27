[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-StudyFlow-E0A96D)](https://wolver-fik.github.io/StudyFlow/)

[English](#english) · [Español](#español)

---

<a id="english"></a>
## English

**StudyFlow** is a calm, editorial-style study planner that runs entirely in your browser. Plan your week, log study time, keep an eye on exams and understand your grades — no account, no server, no tracking.

**Version:** `studyflow-v1.3.4`

### Features

- **Subjects** with weekly hour goals and a syllabus progress slider.
- **Weekly schedule** with classes and study blocks, plus a per-day agenda.
- **Exams & deadlines** with live countdowns (days, hours and minutes).
- **Flashcards with spaced repetition** — build subject-specific decks and review cards on an intelligent schedule.
- **Question bank & timed mock exams** — create four-option multiple-choice questions (optionally linked to a unit), shuffle them into a 10/20/30-minute mock exam, get an instant grade on your configured scale and review every miss.
- **Stage 2 backup integrity** — JSON exports include `schemaVersion`, `appId`, export date, question bank and mock-exam history; validation rejects another app's file before replacing anything.
- **Lightweight lists** — flashcards, question bank and exam history render in capped batches with a "show more" expander for smooth mobile scrolling.
- **Mastery by unit / topic** — a per-unit indicator combining completed syllabus tasks, flashcard mastery and mock-exam accuracy.
- **Smart recovery of lost sessions** — restore sessions interrupted by a reload or a closed tab without losing tracked time.
- **Indicative exam readiness** — a guidance indicator that suggests how prepared you are based on syllabus coverage and study time.
- **Grades** with configurable numeric or A–F scales, weights and a dynamic "average needed" calculation.
- **Focus timer** with Pomodoro and free-stopwatch modes, draggable and minimizable, with automatic time logging.
- **14-day chart** of study time, colored by subject.
- **Backup & restore** as JSON or CSV, entirely local. The question bank, mock-exam history and mastery data are included in JSON exports and round-trip through validated imports.
- **Offline PWA**: installable on desktop and mobile, works without a network after the first visit.
- **8 languages** with automatic detection and a selector in the header: English, Español, Português, Français, Italiano, Deutsch, Русский and 日本語.

### Live demo

<https://wolver-fik.github.io/StudyFlow/>

### Install as an app

1. Open the site in Chrome, Edge or Safari.
2. Use the browser menu and choose **Install app** / **Add to Home Screen**.
3. StudyFlow opens in its own window and is available offline.

### Project structure

```
index.html              App shell, language selector and PWA links
manifest.webmanifest    Install metadata and icons
sw.js                   Network-First service worker
css/styles.css          Warm editorial theme (#0D0D0D + #E0A96D)
js/storage.js           State, IndexedDB storage, migrations and JSON/CSV export
js/app.js               Views, timer, modals and interactions
js/i18n/i18n.js         Translation core (detect, t, count, num, date)
js/i18n/<code>.js       Eight language dictionaries
icons/                  SVG source, Pillow generator and PNG icons
```

### Language notes

Your interface language is detected from the browser on the first visit and then saved in `localStorage`. Content you create (subject names, notes, exam titles) is your own data and is never rewritten when you switch languages. The initial demo content carries an internal i18n key, so subjects, tasks, exams and grades keep translating while you use the demo; as soon as you edit one of them, it becomes your own text and stays fixed.

### Data & storage

IndexedDB (`studyflow_db`) is the primary store for subjects, the weekly schedule, grades, flashcards, attachments, the question bank and mock-exam history. It works offline and is not subject to the 5 MB `localStorage` limit. `localStorage` only keeps lightweight preferences such as the interface language. Clearing site data in your browser deletes `studyflow_db` together with those preferences: the app starts fresh and there is no server-side copy to recover from. Export a JSON backup first if you want to keep your data.

### License

Copyright (c) 2026 Wolver-Fik. Licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE). Noncommercial use only.

---

<a id="español"></a>
## Español

**StudyFlow** es un planificador de estudio de estilo editorial que funciona por completo en tu navegador. Planificá la semana, registrá tu tiempo de estudio, seguí los exámenes y entendé tus notas: sin cuenta, sin servidor, sin rastreo.

**Versión:** `studyflow-v1.3.4`

### Funciones

- **Materias** con objetivo semanal de horas y barra de avance del temario.
- **Horario semanal** con clases y bloques de estudio, y una agenda por día.
- **Exámenes y entregas** con cuenta regresiva en vivo (días, horas y minutos).
- **Tarjetas de memoria (flashcards) con repetición espaciada** — creá mazos por materia y repasá las tarjetas con una programación inteligente.
- **Banco de preguntas y simulacros cronometrados** — creá preguntas de opción múltiple con cuatro alternativas (opcionalmente ligadas a una unidad), mezclalas en un simulacro de 10/20/30 minutos, obtené una nota automática en tu escala configurada y repasá cada fallo.
- **Integridad de respaldo (Etapa 2)** — el JSON incluye `schemaVersion`, `appId`, fecha de exportación, banco de preguntas e historial de simulacros; la validación rechaza archivos de otra app antes de reemplazar nada.
- **Listas ligeras** — flashcards, banco de preguntas e historial de exámenes se renderizan por tandas con un desplegable «Ver más» para una navegación fluida en móvil.
- **Dominio por unidad / tema** — un indicador por unidad que combina tareas del temario completadas, dominio de flashcards y aciertos en simulacros.
- **Recuperación inteligente de sesiones perdidas** — recuperá sesiones interrumpidas por una recarga o una pestaña cerrada sin perder el tiempo registrado.
- **Indicador orientativo de preparación para exámenes** — una guía que sugiere qué tan preparado estás según el temario cubierto y el tiempo estudiado.
- **Notas** con escalas numéricas o A–F configurables, pesos y un cálculo dinámico del promedio necesario para aprobar.
- **Temporizador de enfoque** con Pomodoro y cronómetro libre, arrastrable y minimizable, que registra el tiempo automáticamente.
- **Gráfico de 14 días** del tiempo estudiado, coloreado por materia.
- **Respaldo y restauración** en JSON o CSV, completamente local. El banco de preguntas, el historial de simulacros y los datos de dominio se incluyen en la exportación JSON y se restauran con validación.
- **PWA sin conexión**: se instala en escritorio y móvil, y funciona sin red después de la primera visita.
- **8 idiomas** con detección automática y selector en el encabezado: English, Español, Português, Français, Italiano, Deutsch, Русский y 日本語.

### Demo en vivo

<https://wolver-fik.github.io/StudyFlow/>

### Instalar como aplicación

1. Abrí el sitio en Chrome, Edge o Safari.
2. En el menú del navegador elegí **Instalar aplicación** / **Agregar a la pantalla de inicio**.
3. StudyFlow se abre en su propia ventana y funciona sin conexión.

### Estructura del proyecto

```
index.html              Estructura, selector de idioma y enlaces PWA
manifest.webmanifest    Metadatos de instalación e iconos
sw.js                   Service worker Network-First
css/styles.css          Tema editorial cálido (#0D0D0D + #E0A96D)
js/storage.js           Estado, IndexedDB, migraciones y exportación JSON/CSV
js/app.js               Vistas, temporizador, modales e interacciones
js/i18n/i18n.js         Núcleo de traducción (detección, t, count, num, date)
js/i18n/<code>.js       Ocho diccionarios de idioma
icons/                  SVG fuente, generador con Pillow e iconos PNG
```

### Notas sobre idiomas

El idioma de la interfaz se detecta del navegador en la primera visita y se guarda en `localStorage`. El contenido que creás (nombres de materias, notas, títulos de exámenes) es tuyo y nunca se reescribe al cambiar de idioma. El contenido de demostración inicial lleva una clave i18n interna: materias, tareas, exámenes y notas siguen traduciéndose mientras uses el demo; en cuanto editás uno de esos textos, pasa a ser tuyo y queda fijo.

### Datos y almacenamiento

IndexedDB (`studyflow_db`) es el almacenamiento principal de materias, horario semanal, notas, flashcards, adjuntos, banco de preguntas e historial de simulacros. Funciona sin conexión y no tiene el límite de 5 MB de `localStorage`. `localStorage` sólo guarda preferencias ligeras como el idioma de la interfaz. Al borrar los datos del sitio en el navegador se eliminan `studyflow_db` y esas preferencias: la app arranca como nueva y no hay copia en un servidor que permita recuperarlos. Exportá un respaldo JSON antes si querés conservar tus datos.

### Licencia

Copyright (c) 2026 Wolver-Fik. Bajo la [PolyForm Noncommercial License 1.0.0](LICENSE). Solo uso no comercial.
