/* StudyFlow — curricula.js
 * Base de datos offline de planes de estudio por país / carrera.
 * Expone window.SFCurricula. No depende de la red para funcionar.
 */
(function () {
  'use strict';

  var I = window.StudyI18n || null;
  var L = function (k, v) { return I ? I.t(k, v) : k; };

  var COLORS = ['#E0A96D', '#D97B66', '#8FB996', '#C9B07A', '#B9A1D8', '#E2A0A0', '#7FB7B5', '#D4C48A'];
  var COUNTRY_KEY = 'studyflow-country';

  /* Máscaras de carrera: una institución declara una sola vez qué carreras
     dicta. Así el catálogo es exhaustivo por país/carrera sin repetir planes. */
  var BIT = {
    systems: 1, medicine: 2, law: 4, accounting: 8,
    psychology: 16, architecture: 32, business: 64, design: 128
  };
  var ALL_CAREERS = 255;
  function bm() {
    var n = 0, i;
    for (i = 0; i < arguments.length; i++) n |= BIT[arguments[i]] || 0;
    return n;
  }
  function u(id, name, sigla, sede, mask, kind) {
    return { id: id, name: name, sigla: sigla, sede: sede, mask: mask, kind: kind || 'pub' };
  }

  /* Materia: nombre oficial, horas semanales recomendadas, color y unidades. */
  function s(name, hours, color, units) {
    return { name: name, hours: hours, color: COLORS[color % COLORS.length], units: units.slice() };
  }
  function p(year, term, subjects) {
    return { id: 'y' + year + (term === 'anual' ? '' : '-' + term), year: year, term: term, subjects: subjects };
  }

  /* Planes base. Se comparten entre países con nombres/educación equivalentes;
     cada país aplica su institución, título oficial y traducción de materias. */
  var PLANS = {
    systems: [
      p(1, 'anual', [
        s('Cálculo I', 6, 0, ['Límites y continuidad', 'Derivadas y aplicaciones', 'Integrales definidas', 'Sucesiones y series']),
        s('Álgebra Lineal', 5, 2, ['Vectores y espacios vectoriales', 'Matrices y determinantes', 'Sistemas de ecuaciones', 'Valores y vectores propios']),
        s('Programación I', 6, 5, ['Tipos, variables y control de flujo', 'Funciones y modularidad', 'Arreglos y cadenas', 'Depuración y pruebas básicas'])
      ]),
      p(2, 'anual', [
        s('Estructuras de Datos', 6, 4, ['Listas, pilas y colas', 'Árboles y grafos', 'Ordenamiento y búsqueda', 'Complejidad algorítmica']),
        s('Bases de Datos', 5, 6, ['Modelo relacional', 'SQL y normalización', 'Diseño de esquemas', 'Transacciones y concurrencia']),
        s('Sistemas Operativos', 5, 7, ['Procesos e hilos', 'Planificación y concurrencia', 'Memoria y archivos', 'Sistemas distribuidos'])
      ]),
      p(3, 'anual', [
        s('Ingeniería de Software', 5, 1, ['Requisitos y casos de uso', 'Diseño y patrones', 'Pruebas y calidad', 'Ciclos de vida ágiles']),
        s('Redes de Computadoras', 5, 3, ['Modelo OSI y TCP/IP', 'Direccionamiento y enrutamiento', 'Protocolos de aplicación', 'Seguridad perimetral']),
        s('Algoritmos y Complejidad', 6, 0, ['Análisis asintótico', 'Divide y vencerás', 'Programación dinámica', 'Grafos y flujos'])
      ]),
      p(4, 'anual', [
        s('Arquitectura de Software', 5, 4, ['Estilos y patrones arquitectónicos', 'Servicios y microservicios', 'Escalabilidad y disponibilidad', 'Documentación de arquitectura']),
        s('Inteligencia Artificial', 5, 5, ['Búsqueda y representación', 'Aprendizaje supervisado', 'Redes neuronales', 'Ética y sesgos']),
        s('Proyecto de Graduación', 6, 2, ['Formulación del problema', 'Diseño de la solución', 'Implementación y pruebas', 'Defensa y documentación'])
      ])
    ],
    medicine: [
      p(1, 'anual', [
        s('Anatomía I', 7, 1, ['Aparato locomotor', 'Sistema cardiovascular', 'Sistema respiratorio', 'Sistema nervioso']),
        s('Bioquímica', 5, 2, ['Proteínas y enzimas', 'Metabolismo energético', 'Metabolismo de lípidos', 'ADN y síntesis proteica']),
        s('Histología', 5, 4, ['Tejidos epiteliales y conectivos', 'Tejido muscular y nervioso', 'Órganos y sistemas', 'Técnicas de tinción'])
      ]),
      p(2, 'anual', [
        s('Fisiología', 6, 6, ['Homeostasis', 'Fisiología cardiovascular', 'Fisiología renal', 'Sistema endocrino']),
        s('Patología', 6, 1, ['Lesión y adaptación celular', 'Inflamación', 'Neoplasias', 'Patología de sistemas']),
        s('Farmacología', 5, 5, ['Farmacocinética', 'Farmacodinamia', 'Fármacos del sistema nervioso', 'Interacciones y reacciones adversas'])
      ]),
      p(3, 'anual', [
        s('Diagnóstico Clínico', 6, 0, ['Anamnesis y examen físico', 'Semiología', 'Interpretación de laboratorio', 'Razonamiento clínico']),
        s('Medicina Interna', 7, 2, ['Enfermedades cardiovasculares', 'Enfermedades respiratorias', 'Enfermedades digestivas', 'Enfermedades infecciosas']),
        s('Cirugía', 6, 3, ['Técnicas quirúrgicas', 'Pre operatorio', 'Post operatorio', 'Urgencias quirúrgicas'])
      ]),
      p(4, 'anual', [
        s('Obstetricia y Ginecología', 5, 5, ['Embarazo y control prenatal', 'Parto', 'Complicaciones obstétricas', 'Salud ginecológica']),
        s('Pediatría', 5, 7, ['Crecimiento y desarrollo', 'Vacunación', 'Enfermedades infantiles', 'Urgencias pediátricas']),
        s('Salud Pública', 4, 2, ['Epidemiología', 'Promoción y prevención', 'Sistemas de salud', 'Bioética'])
      ])
    ],
    law: [
      p(1, 'anual', [
        s('Derecho Civil I', 6, 0, ['Personas y domicilio', 'Bienes y propiedad', 'Contratos', 'Responsabilidad civil']),
        s('Derecho Constitucional', 5, 4, ['Constitución y garantías', 'Derechos fundamentales', 'Organización del Estado', 'Control constitucional']),
        s('Teoría General del Derecho', 4, 6, ['Fuentes del derecho', 'Norma y sistema jurídico', 'Interpretación jurídica', 'Ética y justicia'])
      ]),
      p(2, 'anual', [
        s('Derecho Penal', 6, 1, ['Teoría del delito', 'Penalidad y medidas', 'Delitos contra las personas', 'Delitos contra la propiedad']),
        s('Derecho Procesal', 5, 5, ['Jurisdicción y competencia', 'Sujetos procesales', 'Prueba', 'Recursos']),
        s('Derecho Administrativo', 5, 2, ['Acto administrativo', 'Procedimiento administrativo', 'Contratos públicos', 'Control de la administración'])
      ]),
      p(3, 'anual', [
        s('Derecho Comercial', 5, 3, ['Comerciantes y sociedades', 'Contratos mercantiles', 'Títulos valores', 'Concursos y quiebras']),
        s('Derecho Laboral', 5, 7, ['Relación de trabajo', 'Contrato y salario', 'Jornada y descansos', 'Seguridad social']),
        s('Derecho Internacional', 4, 4, ['Derecho internacional público', 'Tratados', 'Derecho internacional privado', 'Derechos humanos'])
      ]),
      p(4, 'anual', [
        s('Derecho Procesal Civil', 5, 0, ['Proceso civil', 'Demanda y contestación', 'Ejecución de sentencias', 'Medios alternativos']),
        s('Ética y Deontología', 3, 5, ['Ética profesional', 'Deberes y secretos', 'Conflictos de interés', 'Responsabilidad disciplinaria']),
        s('Seminario de Tesis', 6, 2, ['Elección del tema', 'Marco teórico', 'Metodología', 'Redacción y defensa'])
      ])
    ],
    accounting: [
      p(1, 'anual', [
        s('Contabilidad I', 6, 0, ['Patrimonio y ecuación contable', 'Ciclo contable', 'Estados financieros', 'Inventarios']),
        s('Matemática Financiera', 5, 4, ['Interés simple y compuesto', 'Anualidades', 'Amortización', 'Tasas y descuentos']),
        s('Microeconomía', 4, 2, ['Oferta y demanda', 'Elasticidad', 'Costos de producción', 'Estructuras de mercado'])
      ]),
      p(2, 'anual', [
        s('Contabilidad II', 6, 1, ['Sociedades', 'Activos fijos y depreciación', 'Pasivos y provisiones', 'Consolidación de estados']),
        s('Costos', 5, 6, ['Costos directos e indirectos', 'Costeo por procesos', 'Costeo ABC', 'Punto de equilibrio']),
        s('Derecho Comercial', 4, 5, ['Sociedades comerciales', 'Contratos', 'Títulos valores', 'Registros públicos'])
      ]),
      p(3, 'anual', [
        s('Auditoría', 5, 3, ['Normas y principios de auditoría', 'Control interno', 'Pruebas sustantivas', 'Informe de auditoría']),
        s('Tributación', 5, 7, ['Impuesto a las ganancias', 'Impuesto al valor agregado', 'Retenciones', 'Planeamiento tributario']),
        s('Finanzas Corporativas', 5, 0, ['Presupuesto de capital', 'Costo de capital', 'Estructura de capital', 'Flujo de caja'])
      ]),
      p(4, 'anual', [
        s('Contabilidad Avanzada', 5, 2, ['Normas internacionales', 'Instrumentos financieros', 'Revalorización', 'Estados consolidados']),
        s('Macroeconomía', 4, 4, ['PIB y crecimiento', 'Inflación y desempleo', 'Política monetaria', 'Política fiscal']),
        s('Trabajo de Graduación', 6, 6, ['Problema de investigación', 'Recolección de datos', 'Análisis financiero', 'Defensa del trabajo'])
      ])
    ],
    psychology: [
      p(1, 'anual', [
        s('Psicología General', 5, 0, ['Historia de la psicología', 'Corrientes y escuelas', 'Percepción y atención', 'Memoria y aprendizaje']),
        s('Biología del Comportamiento', 5, 2, ['Sistema nervioso', 'Neurotransmisores', 'Genética y conducta', 'Sistema endocrino']),
        s('Métodos de Investigación', 4, 4, ['Diseño de investigación', 'Medición y variables', 'Muestreo', 'Ética en la investigación'])
      ]),
      p(2, 'anual', [
        s('Psicología del Desarrollo', 5, 5, ['Infancia', 'Adolescencia', 'Adultez', 'Vejez']),
        s('Psicología Social', 5, 7, ['Socialización', 'Actitudes y persuasión', 'Grupos e influencia', 'Conflicto y cooperación']),
        s('Estadística Aplicada', 5, 6, ['Estadística descriptiva', 'Probabilidad', 'Inferencia estadística', 'Contraste de hipótesis'])
      ]),
      p(3, 'anual', [
        s('Psicopatología', 6, 1, ['Trastornos del estado de ánimo', 'Trastornos de ansiedad', 'Trastornos psicóticos', 'Trastornos de la personalidad']),
        s('Evaluación Psicológica', 5, 3, ['Entrevista clínica', 'Pruebas psicométricas', 'Tests proyectivos', 'Informe psicológico']),
        s('Psicología Cognitiva', 5, 4, ['Atención y conciencia', 'Memoria de trabajo', 'Lenguaje', 'Toma de decisiones'])
      ]),
      p(4, 'anual', [
        s('Psicoterapias', 6, 2, ['Terapia cognitivo-conductual', 'Terapia sistémica', 'Terapia humanista', 'Evaluación de resultados']),
        s('Ética Profesional', 3, 5, ['Código deontológico', 'Confidencialidad', 'Consentimiento informado', 'Dilemas éticos']),
        s('Práctica Profesional', 6, 0, ['Práctica supervisada', 'Estudios de caso', 'Supervisión clínica', 'Proyecto final'])
      ])
    ],
    architecture: [
      p(1, 'anual', [
        s('Taller de Diseño I', 8, 0, ['Lenguaje arquitectónico', 'Proporción y escala', 'Espacio y función', 'Presentación de proyectos']),
        s('Geometría Descriptiva', 5, 4, ['Proyecciones', 'Planos y secciones', 'Perspectiva', 'Axonometría']),
        s('Historia de la Arquitectura', 4, 2, ['Arquitectura clásica', 'Edad Media y Renacimiento', 'Barroco y Neoclásico', 'Arquitectura moderna'])
      ]),
      p(2, 'anual', [
        s('Taller de Diseño II', 8, 1, ['Análisis del sitio', 'Programa arquitectónico', 'Implantación', 'Materialidad y detalle']),
        s('Estructuras', 6, 6, ['Estática', 'Vigas y pórticos', 'Losas y cubiertas', 'Cálculo de estructuras']),
        s('Materiales de Construcción', 4, 3, ['Hormigón y acero', 'Mampostería', 'Madera y vidrio', 'Aislamiento y acabados'])
      ]),
      p(3, 'anual', [
        s('Taller de Diseño III', 8, 5, ['Vivienda colectiva', 'Espacio público', 'Sostenibilidad', 'Detalle constructivo']),
        s('Urbanismo', 5, 7, ['Teoría urbana', 'Planificación territorial', 'Movilidad', 'Espacios verdes']),
        s('Instalaciones', 5, 2, ['Agua y saneamiento', 'Electricidad', 'Climatización', 'Contra incendios'])
      ]),
      p(4, 'anual', [
        s('Taller de Diseño IV', 8, 4, ['Proyecto integral', 'Relación contexto-objeto', 'Detalle y construcción', 'Defensa del proyecto']),
        s('Presupuestos y Gestión', 5, 0, ['Mediciones', 'Presupuesto de obra', 'Cronograma', 'Dirección de obra']),
        s('Proyecto de Grado', 6, 6, ['Tema y anteproyecto', 'Desarrollo del proyecto', 'Documentación técnica', 'Exhibición final'])
      ])
    ],
    business: [
      p(1, 'anual', [
        s('Administración General', 5, 0, ['Proceso administrativo', 'Planificación', 'Organización', 'Dirección y control']),
        s('Contabilidad Básica', 5, 2, ['Ecuación contable', 'Ciclo contable', 'Balance', 'Estado de resultados']),
        s('Microeconomía', 4, 4, ['Oferta y demanda', 'Elasticidad', 'Costos', 'Competencia'])
      ]),
      p(2, 'anual', [
        s('Marketing', 5, 5, ['Investigación de mercado', 'Segmentación', 'Mezcla de marketing', 'Marketing digital']),
        s('Recursos Humanos', 4, 7, ['Reclutamiento y selección', 'Capacitación', 'Evaluación del desempeño', 'Relaciones laborales']),
        s('Matemática para Negocios', 4, 6, ['Intereses', 'Anualidades', 'Descuentos', 'Estadística básica'])
      ]),
      p(3, 'anual', [
        s('Estrategia Empresarial', 5, 1, ['Análisis del entorno', 'Ventaja competitiva', 'Estrategias de crecimiento', 'Implementación']),
        s('Gestión de Operaciones', 5, 3, ['Diseño de procesos', 'Calidad', 'Inventarios', 'Logística']),
        s('Finanzas', 5, 0, ['Presupuestos', 'Costo de capital', 'Inversión', 'Indicadores financieros'])
      ]),
      p(4, 'anual', [
        s('Emprendimiento', 4, 2, ['Identificación de oportunidades', 'Modelo de negocio', 'Financiación', 'Pitch y presentación']),
        s('Dirección de Proyectos', 5, 4, ['Inicio y planificación', 'Alcance y tiempo', 'Riesgos', 'Monitoreo y cierre']),
        s('Trabajo Final', 6, 6, ['Definición del problema', 'Análisis de caso', 'Propuesta de solución', 'Defensa'])
      ])
    ],
    design: [
      p(1, 'anual', [
        s('Lenguaje Visual', 5, 0, ['Punto, línea y forma', 'Composición', 'Color', 'Ritmo y jerarquía']),
        s('Dibujo Técnico', 5, 4, ['Proyecciones', 'Escalas', 'Planos', 'Normalización']),
        s('Historia del Diseño', 4, 2, ['Diseño y artesanía', 'Movimientos de vanguardia', 'Diseño moderno', 'Diseño contemporáneo'])
      ]),
      p(2, 'anual', [
        s('Diseño Gráfico', 6, 1, ['Identidad visual', 'Tipografía', 'Sistemas gráficos', 'Composición editorial']),
        s('Diseño Digital', 6, 5, ['Herramientas digitales', 'Tratamiento de imagen', 'Diseño vectorial', 'Animación básica']),
        s('Teoría del Color', 4, 3, ['Círculo cromático', 'Armonías', 'Color y percepción', 'Color en medios digitales'])
      ]),
      p(3, 'anual', [
        s('Diseño de Producto', 6, 6, ['Investigación de usuario', 'Ideación y prototipado', 'Forma y función', 'Materiales y producción']),
        s('Interacción y UX', 6, 7, ['Arquitectura de información', 'Wireframes', 'Usabilidad', 'Pruebas con usuarios']),
        s('Metodologías de Diseño', 4, 0, ['Design thinking', 'Investigación cualitativa', 'Iteración', 'Trabajo interdisciplinar'])
      ]),
      p(4, 'anual', [
        s('Portafolio Profesional', 5, 2, ['Selección de proyectos', 'Narrativa visual', 'Presentación', 'Plataformas y redes']),
        s('Gestión de Proyectos de Diseño', 4, 4, ['Brief y alcance', 'Cronograma', 'Presupuesto', 'Entrega y evaluación']),
        s('Trabajo Final de Diseño', 6, 5, ['Planteamiento del problema', 'Desarrollo conceptual', 'Prototipo final', 'Defensa del proyecto'])
      ])
    ]
  };

  var CAREER_LABELS = {
    systems: 'curriculum.career.systems',
    medicine: 'curriculum.career.medicine',
    law: 'curriculum.career.law',
    accounting: 'curriculum.career.accounting',
    psychology: 'curriculum.career.psychology',
    architecture: 'curriculum.career.architecture',
    business: 'curriculum.career.business',
    design: 'curriculum.career.design'
  };
  var CAREER_IDS = Object.keys(CAREER_LABELS);

  /* Catálogo de centros universitarios por país. Cada entrada: id, nombre
     oficial, sigla, sede principal/modalidad, máscara de carreras y tipo. */
  var INSTITUTIONS = {
    UY: [
      u('uy-udelar-fing', 'Universidad de la República — Facultad de Ingeniería', 'Udelar · Fing', 'Montevideo', bm('systems'), 'pub'),
      u('uy-udelar-fmed', 'Universidad de la República — Facultad de Medicina', 'Udelar · FMed', 'Montevideo', bm('medicine'), 'pub'),
      u('uy-udelar-fder', 'Universidad de la República — Facultad de Derecho', 'Udelar · FDer', 'Montevideo', bm('law'), 'pub'),
      u('uy-udelar-fcea', 'Universidad de la República — Facultad de Ciencias Económicas y de Administración', 'Udelar · FCEA', 'Montevideo', bm('accounting', 'business'), 'pub'),
      u('uy-udelar-fadu', 'Universidad de la República — Facultad de Arquitectura, Diseño y Urbanismo', 'Udelar · FADU', 'Montevideo', bm('architecture', 'design'), 'pub'),
      u('uy-udelar-fpsi', 'Universidad de la República — Facultad de Psicología', 'Udelar · FPsico', 'Montevideo', bm('psychology'), 'pub'),
      u('uy-udelar-fciencias', 'Universidad de la República — Facultad de Ciencias', 'Udelar · FC', 'Montevideo', bm('systems'), 'pub'),
      u('uy-ort', 'Universidad ORT Uruguay', 'ORT', 'Montevideo', ALL_CAREERS, 'priv'),
      u('uy-ucu', 'Universidad Católica del Uruguay', 'UCU', 'Montevideo', bm('systems', 'law', 'accounting', 'psychology', 'architecture', 'business', 'design'), 'priv'),
      u('uy-um', 'Universidad de Montevideo', 'UM', 'Montevideo', bm('systems', 'medicine', 'law', 'accounting', 'psychology', 'business', 'design'), 'priv'),
      u('uy-ude', 'Universidad de la Empresa', 'UDE', 'Montevideo', bm('systems', 'law', 'accounting', 'business', 'design'), 'priv'),
      u('uy-unifa', 'Instituto Universitario Francisco de Asís', 'UNIFA', 'Maldonado / Punta del Este', bm('systems', 'law', 'accounting', 'psychology', 'business'), 'priv'),
      u('uy-utec', 'Universidad Tecnológica del Uruguay', 'UTEC', 'Durazno / Montevideo / sedes regionales', bm('systems', 'business', 'design'), 'pub'),
      u('uy-iuacj', 'Instituto Universitario de la Asociación Cristiana de Jóvenes', 'IUACJ', 'Montevideo', bm('accounting', 'psychology', 'business'), 'priv'),
      u('uy-claeh', 'Centro Latinoamericano de Economía Humana', 'CLAEH', 'Montevideo / Punta del Este', bm('medicine', 'psychology', 'business'), 'priv')
    ],
    AR: [
      u('ar-uba', 'Universidad de Buenos Aires', 'UBA', 'Buenos Aires · FIUBA / FMed / FDer / FCE / FADU / FFyL', ALL_CAREERS, 'pub'),
      u('ar-utn', 'Universidad Tecnológica Nacional', 'UTN', 'Buenos Aires / sedes nacionales', bm('systems', 'business'), 'pub'),
      u('ar-unlp', 'Universidad Nacional de La Plata', 'UNLP', 'La Plata', ALL_CAREERS, 'pub'),
      u('ar-unc', 'Universidad Nacional de Córdoba', 'UNC', 'Córdoba', ALL_CAREERS, 'pub'),
      u('ar-unr', 'Universidad Nacional de Rosario', 'UNR', 'Rosario', ALL_CAREERS, 'pub'),
      u('ar-uncuyo', 'Universidad Nacional de Cuyo', 'UNCuyo', 'Mendoza', ALL_CAREERS, 'pub'),
      u('ar-uade', 'Universidad Argentina de la Empresa', 'UADE', 'Buenos Aires', bm('systems', 'law', 'accounting', 'psychology', 'business', 'design'), 'priv'),
      u('ar-uca', 'Universidad Católica Argentina', 'UCA', 'Buenos Aires', bm('medicine', 'law', 'accounting', 'psychology', 'architecture', 'business', 'design'), 'priv'),
      u('ar-itba', 'Instituto Tecnológico de Buenos Aires', 'ITBA', 'Buenos Aires', bm('systems', 'business'), 'priv'),
      u('ar-upalermo', 'Universidad de Palermo', 'UP', 'Buenos Aires', bm('systems', 'law', 'psychology', 'architecture', 'business', 'design'), 'priv')
    ],
    ES: [
      u('es-ucm', 'Universidad Complutense de Madrid', 'UCM', 'Madrid', bm('medicine', 'law', 'accounting', 'psychology', 'business'), 'pub'),
      u('es-ub', 'Universitat de Barcelona', 'UB', 'Barcelona', bm('medicine', 'law', 'accounting', 'psychology', 'business'), 'pub'),
      u('es-upm', 'Universidad Politécnica de Madrid', 'UPM', 'Madrid', bm('systems', 'architecture', 'design'), 'pub'),
      u('es-upc', 'Universitat Politècnica de Catalunya', 'UPC', 'Barcelona', bm('systems', 'architecture', 'design'), 'pub'),
      u('es-uv', 'Universitat de València', 'UV', 'València', bm('medicine', 'law', 'accounting', 'psychology', 'business'), 'pub'),
      u('es-us', 'Universidad de Sevilla', 'US', 'Sevilla', bm('medicine', 'law', 'accounting', 'psychology', 'architecture', 'business'), 'pub'),
      u('es-upf', 'Universitat Pompeu Fabra', 'UPF', 'Barcelona', bm('medicine', 'law', 'psychology', 'business', 'design'), 'pub'),
      u('es-uam', 'Universidad Autónoma de Madrid', 'UAM', 'Madrid', bm('medicine', 'law', 'accounting', 'psychology', 'business'), 'pub'),
      u('es-uned', 'Universidad Nacional de Educación a Distancia', 'UNED', 'En línea / presencial', bm('law', 'accounting', 'psychology', 'business'), 'onl')
    ],
    MX: [
      u('mx-unam', 'Universidad Nacional Autónoma de México', 'UNAM', 'Ciudad de México', ALL_CAREERS, 'pub'),
      u('mx-ipn', 'Instituto Politécnico Nacional', 'IPN', 'Ciudad de México', bm('systems', 'medicine', 'accounting', 'architecture', 'business', 'design'), 'pub'),
      u('mx-tec', 'Tecnológico de Monterrey', 'Tec de Monterrey', 'Monterrey / campus nacionales', ALL_CAREERS, 'priv'),
      u('mx-udg', 'Universidad de Guadalajara', 'UDG', 'Guadalajara', ALL_CAREERS, 'pub'),
      u('mx-uanl', 'Universidad Autónoma de Nuevo León', 'UANL', 'Monterrey', ALL_CAREERS, 'pub'),
      u('mx-uam', 'Universidad Autónoma Metropolitana', 'UAM', 'Ciudad de México', bm('systems', 'medicine', 'accounting', 'psychology', 'architecture', 'business', 'design'), 'pub'),
      u('mx-buap', 'Benemérita Universidad Autónoma de Puebla', 'BUAP', 'Puebla', ALL_CAREERS, 'pub'),
      u('mx-unison', 'Universidad de Sonora', 'Unison', 'Hermosillo', bm('systems', 'medicine', 'law', 'accounting', 'psychology', 'business'), 'pub')
    ],
    CL: [
      u('cl-uchile', 'Universidad de Chile', 'U. de Chile', 'Santiago', ALL_CAREERS, 'pub'),
      u('cl-puc', 'Pontificia Universidad Católica de Chile', 'PUC', 'Santiago', ALL_CAREERS, 'priv'),
      u('cl-usach', 'Universidad de Santiago de Chile', 'USACH', 'Santiago', bm('systems', 'medicine', 'law', 'accounting', 'psychology', 'business', 'design'), 'pub'),
      u('cl-usm', 'Universidad Técnica Federico Santa María', 'USM', 'Valparaíso', bm('systems', 'architecture', 'design', 'business'), 'pub'),
      u('cl-udp', 'Universidad Diego Portales', 'UDP', 'Santiago', ALL_CAREERS, 'priv'),
      u('cl-uandes', 'Universidad de los Andes', 'U. Andes', 'Santiago', bm('medicine', 'law', 'psychology', 'architecture', 'business', 'design'), 'priv'),
      u('cl-unab', 'Universidad Andrés Bello', 'UNAB', 'Santiago / Viña del Mar', bm('systems', 'medicine', 'law', 'psychology', 'architecture', 'business', 'design'), 'priv'),
      u('cl-ucsc', 'Universidad Católica de la Santísima Concepción', 'UCSC', 'Concepción', bm('systems', 'medicine', 'law', 'accounting', 'psychology', 'architecture', 'business'), 'priv')
    ],
    CO: [
      u('co-unal', 'Universidad Nacional de Colombia', 'UNAL', 'Bogotá / Medellín / Palmira', ALL_CAREERS, 'pub'),
      u('co-andes', 'Universidad de los Andes', 'Uniandes', 'Bogotá', ALL_CAREERS, 'priv'),
      u('co-javeriana', 'Pontificia Universidad Javeriana', 'Javeriana', 'Bogotá / Cali', ALL_CAREERS, 'priv'),
      u('co-eafit', 'Escuela de Administración, Finanzas e Instituto Tecnológico', 'EAFIT', 'Medellín', bm('systems', 'accounting', 'business', 'design'), 'priv'),
      u('co-udea', 'Universidad de Antioquia', 'UdeA', 'Medellín', ALL_CAREERS, 'pub'),
      u('co-univalle', 'Universidad del Valle', 'Univalle', 'Cali', ALL_CAREERS, 'pub'),
      u('co-icesi', 'Universidad Icesi', 'Icesi', 'Cali', bm('systems', 'law', 'accounting', 'psychology', 'business', 'design'), 'priv')
    ],
    BR: [
      u('br-usp', 'Universidade de São Paulo', 'USP', 'São Paulo', ALL_CAREERS, 'pub'),
      u('br-unicamp', 'Universidade Estadual de Campinas', 'UNICAMP', 'Campinas', bm('systems', 'medicine', 'law', 'psychology', 'architecture', 'business', 'design'), 'pub'),
      u('br-ufrj', 'Universidade Federal do Rio de Janeiro', 'UFRJ', 'Rio de Janeiro', ALL_CAREERS, 'pub'),
      u('br-unesp', 'Universidade Estadual Paulista', 'UNESP', 'São Paulo / interior', ALL_CAREERS, 'pub'),
      u('br-ufmg', 'Universidade Federal de Minas Gerais', 'UFMG', 'Belo Horizonte', ALL_CAREERS, 'pub'),
      u('br-pucsp', 'Pontifícia Universidade Católica de São Paulo', 'PUC-SP', 'São Paulo', ALL_CAREERS, 'priv'),
      u('br-pucrio', 'Pontifícia Universidade Católica do Rio de Janeiro', 'PUC-Rio', 'Rio de Janeiro', ALL_CAREERS, 'priv'),
      u('br-pucmg', 'Pontifícia Universidade Católica de Minas Gerais', 'PUC-MG', 'Belo Horizonte', ALL_CAREERS, 'priv'),
      u('br-pucpr', 'Pontifícia Universidade Católica do Paraná', 'PUC-PR', 'Curitiba', bm('systems', 'law', 'accounting', 'psychology', 'architecture', 'business', 'design'), 'priv'),
      u('br-fgv', 'Fundação Getulio Vargas', 'FGV', 'Rio de Janeiro / São Paulo', bm('law', 'accounting', 'business'), 'priv')
    ],
    US: [
      u('us-state', 'State University (plan estándar EE.UU.)', 'State U.', 'Presencial / en línea', ALL_CAREERS, 'onl'),
      u('us-mit', 'Massachusetts Institute of Technology', 'MIT', 'Cambridge, MA', bm('systems', 'architecture', 'business', 'design'), 'priv'),
      u('us-stanford', 'Stanford University', 'Stanford', 'Stanford, CA', bm('systems', 'medicine', 'law', 'psychology', 'architecture', 'business', 'design'), 'priv'),
      u('us-berkeley', 'University of California, Berkeley', 'UC Berkeley', 'Berkeley, CA', ALL_CAREERS, 'pub'),
      u('us-cmu', 'Carnegie Mellon University', 'CMU', 'Pittsburgh, PA', bm('systems', 'psychology', 'architecture', 'business', 'design'), 'priv'),
      u('us-nyu', 'New York University', 'NYU', 'Nueva York, NY', ALL_CAREERS, 'priv'),
      u('us-umich', 'University of Michigan', 'U-Michigan', 'Ann Arbor, MI', ALL_CAREERS, 'pub'),
      u('us-gatech', 'Georgia Institute of Technology', 'Georgia Tech', 'Atlanta, GA', bm('systems', 'architecture', 'business', 'design'), 'pub'),
      u('us-utaustin', 'The University of Texas at Austin', 'UT Austin', 'Austin, TX', ALL_CAREERS, 'pub'),
      u('us-columbia', 'Columbia University', 'Columbia', 'Nueva York, NY', bm('systems', 'medicine', 'law', 'psychology', 'architecture', 'business', 'design'), 'priv'),
      u('us-harvard', 'Harvard University', 'Harvard', 'Cambridge, MA', bm('systems', 'medicine', 'law', 'psychology', 'architecture', 'business', 'design'), 'priv')
    ],
    INTL: [
      u('intl-standard', 'International Program / Plan estándar', 'INTL', 'En línea / modalidad internacional', ALL_CAREERS, 'onl'),
      u('intl-asu', 'Arizona State University (ASU Online)', 'ASU Online', 'En línea · EE.UU.', bm('systems', 'accounting', 'psychology', 'business', 'design'), 'onl'),
      u('intl-open', 'The Open University', 'Open University', 'En línea · Reino Unido', bm('systems', 'law', 'psychology', 'business', 'design'), 'onl'),
      u('intl-people', 'University of the People', 'UoPeople', 'En línea · internacional', bm('systems', 'business'), 'onl'),
      u('intl-london', 'University of London International Programmes', 'London International', 'En línea · Reino Unido', bm('law', 'accounting', 'psychology', 'business'), 'onl')
    ]
  };
  var OTHER_ID = 'other';

  /* Traducciones de nombres de materias para los planes en inglés/portugués. */
  var ALIASES = {
    en: {
      'Cálculo I': 'Calculus I', 'Álgebra Lineal': 'Linear Algebra', 'Programación I': 'Programming I',
      'Estructuras de Datos': 'Data Structures', 'Bases de Datos': 'Databases', 'Sistemas Operativos': 'Operating Systems',
      'Ingeniería de Software': 'Software Engineering', 'Redes de Computadoras': 'Computer Networks',
      'Algoritmos y Complejidad': 'Algorithms and Complexity', 'Arquitectura de Software': 'Software Architecture',
      'Inteligencia Artificial': 'Artificial Intelligence', 'Proyecto de Graduación': 'Graduation Project',
      'Anatomía I': 'Anatomy I', 'Bioquímica': 'Biochemistry', 'Histología': 'Histology', 'Fisiología': 'Physiology',
      'Patología': 'Pathology', 'Farmacología': 'Pharmacology', 'Diagnóstico Clínico': 'Clinical Diagnosis',
      'Medicina Interna': 'Internal Medicine', 'Cirugía': 'Surgery', 'Obstetricia y Ginecología': 'Obstetrics and Gynecology',
      'Pediatría': 'Pediatrics', 'Salud Pública': 'Public Health', 'Derecho Civil I': 'Civil Law I',
      'Derecho Constitucional': 'Constitutional Law', 'Teoría General del Derecho': 'Legal Theory',
      'Derecho Penal': 'Criminal Law', 'Derecho Procesal': 'Procedural Law', 'Derecho Administrativo': 'Administrative Law',
      'Derecho Comercial': 'Commercial Law', 'Derecho Laboral': 'Labor Law', 'Derecho Internacional': 'International Law',
      'Ética y Deontología': 'Ethics and Professional Conduct', 'Contabilidad I': 'Accounting I',
      'Matemática Financiera': 'Financial Mathematics', 'Microeconomía': 'Microeconomics', 'Contabilidad II': 'Accounting II',
      'Costos': 'Cost Accounting', 'Auditoría': 'Auditing', 'Tributación': 'Taxation',
      'Finanzas Corporativas': 'Corporate Finance', 'Contabilidad Avanzada': 'Advanced Accounting',
      'Macroeconomía': 'Macroeconomics', 'Trabajo de Graduación': 'Graduation Thesis',
      'Psicología General': 'General Psychology', 'Biología del Comportamiento': 'Behavioral Biology',
      'Métodos de Investigación': 'Research Methods', 'Psicología del Desarrollo': 'Developmental Psychology',
      'Psicología Social': 'Social Psychology', 'Estadística Aplicada': 'Applied Statistics',
      'Psicopatología': 'Psychopathology', 'Evaluación Psicológica': 'Psychological Assessment',
      'Psicología Cognitiva': 'Cognitive Psychology', 'Psicoterapias': 'Psychotherapy',
      'Ética Profesional': 'Professional Ethics', 'Práctica Profesional': 'Professional Practice',
      'Taller de Diseño I': 'Design Studio I', 'Geometría Descriptiva': 'Descriptive Geometry',
      'Historia de la Arquitectura': 'History of Architecture', 'Taller de Diseño II': 'Design Studio II',
      'Estructuras': 'Structures', 'Materiales de Construcción': 'Building Materials',
      'Taller de Diseño III': 'Design Studio III', 'Urbanismo': 'Urban Planning', 'Instalaciones': 'Building Services',
      'Taller de Diseño IV': 'Design Studio IV', 'Presupuestos y Gestión': 'Budgeting and Management',
      'Administración General': 'Principles of Management', 'Contabilidad Básica': 'Basic Accounting',
      'Marketing': 'Marketing', 'Recursos Humanos': 'Human Resources',
      'Matemática para Negocios': 'Business Mathematics', 'Estrategia Empresarial': 'Business Strategy',
      'Gestión de Operaciones': 'Operations Management', 'Finanzas': 'Finance',
      'Emprendimiento': 'Entrepreneurship', 'Dirección de Proyectos': 'Project Management',
      'Trabajo Final': 'Final Project', 'Lenguaje Visual': 'Visual Language', 'Dibujo Técnico': 'Technical Drawing',
      'Historia del Diseño': 'History of Design', 'Diseño Gráfico': 'Graphic Design', 'Diseño Digital': 'Digital Design',
      'Teoría del Color': 'Color Theory', 'Diseño de Producto': 'Product Design', 'Interacción y UX': 'Interaction and UX',
      'Metodologías de Diseño': 'Design Methodologies', 'Portafolio Profesional': 'Professional Portfolio',
      'Gestión de Proyectos de Diseño': 'Design Project Management',
      'Trabajo Final de Diseño': 'Final Design Project'
    },
    pt: {
      'Cálculo I': 'Cálculo I', 'Álgebra Lineal': 'Álgebra Linear', 'Programação I': 'Programação I',
      'Programación I': 'Programação I', 'Estructuras de Datos': 'Estruturas de Dados',
      'Bases de Datos': 'Banco de Dados', 'Sistemas Operativos': 'Sistemas Operacionais',
      'Ingeniería de Software': 'Engenharia de Software', 'Redes de Computadoras': 'Redes de Computadores',
      'Algoritmos y Complejidad': 'Algoritmos e Complexidade', 'Arquitectura de Software': 'Arquitetura de Software',
      'Inteligencia Artificial': 'Inteligência Artificial', 'Proyecto de Graduación': 'Projeto de Graduação',
      'Anatomía I': 'Anatomia I', 'Bioquímica': 'Bioquímica', 'Histología': 'Histologia',
      'Fisiología': 'Fisiologia', 'Patología': 'Patologia', 'Farmacología': 'Farmacologia',
      'Diagnóstico Clínico': 'Diagnóstico Clínico', 'Medicina Interna': 'Clínica Médica', 'Cirugía': 'Cirurgia',
      'Obstetricia y Ginecología': 'Obstetrícia e Ginecologia', 'Pediatría': 'Pediatria',
      'Salud Pública': 'Saúde Pública', 'Derecho Civil I': 'Direito Civil I',
      'Derecho Constitucional': 'Direito Constitucional', 'Derecho Penal': 'Direito Penal',
      'Derecho Procesal': 'Direito Processual', 'Derecho Administrativo': 'Direito Administrativo',
      'Derecho Comercial': 'Direito Comercial', 'Derecho Laboral': 'Direito do Trabalho',
      'Derecho Internacional': 'Direito Internacional', 'Contabilidad I': 'Contabilidade I',
      'Contabilidad II': 'Contabilidade II', 'Matemática Financiera': 'Matemática Financeira',
      'Microeconomía': 'Microeconomia', 'Costos': 'Custos', 'Auditoría': 'Auditoria',
      'Tributación': 'Tributação', 'Finanzas Corporativas': 'Finanças Corporativas',
      'Contabilidad Avanzada': 'Contabilidade Avançada', 'Macroeconomía': 'Macroeconomia',
      'Psicología General': 'Psicologia Geral', 'Psicología del Desarrollo': 'Psicologia do Desenvolvimento',
      'Psicología Social': 'Psicologia Social', 'Estadística Aplicada': 'Estatística Aplicada',
      'Psicopatología': 'Psicopatologia', 'Psicología Cognitiva': 'Psicologia Cognitiva',
      'Ética Profesional': 'Ética Profissional', 'Práctica Profesional': 'Estágio Profissional',
      'Geometría Descriptiva': 'Geometria Descritiva', 'Historia de la Arquitectura': 'História da Arquitetura',
      'Estructuras': 'Estruturas', 'Materiales de Construcción': 'Materiais de Construção',
      'Urbanismo': 'Urbanismo', 'Instalaciones': 'Instalações', 'Presupuestos y Gestión': 'Orçamentos e Gestão',
      'Administración General': 'Administração Geral', 'Contabilidad Básica': 'Contabilidade Básica',
      'Recursos Humanos': 'Recursos Humanos', 'Matemática para Negocios': 'Matemática para Negócios',
      'Estrategia Empresarial': 'Estratégia Empresarial', 'Gestión de Operaciones': 'Gestão de Operações',
      'Finanzas': 'Finanças', 'Emprendimiento': 'Empreendedorismo',
      'Dirección de Proyectos': 'Gestão de Projetos', 'Trabajo Final': 'Trabalho Final',
      'Lenguaje Visual': 'Linguagem Visual', 'Dibujo Técnico': 'Desenho Técnico',
      'Historia del Diseño': 'História do Design', 'Diseño Gráfico': 'Design Gráfico',
      'Diseño Digital': 'Design Digital', 'Teoría del Color': 'Teoria da Cor',
      'Diseño de Producto': 'Design de Produto', 'Interacción y UX': 'Interação e UX'
    }
  };

  /* Perfil por país: institución y título oficial por carrera. */
  function country(code, name, flag, programs, lang) {
    return { code: code, name: name, flag: flag, programs: programs, lang: lang || '' };
  }
  var COUNTRIES = [
    country('UY', 'Uruguay', '🇺🇾', {
      systems: ['Universidad Tecnológica (UTEC)', 'Ingeniería en Sistemas'],
      medicine: ['Universidad de la República', 'Doctorado en Medicina'],
      law: ['Universidad de la República', 'Abogacía'],
      accounting: ['Universidad de la República', 'Contador Público'],
      psychology: ['Universidad de la República', 'Licenciatura en Psicología'],
      architecture: ['Universidad de la República', 'Arquitectura'],
      business: ['ORT', 'Licenciatura en Administración'],
      design: ['ORT', 'Diseño de Comunicación Visual']
    }),
    country('AR', 'Argentina', '🇦🇷', {
      systems: ['UTN', 'Ingeniería en Sistemas de Información'],
      medicine: ['Universidad de Buenos Aires', 'Médico'],
      law: ['Universidad de Buenos Aires', 'Abogacía'],
      accounting: ['Universidad de Buenos Aires', 'Contador Público'],
      psychology: ['Universidad de Buenos Aires', 'Licenciatura en Psicología'],
      architecture: ['Universidad de Buenos Aires', 'Arquitectura'],
      business: ['UTN', 'Licenciatura en Administración'],
      design: ['Universidad de Buenos Aires', 'Diseño Gráfico']
    }),
    country('ES', 'España', '🇪🇸', {
      systems: ['Universidad Politécnica de Madrid', 'Grado en Ingeniería Informática'],
      medicine: ['Universidad Complutense de Madrid', 'Grado en Medicina'],
      law: ['Universidad Complutense de Madrid', 'Grado en Derecho'],
      accounting: ['Universidad de Alcalá', 'Grado en Economía'],
      psychology: ['Universidad Complutense de Madrid', 'Grado en Psicología'],
      architecture: ['Universidad Politécnica de Madrid', 'Grado en Arquitectura'],
      business: ['Universidad Complutense de Madrid', 'Grado en Administración y Dirección de Empresas'],
      design: ['Universidad Complutense de Madrid', 'Grado en Diseño']
    }),
    country('MX', 'México', '🇲🇽', {
      systems: ['Instituto Politécnico Nacional', 'Ingeniería en Sistemas Computacionales'],
      medicine: ['UNAM', 'Médico Cirujano'],
      law: ['UNAM', 'Licenciatura en Derecho'],
      accounting: ['UNAM', 'Licenciatura en Contaduría Pública'],
      psychology: ['UNAM', 'Licenciatura en Psicología'],
      architecture: ['UNAM', 'Arquitectura'],
      business: ['Tecnológico de Monterrey', 'Licenciatura en Administración'],
      design: ['Universidad Autónoma Metropolitana', 'Licenciatura en Diseño']
    }),
    country('CL', 'Chile', '🇨🇱', {
      systems: ['Universidad Técnica Federico Santa María', 'Ingeniería Civil Informática'],
      medicine: ['Universidad de Chile', 'Medicina'],
      law: ['Universidad de Chile', 'Derecho'],
      accounting: ['Universidad de Chile', 'Contador Público y Auditores'],
      psychology: ['Universidad de Chile', 'Psicología'],
      architecture: ['Universidad de Chile', 'Arquitectura'],
      business: ['Universidad de Santiago de Chile', 'Ingeniería en Administración'],
      design: ['Universidad de Chile', 'Diseño Gráfico']
    }),
    country('CO', 'Colombia', '🇨🇴', {
      systems: ['Universidad Industrial de Santander', 'Ingeniería de Sistemas'],
      medicine: ['Universidad Nacional de Colombia', 'Medicina'],
      law: ['Universidad Nacional de Colombia', 'Derecho'],
      accounting: ['Universidad Nacional de Colombia', 'Contaduría Pública'],
      psychology: ['Universidad Nacional de Colombia', 'Psicología'],
      architecture: ['Universidad Nacional de Colombia', 'Arquitectura'],
      business: ['Universidad de los Andes', 'Administración de Empresas'],
      design: ['Universidad de los Andes', 'Diseño Gráfico']
    }),
    country('BR', 'Brasil', '🇧🇷', {
      systems: ['Universidade de São Paulo', 'Engenharia de Computação'],
      medicine: ['Universidade de São Paulo', 'Medicina'],
      law: ['Universidade de São Paulo', 'Direito'],
      accounting: ['Universidade Federal de Minas Gerais', 'Ciências Contábeis'],
      psychology: ['Universidade de São Paulo', 'Psicologia'],
      architecture: ['Universidade de São Paulo', 'Arquitetura e Urbanismo'],
      business: ['Fundação Getulio Vargas', 'Administração de Empresas'],
      design: ['Universidade de São Paulo', 'Design Gráfico']
    }, 'pt'),
    country('US', 'Estados Unidos', '🇺🇸', {
      systems: ['State University', 'B.S. in Computer Science'],
      medicine: ['State University', 'M.D. Program'],
      law: ['State University', 'J.D. Program'],
      accounting: ['State University', 'B.S. in Accounting'],
      psychology: ['State University', 'B.A. in Psychology'],
      architecture: ['State University', 'Bachelor of Architecture'],
      business: ['State University', 'B.S. in Business Administration'],
      design: ['State University', 'B.F.A. in Design']
    }, 'en'),
    country('INTL', 'Internacional', '🌐', {
      systems: ['International Program', 'Computer Science'],
      medicine: ['International Program', 'Medicine'],
      law: ['International Program', 'Law'],
      accounting: ['International Program', 'Accounting and Economics'],
      psychology: ['International Program', 'Psychology'],
      architecture: ['International Program', 'Architecture'],
      business: ['International Program', 'Business Administration'],
      design: ['International Program', 'Design']
    }, 'en')
  ];

  /* Carreras con plan semestral: cada año se divide en dos semestres. */
  var SEMESTER_CAREERS = { systems: true, business: true, design: true };

  var BY_CODE = {};
  COUNTRIES.forEach(function (c) { BY_CODE[c.code] = c; });

  function findCountry(code) { return BY_CODE[String(code || '').toUpperCase()] || BY_CODE.INTL; }
  function known(code) {
    var c = String(code || '').toUpperCase();
    return c !== 'INTL' && !!BY_CODE[c];
  }
  function countries() { return COUNTRIES.slice(); }

  function careerLabel(id) { return L(CAREER_LABELS[id] || 'curriculum.career.systems'); }
  function careers(code) {
    var c = findCountry(code);
    return CAREER_IDS.map(function (id) {
      var info = c.programs[id] || ['International Program', careerLabel(id)];
      return { id: id, label: careerLabel(id), institution: info[0], title: info[1] };
    });
  }
  function career(code, id) {
    var found = careers(code).filter(function (x) { return x.id === id; })[0];
    return found || careers(code)[0];
  }

  function otherInstitution() {
    return {
      id: OTHER_ID, name: L('curriculum.institution.other'), sigla: '—',
      sede: L('curriculum.institution.otherSede'), mask: ALL_CAREERS,
      kind: 'other'
    };
  }

  /* Universidades del país que efectivamente dictan la carrera elegida. */
  function institutions(code, careerId) {
    var bit = BIT[careerId] || BIT.systems;
    var cc = findCountry(code);
    var pool = INSTITUTIONS[cc.code] || INSTITUTIONS.INTL || [];
    var out = pool.filter(function (x) { return (x.mask & bit) === bit; }).map(function (x) {
      return Object.assign({}, x);
    });
    out.push(otherInstitution());
    return out;
  }
  function institution(code, careerId, id) {
    var list = institutions(code, careerId);
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return list[0];
  }

  function periodLabel(period) {
    if (period.term === 's1' || period.term === 's2') {
      return L('curriculum.semester', { n: period.term === 's1' ? 1 : 2 }) + ' · ' + L('curriculum.year', { n: period.year });
    }
    return L('curriculum.year', { n: period.year });
  }

  function mapNames(c, subjects) {
    var dict = ALIASES[c.lang] || null;
    if (!dict) return subjects.map(function (x) { return x; });
    return subjects.map(function (x) { return dict[x.name] || x.name; });
  }

  /* Devuelve los períodos del plan oficial con materias listas para importar
     (nombres aplicados por país, copias frescas para no mutar la base). Todas
     las instituciones comparten el mismo plan de la carrera seleccionada. */
  function periods(code, careerId) {
    var c = findCountry(code);
    var base = PLANS[careerId] || PLANS.systems;
    var alias = ALIASES[c.lang] || {};
    var mapped = function (x) {
      return { name: alias[x.name] || x.name, hours: x.hours, color: x.color, units: x.units.slice() };
    };
    if (SEMESTER_CAREERS[careerId]) {
      var semesters = [];
      base.forEach(function (period) {
        semesters.push({
          id: 'y' + period.year + '-s1', year: period.year, term: 's1',
          label: periodLabel({ year: period.year, term: 's1' }),
          subjects: period.subjects.slice(0, 2).map(mapped)
        });
        semesters.push({
          id: 'y' + period.year + '-s2', year: period.year, term: 's2',
          label: periodLabel({ year: period.year, term: 's2' }),
          subjects: period.subjects.slice(2).map(mapped)
        });
      });
      return semesters;
    }
    return base.map(function (period) {
      return {
        id: period.id,
        year: period.year,
        term: period.term,
        label: periodLabel(period),
        subjects: period.subjects.map(mapped)
      };
    });
  }
  function allSubjects(code, careerId) {
    var out = [];
    periods(code, careerId).forEach(function (p) {
      p.subjects.forEach(function (x) { out.push(Object.assign({}, x, { period: p.label, periodId: p.id })); });
    });
    return out;
  }

  /* ---- Detección ligera de país (IP con respaldo por idioma) ---- */

  function localeCode(lang) {
    var parts = String(lang || '').toLowerCase().replace(/_/g, '-').split('-');
    for (var i = parts.length - 1; i >= 1; i--) {
      if (/^[a-z]{2}$/.test(parts[i]) && known(parts[i])) return parts[i].toUpperCase();
    }
    var primary = parts[0] || '';
    if (primary === 'es') return 'ES';
    if (primary === 'pt') return 'BR';
    if (primary === 'en') return 'US';
    return 'INTL';
  }

  function cacheRead() {
    try {
      var raw = localStorage.getItem(COUNTRY_KEY);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (!o || !o.code) return null;
      return { code: findCountry(o.code).code, raw: String(o.code), source: String(o.source || 'manual'), at: o.at || null };
    } catch (e) { return null; }
  }
  function cacheWrite(code, source, raw) {
    var value = { code: findCountry(code).code, raw: String(raw || code), source: source, at: new Date().toISOString() };
    try { localStorage.setItem(COUNTRY_KEY, JSON.stringify(value)); } catch (e) {}
    return value;
  }
  function clearCache() { try { localStorage.removeItem(COUNTRY_KEY); } catch (e) {} }

  function fetchJSON(url, signal) {
    return fetch(url, { signal: signal, credentials: 'omit', cache: 'no-store', headers: { 'Accept': 'application/json' } })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  }

  /* Consulta ipwho.is y, si falla, ipapi.co. Un solo AbortController de 2500 ms.
     Sin internet devuelve de inmediato el respaldo por navigator.language. */
  function detectCountry(options) {
    options = options || {};
    var cached = cacheRead();
    if (cached && !options.force) return Promise.resolve(cached);

    var fallback = localeCode(options.lang || navigator.language || (navigator.userLanguage || ''));
    if (options.forceOffline || (typeof navigator.onLine === 'boolean' && !navigator.onLine)) {
      return Promise.resolve(cacheWrite(fallback, 'locale-offline'));
    }
    if (typeof fetch !== 'function') return Promise.resolve(cacheWrite(fallback, 'locale-offline'));

    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var signal = controller ? controller.signal : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, 2500) : null;
    var done = false;

    function finish(result) {
      if (done) return result;
      done = true;
      if (timer) clearTimeout(timer);
      return result;
    }

    return fetchJSON('https://ipwho.is/', signal)
      .then(function (data) {
        var code = data && (data.country_code || (data.country && data.country.code));
        if (!code) throw new Error('sin código');
        return finish(cacheWrite(findCountry(code).code, data.success === false ? 'locale' : 'ip', code));
      })
      .catch(function () {
        return fetchJSON('https://ipapi.co/json/', signal)
          .then(function (data) {
            var code = data && (data.country_code || data.country);
            if (!code) throw new Error('sin código');
            return finish(cacheWrite(findCountry(code).code, 'ip', code));
          })
          .catch(function () { return finish(cacheWrite(fallback, 'locale')); });
      });
  }

  window.SFCurricula = {
    VERSION: '1.0.5',
    COUNTRY_KEY: COUNTRY_KEY,
    COUNTRIES: COUNTRIES,
    CAREER_IDS: CAREER_IDS,
    COLORS: COLORS,
    countries: countries,
    country: findCountry,
    known: known,
    careers: careers,
    career: career,
    careerLabel: careerLabel,
    institutions: institutions,
    institution: institution,
    periods: periods,
    periodLabel: periodLabel,
    allSubjects: allSubjects,
    localeCode: localeCode,
    detectCountry: detectCountry,
    cachedCountry: cacheRead,
    setCountry: function (code) { return cacheWrite(findCountry(code).code, 'manual'); },
    clearCache: clearCache
  };
})();
