/* StudyFlow — compatibilidad con la ruta histórica js/i18n/i18n.js.
   El núcleo canónico vive en js/i18n.js; este archivo sólo lo carga
   para que ningún service worker antiguo deje la interfaz sin traducir. */
(function () {
  'use strict';
  if (window.StudyI18n && window.StudyI18n.__core) return;
  document.write('<script src="../i18n.js"><\/script>');
})();
