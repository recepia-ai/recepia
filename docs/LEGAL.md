# RECEPIA — LEGAL.md (Marco legal mínimo)

> Documento legal de base para arrancar el piloto. Versión 0.1 — junio 2026.
>
> Cubre lo imprescindible para tratar datos reales del Dr. Patino con responsabilidad. **No sustituye asesoramiento jurídico profesional**. Antes de comercializar Recepia a clientes de pago, este documento debe ser revisado por un abogado especialista en RGPD y EU AI Act.

---

## ⚠️ Disclaimer importante

1. **Marc / Claude no son abogados.** Este documento es un punto de partida realista y razonado, no un dictamen jurídico.
2. **Antes de la primera venta comercial**, contratar revisión por abogado especialista (RGPD + EU AI Act) en España. Coste estimado: 800–2.000 €. Es una inversión, no un gasto.
3. **Para el piloto del Dr. Patino**: este documento es suficiente si se firma el Acuerdo de Encargo de Tratamiento (DPA) y se aplican los avisos al cliente final. El piloto se desarrolla bajo una relación contractual clara y con un volumen pequeño de datos personales no sensibles.
4. **Datos de salud animal NO son "datos de salud" en sentido estricto del RGPD** (el RGPD protege datos personales de personas físicas). Los datos sensibles son los del propietario humano: nombre, teléfono, email, y eventualmente identificadores.

---

## 1. Marco legal aplicable

| Norma | Aplica a Recepia | Razón |
|---|---|---|
| **RGPD** — Reglamento (UE) 2016/679 | Sí | Tratamos datos personales de propietarios de mascotas. |
| **LOPDGDD** — Ley Orgánica 3/2018 española | Sí | Complementa el RGPD. AEPD como autoridad de control. |
| **LSSI-CE** — Ley 34/2002 | Sí (parcial) | Aplica al sitio web público de Recepia y al envío de comunicaciones electrónicas. |
| **EU AI Act** — Reglamento (UE) 2024/1689 | Sí (parcial) | Recepia es un sistema de IA que interactúa con personas. Obligaciones de transparencia. |
| **Directiva ePrivacy** y normativa de cookies | Sí | Para el panel web (cookies técnicas) y, en el futuro, sitio comercial. |
| **Ley General de Sanidad Animal** (Ley 8/2003) | No directamente | Aplica a la clínica veterinaria, no al SaaS. Recepia no presta servicios sanitarios. |

### 1.1 Autoridades de referencia

- **AEPD** (España) — Agencia Española de Protección de Datos. Notificaciones de brecha, registro de actividades, consultas.
- **CEPD** (UE) — Comité Europeo de Protección de Datos.
- **EU AI Office** — autoridad central del AI Act (operativa desde 2025).
- **AESIA** (España) — Agencia Española de Supervisión de la Inteligencia Artificial.

---

## 2. Roles y responsabilidades

### 2.1 Sobre quién es quién

| Actor | Rol RGPD | Rol AI Act |
|---|---|---|
| **Marc SR / sociedad futura titular de Recepia** | Encargado del Tratamiento (art. 28 RGPD) | **Proveedor** del sistema de IA (art. 3 AI Act) |
| **Hospital Veterinario Dr. Patino** (y futuras clínicas) | Responsable del Tratamiento (art. 4 RGPD) | **Responsable del despliegue** (deployer) del sistema |
| **Cliente final** (propietario de la mascota) | Interesado (art. 4.1 RGPD) | Persona afectada (art. 50 AI Act) |

### 2.2 Implicación práctica

- **La clínica decide** qué datos se recogen, para qué, y a quién se comunican. Su política de privacidad gobierna la relación con su cliente.
- **Recepia ejecuta** el tratamiento en nombre de la clínica. No puede usar los datos para fines propios sin consentimiento adicional explícito.
- **El cliente final** ejerce sus derechos ARSULIPO contra la clínica (que es Responsable). Recepia le ayuda a la clínica a atenderlos.

Cualquier uso de los datos por parte de Recepia más allá de la prestación del servicio (entrenamiento de modelos, mejora del producto con datos agregados, casos comerciales) requiere autorización expresa en el DPA.

---

## 3. Categorías de datos tratados

| Categoría | Ejemplos | Sensibilidad | Origen |
|---|---|---|---|
| Datos identificativos del propietario | Nombre, teléfono, email | Estándar | El cliente al comunicarse con la clínica |
| Datos relativos a la mascota | Nombre, especie, raza, observaciones | No es dato personal RGPD (es animal), pero unido al propietario forma una "ficha" | Mismo origen |
| Contenido de las conversaciones | Mensajes de WhatsApp, transcripciones de llamadas | Puede incluir info incidental sensible (mención de enfermedad humana, ubicación, etc.) | Mismo origen |
| Grabaciones de audio (Iteración 2) | Audio de la llamada | Datos de voz — biométricos en sentido amplio | Mismo origen |
| Metadatos técnicos | IP, user agent, logs de tool calls | Estándar | Logs del sistema |
| Datos de los usuarios del panel | Email del personal de la clínica, rol, sesiones | Estándar | Alta del personal por el admin de la clínica |

**Datos especialmente protegidos (art. 9 RGPD):** Recepia **no** trata datos de categoría especial (salud humana, origen racial, religión, biometría con fines de identificación, etc.) de forma deliberada. Si aparecen incidentalmente en conversaciones (ej. el cliente menciona estar enfermo), se aplican medidas de minimización: no se etiquetan ni se indexan específicamente.

---

## 4. Bases jurídicas del tratamiento

Para cada tratamiento, identificar base jurídica del art. 6 RGPD:

| Tratamiento | Base jurídica | Comentario |
|---|---|---|
| Atender al cliente vía WhatsApp/teléfono | Ejecución de contrato (art. 6.1.b) | El cliente contacta para gestionar un servicio veterinario. |
| Crear ficha de cliente y mascota | Ejecución de contrato (art. 6.1.b) | Necesario para prestar el servicio. |
| Grabar llamadas con fines de calidad (Iter. 2) | Interés legítimo (art. 6.1.f) + consentimiento informado al inicio | Doble base para refuerzo. |
| Transcripción y resumen automático | Ejecución de contrato + interés legítimo | Fines operativos legítimos. |
| Conservación de historial | Ejecución de contrato + obligación legal | Plazos configurables. |
| Envío de comunicaciones comerciales (futuro) | Consentimiento (art. 6.1.a) | Opt-in explícito. |

---

## 5. Acuerdo de Encargo de Tratamiento (DPA)

Este es el contrato entre Recepia (Encargado) y la clínica (Responsable). **Es obligatorio firmarlo antes de tratar datos reales.**

### 5.1 Modelo de DPA

```
====================================================================
ACUERDO DE ENCARGO DE TRATAMIENTO DE DATOS PERSONALES
====================================================================

Entre:
  [NOMBRE / RAZÓN SOCIAL DE LA CLÍNICA], con NIF [NIF],
  domicilio en [DIRECCIÓN], representada por [REPRESENTANTE]
  (en adelante, "el Responsable"),

y:
  [Marc SR — autónomo o sociedad titular de Recepia], con NIF [NIF],
  domicilio en [DIRECCIÓN]
  (en adelante, "el Encargado").

EXPONEN:

I. Que el Responsable ha contratado al Encargado la prestación del
   servicio Recepia (recepción virtual veterinaria con inteligencia
   artificial), que implica el tratamiento de datos personales de
   los clientes del Responsable.

II. Que el presente acuerdo se firma en cumplimiento del artículo 28
    del Reglamento (UE) 2016/679 (RGPD).

ACUERDAN:

1. OBJETO
   El Encargado tratará datos personales por cuenta del Responsable
   con la única finalidad de prestar el servicio Recepia, conforme a
   las instrucciones documentadas del Responsable.

2. CATEGORÍAS DE DATOS Y DE INTERESADOS
   - Datos: identificativos (nombre, teléfono, email), contenido de
     comunicaciones (WhatsApp, llamadas), información sobre mascotas
     (nombre, especie, observaciones), citas y agenda.
   - Interesados: clientes del Responsable y sus mascotas.

3. DURACIÓN
   Mientras se mantenga vigente la relación contractual entre las
   partes para la prestación del servicio Recepia.

4. NATURALEZA Y FINALIDAD DEL TRATAMIENTO
   Atención automatizada de comunicaciones entrantes, gestión de
   citas, generación de transcripciones y resúmenes, mantenimiento
   de historial de clientes, soporte al personal del Responsable.

5. OBLIGACIONES DEL ENCARGADO
   El Encargado se obliga a:
   a) Tratar los datos exclusivamente conforme a las instrucciones
      documentadas del Responsable.
   b) Garantizar la confidencialidad de las personas autorizadas
      al tratamiento.
   c) Adoptar todas las medidas técnicas y organizativas necesarias
      conforme al artículo 32 del RGPD: cifrado en reposo y tránsito,
      control de accesos por roles, registro de actividades, pruebas
      periódicas, capacidad de restaurar disponibilidad y acceso.
   d) Asistir al Responsable en el cumplimiento de sus obligaciones
      respecto al ejercicio de derechos por parte de los interesados.
   e) Notificar al Responsable cualquier violación de seguridad sin
      dilación indebida y en todo caso dentro de las 24 horas
      siguientes a tener conocimiento de la misma.
   f) Eliminar o devolver al Responsable todos los datos personales
      al finalizar el contrato, salvo que la conservación venga
      exigida por ley.
   g) Permitir y contribuir a auditorías por parte del Responsable
      o de un tercero designado por éste.

6. SUBENCARGADOS
   El Encargado utiliza los siguientes subencargados:
   - Supabase (Supabase Inc.) — alojamiento, base de datos.
     Ubicación: UE (región Frankfurt o Dublín).
   - Vercel Inc. — alojamiento del panel web. Cláusulas tipo de la UE.
   - Anthropic PBC — procesamiento por modelo LLM (Claude).
     Cláusulas tipo de la UE.
   - DeepSeek — procesamiento por modelo LLM para tareas batch.
   - 360dialog GmbH — proveedor BSP de WhatsApp Business. Ubicación: UE.
   - Google LLC (Google Calendar) — integración de agenda. Cláusulas
     tipo de la UE.
   - Doppler — gestión de secretos.
   - Sentry, PostHog — observabilidad y analítica (datos masked).
   - [Iteración 2] Vapi.ai, Cartesia, ElevenLabs, Twilio para
     funcionalidad de telefonía.

   El Encargado informará al Responsable de cualquier cambio en los
   subencargados con al menos 30 días de antelación, dando opción a
   oponerse motivadamente.

7. TRANSFERENCIAS INTERNACIONALES
   Los datos se procesan principalmente en la UE. Cuando interviene
   un subencargado fuera del Espacio Económico Europeo (caso de
   Anthropic, Vercel, Google, etc.), las transferencias se amparan en
   Cláusulas Contractuales Tipo aprobadas por la Comisión Europea, o
   en decisiones de adecuación cuando proceda.

8. RESPONSABILIDAD
   Cada parte responde frente a los interesados por los incumplimientos
   que le sean imputables, conforme al artículo 82 del RGPD.

9. ANEXO TÉCNICO Y DE SEGURIDAD
   Las medidas técnicas concretas se detallan en el Anexo I, que forma
   parte integrante del presente Acuerdo.

10. LEY APLICABLE Y JURISDICCIÓN
    Este Acuerdo se rige por la ley española. Para cualquier disputa,
    las partes se someten a los tribunales del domicilio del
    Responsable.

Firmado en [LUGAR], a [FECHA].

Por el Responsable:                Por el Encargado:
[Firma + Nombre]                   [Firma + Nombre]
```

### 5.2 Anexo I — Medidas técnicas y organizativas

A acompañar al DPA. Contenido mínimo:

```
ANEXO I — MEDIDAS TÉCNICAS Y ORGANIZATIVAS

1. CONTROL DE ACCESO
   - Autenticación obligatoria para acceder al panel (Magic Link).
   - Roles diferenciados: admin, recepción, veterinario.
   - Row-Level Security en base de datos por clínica.

2. CIFRADO
   - En reposo: cifrado nativo de PostgreSQL en Supabase (AES-256).
   - En tránsito: TLS 1.2+ en todas las comunicaciones.
   - Secretos: gestión centralizada en Doppler.

3. AUDITORÍA
   - Tabla `tool_invocations` registra cada acción del agente.
   - Tabla `events` registra eventos de negocio.
   - Tabla `clinic_config_history` registra cambios de configuración.

4. COPIAS DE SEGURIDAD
   - Backups automáticos diarios por Supabase.
   - Point-in-Time Recovery activado en producción.

5. PSEUDONIMIZACIÓN Y MINIMIZACIÓN
   - Logs aplicacionales no contienen contenido de mensajes.
   - Sentry y PostHog reciben datos enmascarados.

6. PRUEBAS Y REVISIONES
   - Revisión trimestral de accesos.
   - Pruebas anuales de restauración de copia.

7. FORMACIÓN
   - Personal del Encargado (Marc) recibe formación básica en RGPD.
   - Personal del Responsable (clínica) es formado por el Encargado
     en el uso seguro del panel.

8. INCIDENTES
   - Notificación al Responsable en < 24 horas.
   - Análisis forense documentado.
   - Comunicación a AEPD coordinada con el Responsable cuando proceda.

9. ELIMINACIÓN DE DATOS
   - A petición del Responsable: borrado en < 30 días naturales.
   - Periodo de retención configurable por clínica (defaults: mensajes
     365 días, grabaciones 90 días, resúmenes 730 días).
```

### 5.3 Cómo se firma

Para el piloto, suficiente:
- PDF generado a partir del modelo anterior.
- Firma electrónica simple (Signaturit, Adobe Sign, o intercambio firmado por email con DKIM).
- Una copia para cada parte.

---

## 6. Política de Privacidad de Recepia

Texto público que vivirá en `https://[dominio]/privacidad`. Modelo base:

```
====================================================================
POLÍTICA DE PRIVACIDAD DE RECEPIA
Última actualización: [FECHA]
====================================================================

1. RESPONSABLE
   Esta política rige el uso del sitio web y los servicios prestados
   directamente por Recepia, titularidad de [Marc SR / sociedad], con
   NIF [NIF] y domicilio en [DIRECCIÓN].

   Email de contacto en materia de privacidad: privacidad@recepia.com
   [o el dominio que se elija]

2. CARÁCTER DE LA INFORMACIÓN
   Recepia presta servicios de recepción virtual a clínicas veterinarias.
   Cuando un cliente final (propietario de una mascota) interactúa con
   Recepia (vía WhatsApp, teléfono o cualquier canal), Recepia actúa
   como Encargado del Tratamiento por cuenta de la clínica, que es la
   Responsable. En esos casos, la política de privacidad aplicable es
   la de la clínica, sin perjuicio del cumplimiento por nuestra parte
   del Acuerdo de Encargo de Tratamiento.

3. DATOS QUE TRATAMOS DIRECTAMENTE
   - Como prestador de servicio a las clínicas, tratamos por cuenta
     de éstas los datos descritos en el Acuerdo de Encargo.
   - Como titulares del sitio web recepia.com, tratamos los datos que
     nos facilitan empresas o profesionales interesados en nuestros
     servicios (email de contacto, datos de la empresa).

4. FINALIDADES
   - Prestación del servicio Recepia a las clínicas contratantes.
   - Atención de consultas comerciales.
   - Cumplimiento de obligaciones legales.

5. BASE JURÍDICA
   - Ejecución del contrato con la clínica.
   - Interés legítimo en la atención a leads comerciales.
   - Consentimiento para comunicaciones comerciales.

6. DESTINATARIOS
   No cedemos datos a terceros, salvo:
   - Proveedores que actúan como sub-encargados, listados en nuestro
     Acuerdo de Encargo de Tratamiento.
   - Autoridades competentes cuando exista obligación legal.

7. TRANSFERENCIAS INTERNACIONALES
   Algunos proveedores tecnológicos están ubicados fuera del Espacio
   Económico Europeo. Estas transferencias se amparan en Cláusulas
   Contractuales Tipo de la Comisión Europea o en decisiones de
   adecuación.

8. PLAZOS DE CONSERVACIÓN
   - Datos de leads comerciales: 2 años desde el último contacto.
   - Datos tratados por cuenta de clínicas: conforme al periodo de
     retención configurado por cada clínica (por defecto, mensajes
     365 días, grabaciones 90 días, resúmenes 730 días).
   - Datos contables: conforme a la normativa fiscal aplicable.

9. DERECHOS DEL INTERESADO
   Puedes ejercer en cualquier momento los derechos de:
   - Acceso
   - Rectificación
   - Supresión
   - Oposición
   - Limitación del tratamiento
   - Portabilidad
   - No ser objeto de decisiones automatizadas con efectos jurídicos

   Para los datos tratados por nosotros como Responsable, dirígete a
   privacidad@recepia.com.

   Para datos tratados por nosotros como Encargado por cuenta de una
   clínica, dirígete a la clínica titular de tu ficha. Te asistiremos
   a ellos en la atención.

   Tienes también derecho a presentar reclamación ante la Agencia
   Española de Protección de Datos (www.aepd.es).

10. USO DE INTELIGENCIA ARTIFICIAL
    Recepia es un sistema de inteligencia artificial conversacional.
    Cuando interactúes con Recepia, te lo indicaremos de forma clara
    al inicio. Puedes en cualquier momento solicitar hablar con una
    persona del equipo de la clínica.

    No tomamos decisiones automatizadas con efectos jurídicos sobre
    los interesados. La clasificación de urgencia que realizamos es
    un soporte al personal, no una decisión clínica automatizada.

11. SEGURIDAD
    Aplicamos medidas técnicas y organizativas adecuadas para proteger
    los datos personales que tratamos: cifrado en reposo y en tránsito,
    control de accesos, auditoría continua y formación del personal.

12. MODIFICACIONES
    Esta política puede actualizarse. La versión vigente es siempre la
    publicada en este sitio. Comunicaremos cambios sustanciales con
    antelación razonable.
```

---

## 7. Avisos al cliente final

### 7.1 Primer mensaje de WhatsApp (texto consentimiento informativo)

Configurado en `clinic_config.policies.consent.whatsapp_first_message`. Texto para el Dr. Patino:

> "Te atiende Recepia, asistente virtual del Hospital Veterinario Dr. Patino. Tus datos se tratan conforme a nuestra política de privacidad. Si tienes cualquier duda, puedes pedir hablar con una persona del equipo en cualquier momento."

Este aviso cumple con:
- **AI Act art. 50**: transparencia sobre interacción con IA.
- **RGPD art. 13**: información básica al interesado en el primer contacto.

Recomendación: incluir un link a la política de privacidad de la clínica (no la de Recepia), cuando esté disponible. Puede ser un acortador del estilo `bit.ly/dr-patino-privacidad`.

### 7.2 Aviso de grabación de llamada (Iteración 2)

Configurado en `clinic_config.policies.consent.call_recording_message`. Texto base:

> "Esta llamada será atendida por Recepia, asistente virtual del Hospital Veterinario Dr. Patino, y puede ser grabada para mejorar el servicio. Si prefieres hablar con una persona, dilo en cualquier momento."

Requisitos legales que cumple:
- **LOPDGDD art. 11**: información transparente al inicio del tratamiento.
- **Consentimiento informado**: si el cliente continúa la conversación tras este aviso, presta consentimiento implícito. Para tratamientos sensibles, el agente debe ofrecer alternativa (transferir a humano).

### 7.3 Importante: derecho a rechazar IA y hablar con humano

En toda conversación, ante una petición explícita del cliente del tipo "quiero hablar con una persona" o "no quiero hablar con una IA", el agente **debe** transferir inmediatamente, sin negociar ni intentar resolver primero. Esto está hardcodeado en el trigger `explicit_request` de las reglas de transferencia (AGENT.md §6).

---

## 8. Cookies del panel

El panel `recepia.iatope.com` (y futuro `panel.recepia.com`) usa cookies:

| Cookie | Propósito | Tipo | Base jurídica |
|---|---|---|---|
| `sb-*` (Supabase) | Sesión autenticada | Técnica esencial | No requiere consentimiento |
| `__cf_*` (Cloudflare, si aplica) | Seguridad y rendimiento | Técnica esencial | No requiere consentimiento |

**No** se usan cookies de tracking, analítica externa con identificadores personales, ni publicidad. PostHog se configura en modo "anónimo" para el panel.

Como no hay cookies no esenciales, **no es necesario un banner de consentimiento** en el panel. Si en el futuro Recepia incorpora un sitio comercial público con analítica avanzada o píxeles publicitarios, sí lo necesitará.

---

## 9. Política de retención

Configurable por clínica en `clinic_config.data_retention`. Valores por defecto para el Dr. Patino:

| Dato | Plazo | Justificación |
|---|---|---|
| Mensajes (texto) | 365 días | Útil para continuidad de atención, historial veterinario administrativo |
| Grabaciones de audio | 90 días | Conservación corta por sensibilidad; suficiente para auditorías de calidad |
| Resúmenes IA | 730 días | Pueden ser útiles para historial de mascota a más largo plazo |
| Citas | Sin plazo (mientras dure la relación) | Histórico de servicio prestado |
| Datos de cliente y mascota | Sin plazo (mientras dure la relación) | Ficha continua |
| Logs técnicos (`events`, `tool_invocations`) | 180 días | Suficiente para depuración y auditoría |

**Borrado automático**: implementar como tarea programada (cron job en n8n o Edge Function programada) que recorre tablas y aplica soft delete o purga física según el caso. Tarea diferida a Iteración 1.5 / 2; durante el piloto, el volumen es bajo y la retención se cumple con tareas manuales periódicas.

---

## 10. Derechos del interesado (ARSULIPO)

| Derecho | Cómo se atiende en Recepia |
|---|---|
| **A**cceso | El cliente solicita a la clínica copia de su ficha. La clínica usa el panel para exportar. |
| **R**ectificación | El cliente solicita a la clínica. Personal edita ficha desde el panel. |
| **S**upresión | A petición del cliente, soft delete inmediato + borrado físico a los 30 días. |
| **O**posición | Caso por caso según base jurídica. |
| **L**imitación | Estado `archived` en el cliente; sus datos se conservan pero no se procesan activamente. |
| **P**ortabilidad | Exportación JSON estructurado desde el panel. Funcionalidad a implementar en Iteración 1.5. |
| **N**o ser objeto de decisiones automatizadas (art. 22) | Recepia no toma decisiones con efectos jurídicos. La clasificación de urgencia es asistencia, no decisión. Cliente puede pedir hablar con humano en cualquier momento. |

### 10.1 Canal de ejercicio

El cliente final ejerce derechos contra la clínica, no contra Recepia. Recomendación al Dr. Patino: usar `info@drpatino.es` (o el email institucional) con asunto "Protección de datos". Recepia da soporte técnico para cumplir.

### 10.2 Plazos legales

- 1 mes para responder (prorrogable 2 meses adicionales en casos complejos, comunicándolo al interesado).
- Gratuito salvo en casos manifiestamente infundados o excesivos.

---

## 11. Brechas de seguridad

### 11.1 Definición

Cualquier incidente que afecte a confidencialidad, integridad o disponibilidad de datos personales: acceso no autorizado, pérdida, alteración, fuga, ransomware, exposición pública, etc.

### 11.2 Protocolo (de obligado cumplimiento interno)

```
T+0h    DETECCIÓN
        Marc o cualquier persona del equipo detecta o sospecha incidente.
        Aplicar contención inmediata: revocar accesos, rotar secretos,
        cortar tráfico si procede.

T+0-2h  EVALUACIÓN INICIAL
        ¿Hay datos personales afectados? ¿Cuántos interesados?
        ¿Qué categorías de datos? ¿Riesgo para los interesados?
        Documentar en un incidente con timestamp y evidencias.

T+2-24h NOTIFICACIÓN AL RESPONSABLE
        Marc (Encargado) notifica al Responsable (cada clínica afectada)
        sin dilación indebida y en todo caso < 24h. Email con asunto
        "[INCIDENTE SEGURIDAD] [Clínica]" + descripción + medidas
        adoptadas + impacto estimado.

T+24-72h EVALUACIÓN DE RIESGO
        El Responsable, asistido por el Encargado, decide:
        - Si hay riesgo para los derechos y libertades: notificar a
          AEPD en < 72h desde T+0 (formulario electrónico en sede AEPD).
        - Si hay riesgo ALTO: notificar también a los interesados
          afectados sin dilación indebida.

T+72h+   SEGUIMIENTO
        Análisis post-mortem documentado.
        Medidas correctivas implementadas y registradas.
        Actualización del registro de actividades.
```

### 11.3 Registro de incidentes

Todo incidente, notificado o no, queda registrado en un documento interno (`docs/incidents/YYYY-MM-DD-slug.md`) con: descripción, causa raíz, datos afectados, medidas adoptadas, lecciones.

### 11.4 Tabla de contactos de emergencia

```
Responsable / clínica:  [contacto principal del Dr. Patino]
AEPD - notificación:    https://sedeagpd.gob.es
Soporte Supabase:       support@supabase.com
Soporte Vercel:         security@vercel.com
Soporte 360dialog:      [proveer al alta]
```

Mantener actualizada en `docs/INCIDENT_CONTACTS.md`.

---

## 12. EU AI Act — Análisis y obligaciones

### 12.1 Clasificación de Recepia

Recepia es:

- **Sistema de IA de propósito limitado** (no es modelo fundacional).
- **No es de alto riesgo** según el Anexo III del AI Act:
  - No actúa en infraestructuras críticas.
  - No determina acceso a educación.
  - No selecciona candidatos a empleo.
  - No es triaje médico humano (es atención cliente veterinaria).
  - No actúa en aplicación de la ley.
  - No biométrica con fines de identificación.
- **Sí es un sistema interactivo con personas físicas**, lo que activa obligaciones de **transparencia** del **artículo 50**.
- **Iteración 2 introduce voz**: el output de voz sintetizada activa el artículo 50.4 (deepfake-like content), obligando a informar.

### 12.2 Obligaciones aplicables a Recepia

| Obligación | Cómo se cumple |
|---|---|
| Transparencia ante el usuario que interactúa con IA (art. 50.1) | Mensaje inicial en cada conversación: "soy Recepia, asistente virtual..." |
| Marcado de contenido sintético (art. 50.2) | En audio (Iter. 2): aviso al inicio de la llamada. |
| Información sobre uso de IA en deepfakes y voces (art. 50.4) | Idem. |
| Documentación técnica del sistema | Este conjunto de documentos + arquitectura + datasets de evaluación |
| Política interna de calidad y supervisión | Modo supervisado, revisión semanal, evaluación con dataset golden |
| Logging de operaciones | Tablas `tool_invocations` y `events` |

### 12.3 Si en el futuro Recepia se usara en contextos de alto riesgo

Algunas clínicas grandes podrían querer usar Recepia para triaje de urgencias con efectos clínicos (poco probable pero no imposible). En ese escenario, Recepia podría caer en categorías de alto riesgo del AI Act, lo que añadiría:
- Gestión de riesgo formal y continua.
- Calidad de datos del entrenamiento.
- Documentación técnica exhaustiva.
- Supervisión humana significativa.
- Robustez y ciberseguridad reforzadas.
- Certificación CE en algunos casos.

Para Iteración 1, 2 y 3 (atención veterinaria estándar), esto no aplica. Pero conviene tenerlo en el radar.

---

## 13. DPIA ligera (Evaluación de Impacto)

### 13.1 ¿Es obligatoria?

El RGPD (art. 35) obliga a DPIA cuando el tratamiento conlleve "alto riesgo" para los derechos y libertades. La AEPD ha publicado listas orientativas. Recepia, en el caso del Dr. Patino:

- ✅ Tratamiento automatizado con perfilado: clasificación de urgencia → leve indicio.
- ✅ Uso de IA / nueva tecnología → indicio.
- ❌ Datos de categoría especial a gran escala → NO.
- ❌ Tratamiento sistemático de espacios públicos → NO.
- ❌ Evaluación o puntuación de personas con efectos → NO.

**Conclusión**: DPIA no es obligatoria, pero se recomienda hacer una versión ligera por buena práctica y accountability (art. 5.2 RGPD).

### 13.2 Estructura ligera

```
DPIA LIGERA — RECEPIA, PILOTO DR. PATINO

1. Descripción del tratamiento
   - Servicio Recepia atiende WhatsApp del Hospital Dr. Patino.
   - Datos del propietario (nombre, teléfono, email) y mascota.
   - Generación de transcripciones, resúmenes, citas.

2. Finalidades y bases jurídicas
   - Ejecución del contrato cliente-clínica (art. 6.1.b RGPD).
   - Interés legítimo en grabación para calidad (Iter. 2).

3. Necesidad y proporcionalidad
   - Los datos tratados son mínimos para la finalidad: nombre y
     teléfono para identificar, datos de la mascota para la consulta.
   - No se tratan datos de categoría especial deliberadamente.
   - Periodos de retención acotados y configurables.

4. Riesgos identificados
   R1. Acceso no autorizado a conversaciones de otra clínica.
       → Mitigado con RLS estricto y testing de aislamiento.
   R2. Filtración de credenciales OAuth de Google Calendar.
       → Mitigado con almacenamiento en Doppler / Supabase Vault.
   R3. Alucinación del agente proporcionando información incorrecta
       sobre medicación o tratamiento.
       → Mitigado con guardrails que detectan y bloquean este tipo
         de respuestas + reglas de transferencia inmediata.
   R4. Clasificación errónea de urgencia crítica como rutinaria.
       → Mitigado con: clasificador conservador (urgencia alta por
         defecto en duda), supervisión humana, evaluación con dataset
         golden y revisión semanal.
   R5. Exfiltración de datos por prompt injection.
       → Mitigado con: `custom_instructions` limitadas y aisladas en
         el system prompt, postscript fijo no editable, auditoría
         de cambios en clinic_config.
   R6. Negativa del cliente a interactuar con IA.
       → Mitigado con aviso inicial transparente y trigger
         `explicit_request` que transfiere ante petición de humano.

5. Medidas de mitigación y residuales
   - Tras aplicar mitigaciones, riesgo residual evaluado como BAJO.
   - Revisión semestral o ante cambios sustanciales del sistema.

6. Conclusión
   El tratamiento puede llevarse a cabo cumpliendo las medidas
   descritas. No se requiere consulta previa a la AEPD (art. 36).
```

Guardar como `docs/DPIA-2026-06.md` y revisarla cada 6 meses o ante cambios sustanciales (telefonía, nuevos clientes con volúmenes distintos, integración con software clínico).

---

## 14. Pre-checklist: qué firmar / publicar antes de tocar datos reales

Antes de que el primer cliente real escriba a Recepia, deben estar:

### Para el piloto (Dr. Patino)

- [ ] **DPA firmado** entre Marc/Recepia y el Hospital Dr. Patino (sección 5 de este documento, personalizado).
- [ ] **Anexo I técnico** firmado conjuntamente.
- [ ] **Política de privacidad de Recepia** publicada en una URL accesible (`recepia.iatope.com/privacidad` puede valer en piloto).
- [ ] **Aviso inicial en WhatsApp** configurado en `clinic_config.policies.consent.whatsapp_first_message` (ya está en el seed del Dr. Patino).
- [ ] **Protocolo de incidentes** activado: Marc tiene este documento en el repo y sabe a quién avisar si pasa algo.
- [ ] **DPIA ligera** archivada en `docs/`.

### Para Iteración 2 (telefonía)

- [ ] **Aviso de grabación** revisado y configurado.
- [ ] **Consentimiento explícito** al alta del cliente si la clínica decide aplicar consentimiento adicional.
- [ ] **Política de retención** de grabaciones implementada técnicamente (cron de borrado).

### Para comercialización (a partir de Iteración 3)

- [ ] **Revisión por abogado RGPD + AI Act**.
- [ ] **Política de privacidad y términos** comerciales completos en `recepia.com`.
- [ ] **Registro de actividades de tratamiento** formal según art. 30 RGPD.
- [ ] **DPO o figura equivalente** designada si el volumen lo justifica.
- [ ] **Auditoría externa de seguridad** (penetration testing).
- [ ] **Seguro de responsabilidad civil profesional** con cobertura específica de RGPD.

---

## 15. Próximos pasos legales

### Esta semana

1. Personalizar el modelo de DPA (sección 5) con los datos reales del Hospital Dr. Patino y los de Marc.
2. Generar PDF y enviar al Dr. Patino para revisión y firma.
3. Crear `docs/DPIA-2026-06.md` con la DPIA ligera completada.
4. Publicar la política de privacidad en `recepia.iatope.com/privacidad` cuando el panel esté desplegado.

### Antes de Iteración 2 (telefonía)

1. Revisar aviso de grabación con la clínica.
2. Configurar técnicamente el flujo de retención de grabaciones.
3. Documentar uso de Vapi/Cartesia/Twilio en el listado de subencargados.

### Antes de comercialización (Iteración 3)

1. Cita con abogado especialista — recomendación: buscar despachos con experiencia tanto en RGPD como en AI Act (mercado pequeño todavía en España, pero existen: ej. PintosOrduña, Cuatrecasas privacy, ECIJA, GoDigital).
2. Constituir sociedad (si aún no) — el régimen autónomo puede valer para piloto, pero para escalar comercialmente conviene S.L. con seguro de responsabilidad.

---

## 16. Cambios

| Fecha | Versión | Autor | Cambio |
|---|---|---|---|
| 2026-06-10 | 0.1 | Marc + Claude | Documento inicial. |
