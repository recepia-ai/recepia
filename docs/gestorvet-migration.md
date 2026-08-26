# Integración y migración desde GestorVet

## Estado

La conexión está encapsulada en `apps/panel/src/lib/gestorvet/client.ts`. Durante
la convivencia, las credenciales se guardan cifradas en Supabase Vault. El
cliente también admite estas variables solo para tareas locales controladas:

- `GESTORVET_NOC`
- `GESTORVET_API_KEY`

No deben añadirse al repositorio, a URLs de pruebas, a capturas ni a mensajes de
error. GestorVet exige incluir ambos valores en la ruta de cada petición; por ese
motivo el cliente nunca registra la URL completa ni el cuerpo devuelto.

## Cobertura inicial

El cliente implementa los recursos necesarios para descubrir el esquema real,
preparar la migración y reflejar en GestorVet las escrituras compatibles:

- clientes y detalle de cliente, con paginación de 100 registros;
- mascotas y detalle de mascota;
- agenda;
- consumos;
- vacunaciones;
- desparasitaciones;
- historial de pesos;
- maestros de especies, razas, usuarios y motivos de consulta.
- maestros de poblaciones, provincias, grupos de cliente, idiomas, estados y
  sexos de mascota;
- creación y actualización de clientes;
- creación de mascotas;
- creación de citas.

## Modelo de convivencia

El área `/gestorvet` permite trabajar desde RECEPIA durante la transición:

- muestra inventario, estado e historial de ejecuciones;
- pagina el listado de clientes y abre su ficha detallada en vivo;
- busca mascotas por nombre o ID y abre su ficha detallada;
- muestra la agenda disponible con las referencias clínicas que entrega la API.

Además, los módulos nativos incorporan una capa de consulta durante la
convivencia:

- **Clientes** combina los registros locales con la primera página de
  GestorVet, permite buscar en ambos orígenes y abre una ficha externa de solo
  lectura con sus mascotas vinculadas. Los identificadores de población,
  provincia, grupo, idioma, especie, raza, estado, sexo y veterinario se
  resuelven contra sus maestros y se muestran como nombre legible, conservando
  debajo el código original para trazabilidad;
- **Calendario** combina las citas locales y externas dentro de la misma vista,
  identificando GestorVet en violeta y sin permitir modificaciones.

Si GestorVet no responde, los clientes y citas locales continúan disponibles.
Los enlaces externos no se precargan para evitar consultas masivas de fichas.

Las búsquedas por nombre usan acciones de servidor y no se incluyen en la URL ni
en el historial del navegador. Estas consultas no convierten todavía los
registros en entidades locales ni activan escrituras hacia GestorVet.

Recepia guarda primero sus datos. Un trigger transaccional crea una operación en
`integration_outbox` cuando cambia un cliente, mascota o cita. El trabajador
`POST /api/integrations/gestorvet/outbox` reclama operaciones de forma atómica,
lee las credenciales desde Vault y llama a GestorVet. Los fallos temporales se
reintentan con espera exponencial; tras diez intentos dejan de reclamarse
automáticamente.

`integration_external_links` conserva los identificadores de ambos sistemas sin
usar nombres o teléfonos como claves. `integration_sync_runs` registra las
lecturas, importaciones y conciliaciones. La sincronización solo se encola cuando
la integración tiene `metadata.sync_enabled=true`.

| Cambio iniciado en Recepia | Resultado durante convivencia |
|---|---|
| Crear cliente | Crear en GestorVet y guardar su ID externo |
| Actualizar cliente | Actualizar en GestorVet mediante el ID externo |
| Crear mascota | Crear cuando cliente y especie estén mapeados |
| Actualizar mascota | Conciliación bloqueada: el manual no ofrece método |
| Crear cita | Crear cuando cliente, mascota, veterinario y motivo estén mapeados |
| Mover/cancelar cita | Conciliación bloqueada: el manual no ofrece método |

Una operación bloqueada no se reintenta ni se presenta como sincronizada. Queda
visible para resolución manual hasta que GestorVet confirme un endpoint adicional
o se acuerde otro procedimiento.

## Secuencia segura de migración

1. Configurar los dos secretos en el entorno de servidor.
2. Ejecutar una lectura mínima de un cliente y una mascota conocidos.
3. Conservar únicamente nombres de campos y tipos para definir el mapeo; no
   guardar datos personales en logs.
4. Preparar un `dry run` que contabilice altas, actualizaciones, duplicados,
   registros sin teléfono y referencias huérfanas.
5. Validar el informe con Samuel.
6. Ejecutar la importación idempotente por fases: maestros, clientes, mascotas,
   historiales y agenda.
7. Mapear veterinarios, especies, servicios/motivos, centro y ubicación.
8. Comparar recuentos y una muestra funcional.
9. Activar `sync_enabled` y programar el trabajador de salida.

El botón **Ejecutar inventario** de Ajustes → Integraciones cubre los pasos 2 y
3. Consulta los recursos en memoria y persiste exclusivamente recuentos, nombres
de campos y recursos fallidos en `integration_sync_runs` y en los metadatos de
la integración. No almacena respuestas, nombres, teléfonos ni historiales.

El botón **Ejecutar análisis** realiza el `dry run` contra los datos actuales de
Recepia. Normaliza teléfonos y microchips en memoria para contar coincidencias,
duplicados, campos obligatorios ausentes y referencias huérfanas. El informe
persistido solo contiene agregados y nombres de campos detectados.

## Mapeo previsto

| GestorVet | Recepia | Estrategia |
|---|---|---|
| Cliente | `clients` | Teléfono normalizado; vínculo estable en `integration_external_links` |
| Mascota | `pets` | Relación por cliente; ID estable en `integration_external_links` |
| Especie / raza / sexo | `pets` | Normalización a los valores de Recepia y conservación del original |
| Peso más reciente | `pets.weight_kg` | Historial completo en tabla clínica específica por crear |
| Vacunación / desparasitación / consumo | Tabla clínica específica por crear | Registro inmutable con ID externo y carga original controlada |
| Agenda | `appointments` | Solo tras acordar ventana temporal, estados y veterinarios |

## Pendientes antes de escribir datos

El manual describe rutas y filtros, pero no el esquema completo de las respuestas
JSON. El mapeo final y las tablas para historiales se definirán después de una
lectura real mínima. Tampoco debe importarse la agenda hasta decidir si se migra
solo el futuro, un periodo histórico o ambos.

Antes de activar escrituras también debe verificarse si los métodos `set*`
devuelven el ID creado. Si una creación es aceptada pero la respuesta no contiene
un ID detectable, el trabajador la bloquea sin repetirla, evitando duplicados.
