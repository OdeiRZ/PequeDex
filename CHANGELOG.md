# Changelog

Todos los cambios notables de este proyecto se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/), y este
proyecto usa [Versionado Semántico](https://semver.org/lang/es/).

## [Unreleased]

### Añadido

- Cimientos: repo, API en Laravel 12 + Sanctum (registro/login/logout por
  token Bearer) y SPA en Vue 3 + TypeScript con las mismas pantallas,
  verificado de punta a punta en local (registro real → sesión persiste
  tras recargar → cierre de sesión).

- Modelo de datos del núcleo de la app: un `Baby` compartido entre varios
  cuidadores (tabla `baby_user`, mismo patrón que `familia_user` en MIRA
  MarketLens, pero sin distinción admin/no-admin — cualquier cuidador
  vinculado tiene acceso total). Vinculación por código de invitación
  corto (8 caracteres, sin 0/O/1/I para evitar confusiones al copiarlo a
  mano): al crear un bebé se genera uno, y cualquier otro usuario puede
  unirse introduciéndolo, sin necesitar infraestructura de email
  todavía. Tomas (`feeds`), sueño (`sleeps`) y pañales (`diaper_changes`)
  como tres tablas tipadas (no una tabla `events` polimórfica) para que
  las estadísticas que se quieren más adelante (intervalo medio entre
  tomas, duración media de sueño) puedan hacerse con columnas reales,
  no un JSON por fila. Endpoint de "línea temporal"
  (`GET /babies/{baby}/timeline`) que mezcla y ordena los tres tipos en
  una sola lista, para que el dashboard no tenga que hacer 3 peticiones
  y mezclarlas a mano. Verificado de punta a punta contra la API real
  (sin pantallas todavía): un cuidador crea el bebé y registra una toma,
  un segundo cuidador se une con el código y ve/edita esa misma toma, un
  tercero sin el código recibe 403.
