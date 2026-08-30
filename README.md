# PequeDex

Diario y seguimiento de bebé: tomas, sueño, pañales, hitos y crecimiento,
compartido en tiempo real entre cuidadores. Nace de una necesidad real (mi
hija nace en unas semanas) y, como [LudoDex](https://github.com/OdeiRZ/LudoDex),
está pensada primero para uso personal y abierta a que cualquiera lleve el
suyo.

**Proyecto recién empezado** — este README se irá ampliando a medida que
avancen los hitos. Ver [CHANGELOG.md](CHANGELOG.md) para el detalle de cada
uno.

## Estructura

Repo único con dos aplicaciones independientes, cada una con su propio
`README.md`:

- [`api/`](api/README.md) — API REST en Laravel 12 + Sanctum (autenticación
  por token, no por cookie de sesión — ver la nota de arquitectura más abajo).
- [`web/`](web/README.md) — SPA en Vue 3 (Composition API, Pinia, Vue Router,
  TypeScript), consume la API por HTTP.

## Por qué esta arquitectura

- **API y frontend separados**, mismo patrón que LudoDex y MIRA MarketLens —
  una API propiamente dicha consumida por una SPA independiente, no un
  monolito con Inertia.
- **Autenticación por token Bearer (Sanctum Personal Access Tokens), no por
  cookies de sesión**: pensado para acabar en capas gratuitas con la API y
  la SPA en dominios distintos, igual que LudoDex/MIRA — un token Bearer
  evita el choque de las cookies de sesión entre dominios con las
  restricciones de cookies de terceros de los navegadores modernos, a
  cambio de guardarse en `localStorage` en vez de en una cookie `httpOnly`.
  Aceptado conscientemente: la app no maneja datos financieros ni médicos
  regulados, solo el día a día de una familia.
- **Español como idioma único, de momento**: a diferencia de LudoDex/MIRA
  (5 idiomas cada una), esta app la usan solo dos personas que hablan
  español — añadir `vue-i18n` desde el principio sería trabajo sin usuario
  real detrás. Si el proyecto se abre a más gente más adelante, se
  revisará.
- **Pensada para dos cuidadores sobre los mismos datos**, no un usuario
  aislado: el reto de arquitectura real de esta app está en que dos
  personas (los dos padres) vean y registren lo mismo sin duplicar ni
  pisarse, no en el propio modelo de datos del bebé.

## Hitos

1. ✅ Cimientos: repo, API con auth (registro/login/logout) y SPA con las
   mismas pantallas, verificado de punta a punta en local.
2. ✅ Modelo de datos del núcleo: un bebé compartido entre cuidadores por
   código de invitación, con tomas/sueño/pañales y una línea temporal
   combinada.
3. ✅ Primeras pantallas: crear/unirse a un bebé, registro rápido y línea
   temporal, sincronizada entre cuidadores por sondeo.
4. ✅ Crecimiento con percentiles OMS (peso/talla/perímetro craneal) e
   hitos con foto (subida real de archivo, sin fuente externa de la que
   sacarla por URL).
5. ✅ Predicción de patrones de sueño: media móvil honesta sobre el
   propio historial del bebé, sin datos suficientes dice "no lo sé" en
   vez de inventar.

## Licencia

[AGPLv3](LICENSE).

## Autor

Odei Riveiro Zafra
