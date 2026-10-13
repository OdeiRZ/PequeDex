import { defineStore } from 'pinia'
import { apiClient, getStoredToken } from '@/lib/api'
import { getStoredActiveBabyId, storeActiveBabyId } from '@/lib/activeBaby'
import type { StatsExportPayload } from '@/lib/stats'
import type { GrowthReferenceCurves } from '@/lib/growthReference'
import { ALERTS_WINDOW_DAYS } from '@/lib/dailyAlerts'
import { loadSnapshot } from '@/lib/snapshot'
import {
  endpointFor,
  isNetworkError,
  loadQueue,
  loadUpdates,
  newClientUuid,
  pendingEntry,
  saveQueue,
  saveUpdates,
  updateEndpoint,
  withPendingEntries,
  withPendingUpdates,
  withoutPendingDeletes,
  type QueuedLog,
  type QueuedLogType,
  type QueuedUpdate,
} from '@/lib/offlineQueue'

// Cuánto espera un guardado que PUEDE ir a la cola sin conexión (altas,
// ediciones y borrados de tomas, sueños, pañales y temperaturas) antes de
// darlo por "sin respuesta" y dejarlo pendiente de enviar. Con el tiempo por
// defecto (45 s), tras un rato sin usar la app el botón se quedaba esperando
// hasta ~30 s a que Render despertara la API (arranque en frío). Ahora el
// registro aparece enseguida como "pendiente" y se envía en cuanto la API
// responde. Es seguro reintentar: las altas llevan `client_uuid` (el servidor
// no duplica), las ediciones son PUT y borrar algo ya borrado cuenta como éxito.
const QUEUED_WRITE_TIMEOUT_MS = 7_000

export type BabySex = 'nino' | 'nina'

export interface Baby {
  id: number
  name: string | null
  due_date: string | null
  birth_date: string | null
  sex: BabySex | null
  /** Comunidad autónoma - decide la plantilla de vacunas. */
  region: Region | null
  vaccinations_enabled: boolean
  invite_code: string
  water_broke_at: string | null
}

export type Region =
  | 'andalucia'
  | 'aragon'
  | 'asturias'
  | 'baleares'
  | 'canarias'
  | 'cantabria'
  | 'castilla_la_mancha'
  | 'castilla_y_leon'
  | 'cataluna'
  | 'ceuta'
  | 'comunidad_valenciana'
  | 'extremadura'
  | 'galicia'
  | 'la_rioja'
  | 'madrid'
  | 'melilla'
  | 'murcia'
  | 'navarra'
  | 'pais_vasco'

export interface Vaccination {
  id: number
  baby_id: number
  user_id: number | null
  /** Clave de la plantilla; null en las añadidas a mano. */
  code: string | null
  name: string
  age_label: string | null
  due_date: string | null
  given_at: string | null
  optional: boolean
  notes: string | null
  /** De plantilla y cambiada a mano: se conserva al cambiar de comunidad. */
  edited: boolean
  /** Fecha prevista puesta a mano: no se recalcula con la de nacimiento. */
  due_date_edited: boolean
}

export interface VaccinationTemplateInfo {
  source: string
  year: number
  /** false = sin comunidad indicada: se usa el calendario común. */
  region_specific: boolean
}

export interface Checkup {
  id: number
  baby_id: number
  user_id: number | null
  scheduled_at: string
  reason: string | null
  notes: string | null
}

export interface SaveVaccinationPayload {
  name: string
  due_date: string | null
  given_at: string | null
  notes: string | null
}

export interface SaveCheckupPayload {
  scheduled_at: string
  reason: string | null
  notes: string | null
}

export type FeedType = 'pecho' | 'biberon' | 'solido'
export type FeedSide = 'izquierdo' | 'derecho' | 'ambos'
export type MilkType = 'calostro' | 'leche'
export type DiaperType = 'mojado' | 'sucio' | 'ambos'
export type DiaperResidueColor = 'verde' | 'amarillo' | 'marron' | 'meconio'
export type DiaperSize = '0' | '1' | '2' | '3' | '4' | '5' | '6+'

export interface Feed {
  id: number
  baby_id: number
  user_id: number | null
  type: FeedType
  side: FeedSide | null
  milk_type: MilkType | null
  amount_ml: number | null
  started_at: string
  ended_at: string | null
  notes: string | null
}

export interface Sleep {
  id: number
  baby_id: number
  user_id: number | null
  started_at: string
  ended_at: string | null
  notes: string | null
}

export interface DiaperChange {
  id: number
  baby_id: number
  user_id: number | null
  changed_at: string
  type: DiaperType
  residue_color: DiaperResidueColor | null
  size: DiaperSize | null
  notes: string | null
}

/** Lo que trae la lista de pañales recientes (modo `compact` del API): solo
 * lo que usan los avisos del Dashboard. */
export type RecentDiaperChange = Pick<DiaperChange, 'id' | 'baby_id' | 'changed_at' | 'type'>

export type TemperatureMethod = 'axila' | 'recto' | 'oido' | 'frente'

export interface Temperature {
  id: number
  baby_id: number
  user_id: number | null
  measured_at: string
  celsius: number
  method: TemperatureMethod | null
  notes: string | null
}

export interface GrowthMeasurement {
  id: number
  baby_id: number
  user_id: number | null
  measured_at: string
  weight_grams: number | null
  height_cm: number | null
  head_circumference_cm: number | null
  notes: string | null
  weight_percentile: number | null
  height_percentile: number | null
  head_circumference_percentile: number | null
}

export interface VitaminDSchedule {
  id: number
  baby_id: number
  enabled: boolean
  start_date: string
  end_date: string
}

export interface VitaminDDose {
  id: number
  baby_id: number
  date: string
  given: boolean
}

export type MilestoneCategory = 'sonrisa' | 'diente' | 'pasos' | 'palabra' | 'otro'

export interface MilestoneLike {
  id: number
  name: string
  avatar: string | null
}

export interface Milestone {
  id: number
  baby_id: number
  user_id: number | null
  achieved_at: string
  title: string
  category: MilestoneCategory | null
  description: string | null
  photo_path: string | null
  photo_url: string | null
  liked_by: MilestoneLike[]
}

export interface SleepPrediction {
  has_enough_data: boolean
  sample_size: number
  minimum_sample_size: number
  average_sleep_duration_minutes: number | null
  average_wake_window_minutes: number | null
  /** Número de ventana del día usado (1 = la primera tras la noche), o
   * null si se usó la media de todas. */
  window_number: number | null
  /** Ventana orientativa por edad (min/max en minutos), o null. */
  age_reference: { min: number; max: number } | null
  /** `based_on`: wake_window_by_number | average_wake_window |
   * age_reference (sin datos propios) | average_sleep_duration. */
  prediction: {
    type: 'wake_up' | 'next_sleep'
    at: string
    /** Rango habitual (percentil 20-80 de lo reciente); null con pocos datos. */
    range?: PredictionRange | null
    based_on: string
  } | null
}

export interface PredictionRange {
  from: string
  to: string
}

/** Cuerpo de GET /babies/{id}/bootstrap: cada sección es la respuesta
 * completa de su endpoint individual. `vaccinations`/`checkups` solo
 * vienen si están activadas para el bebé. */
type BootstrapResult =
  { status: 'unchanged' } | { status: 'fresh'; body: BootstrapResponse; etag: string | null }

/** Petición del arranque ya lanzada (ver startEarlyBootstrap). */
export interface EarlyBootstrap {
  babyId: number
  result: Promise<{ ok: true; value: BootstrapResult } | { ok: false }>
}

interface BootstrapResponse {
  timeline: { data: TimelineEntry[] }
  /** Huella de la línea temporal, para el primer sondeo condicional. */
  timeline_etag?: string | null
  growth_measurements: { data: GrowthMeasurement[] }
  milestones: { data: Milestone[] }
  sleep_prediction: { data: SleepPrediction }
  feed_prediction: { data: FeedPrediction }
  vitamin_d_schedule: { data: VitaminDSchedule | null; recent_doses: VitaminDDose[] }
  temperatures: { data: Temperature[] }
  recent_diaper_changes: { data: DiaperChange[] }
  vaccinations?: { data: Vaccination[]; template: VaccinationTemplateInfo | null }
  checkups?: { data: Checkup[] }
}

export interface FeedPrediction {
  has_enough_data: boolean
  sample_size: number
  minimum_sample_size: number
  average_gap_minutes: number | null
  prediction: {
    type: 'next_feed'
    at: string
    range?: PredictionRange | null
    based_on: string
  } | null
}

export interface Contraction {
  id: number
  baby_id: number
  user_id: number | null
  started_at: string
  ended_at: string | null
  intensity: 0 | 1 | 2
}

/** `pending`: el `client_uuid` de un registro creado sin conexión que
 * todavía está en la cola (lib/offlineQueue.ts), sin guardar en el
 * servidor. Ausente en las entradas normales. */
export type TimelineEntry =
  | { type: 'feed'; at: string; data: Feed; pending?: string }
  | { type: 'sleep'; at: string; data: Sleep; pending?: string }
  | { type: 'diaper_change'; at: string; data: DiaperChange; pending?: string }
  | { type: 'temperature'; at: string; data: Temperature; pending?: string }

interface CreateTemperaturePayload {
  measured_at: string
  celsius: number
  method?: TemperatureMethod | null
  notes?: string | null
}

interface CreateFeedPayload {
  type: FeedType
  side?: FeedSide
  milk_type?: MilkType
  amount_ml?: number
  started_at: string
  ended_at?: string | null
  notes?: string | null
}

interface CreateSleepPayload {
  started_at: string
  ended_at?: string | null
  notes?: string | null
}

interface CreateDiaperChangePayload {
  changed_at: string
  type: DiaperType
  residue_color?: DiaperResidueColor | null
  size?: DiaperSize | null
  notes?: string | null
}

interface CreateGrowthMeasurementPayload {
  measured_at: string
  weight_grams?: number | null
  height_cm?: number | null
  head_circumference_cm?: number | null
  notes?: string | null
}

interface CreateMilestonePayload {
  achieved_at: string
  title: string
  category?: MilestoneCategory | null
  description?: string | null
  photo?: File | null
}

interface UpdateMilestonePayload {
  achieved_at: string
  title: string
  category?: MilestoneCategory | null
  description?: string | null
  photo?: File | null
  removePhoto?: boolean
}

interface UpdateBabyPayload {
  name?: string | null
  due_date?: string | null
  birth_date?: string | null
  sex?: BabySex | null
  water_broke_at?: string | null
}

interface UpdateContractionPayload {
  started_at: string
  ended_at: string | null
  intensity: 0 | 1 | 2
}

interface BabiesState {
  current: Baby | null
  /** Every baby this caregiver has - almost always just one, but a second
   * pregnancy while an older child is already being tracked means more
   * than one at once. `current` is always one of these (or null). */
  babies: Baby[]
  timeline: TimelineEntry[]
  /** A single calendar day's worth of entries, for the "Ritmo" day
   * navigator - separate from `timeline` (which is always "most recent
   * N overall", live-polled while the dashboard is open) so browsing to
   * a previous day doesn't fight with that poll overwriting it. */
  dayTimeline: TimelineEntry[]
  growthMeasurements: GrowthMeasurement[]
  /** Curvas de percentiles de la OMS para el sexo del bebé actual (las
   * bandas de las gráficas de Crecimiento). `null` sin sexo/fecha de
   * nacimiento, o mientras no se han pedido. */
  growthReference: GrowthReferenceCurves | null
  milestones: Milestone[]
  sleepPrediction: SleepPrediction | null
  feedPrediction: FeedPrediction | null
  contractions: Contraction[]
  /** The baby's whole history of each, for `StatsView.vue` - unlike
   * `timeline`/`dayTimeline` (bounded to "most recent N" or a single
   * day), stats like "franja más habitual" (and the weekly sleep chart,
   * now also on this page) need every entry ever logged, not just a
   * recent slice. Fetched once when the stats page opens
   * (`fetchStatsData()`), not kept live/polled. */
  statsSleeps: Sleep[]
  statsFeeds: Feed[]
  statsDiaperChanges: DiaperChange[]
  statsTemperatures: Temperature[]
  /** Todas las temperaturas del bebé actual, para la tarjeta de las
   * últimas 48 h del Dashboard - aparte de `timeline` (que solo trae
   * las 50 entradas más recientes de todo y en un día ajetreado podría
   * dejar fuera alguna medición). Pocas filas por naturaleza. */
  temperatures: Temperature[]
  /** Pañales de los últimos `ALERTS_WINDOW_DAYS` días, para los avisos
   * del Dashboard ("lleva 3 días sin caca" necesita ir más atrás que
   * las 50 entradas de `timeline`). */
  recentDiaperChanges: RecentDiaperChange[]
  /** Registros creados sin conexión, pendientes de enviar
   * (lib/offlineQueue.ts). Persistidos en el propio móvil. */
  offlineQueue: QueuedLog[]
  /** Cambios sobre registros ya guardados (finalizar sin conexión). */
  offlineUpdates: QueuedUpdate[]
  flushingQueue: boolean
  /** true mientras lo que se ve viene de la foto guardada (lib/snapshot.ts)
   * y todavía no ha llegado la respuesta real del servidor. */
  hydratedFromSnapshot: boolean
  /** ETag de la última línea temporal recibida (sondeo condicional). No
   * se guarda en la foto: con ella a la vista no vale. */
  timelineEtag: string | null
  /** ETag de la última respuesta del arranque (bootstrap condicional). Sí
   * se guarda en la foto: si al abrir no ha cambiado nada, el servidor
   * contesta 304 y la foto ya es lo último. */
  bootstrapEtag: string | null
  vaccinations: Vaccination[]
  vaccinationTemplate: VaccinationTemplateInfo | null
  checkups: Checkup[]
  vitaminDSchedule: VitaminDSchedule | null
  /** Last 14 days only, embedded in fetchVitaminDSchedule()'s response -
   * enough for the Dashboard's retroactive editor without a request per
   * day. Estadísticas needs the full history instead (see
   * vitaminDAllDoses/fetchAllVitaminDDoses()). */
  vitaminDRecentDoses: VitaminDDose[]
  vitaminDAllDoses: VitaminDDose[]
}

// Inserts (or, if one with the same type+id already exists, replaces
// and repositions) a single entry into an already-sorted-desc-by-`at`
// timeline array, returning a new array - used by create*/update* below
// to fold the POST/PUT response straight into `timeline` AND
// `dayTimeline` instead of a second round-trip re-fetching the whole
// thing just to learn what the first response already said. Applied to
// both arrays unconditionally, not just whichever one is currently
// rendered (see `rhythmTimeline` in DashboardView.vue) - real bug found
// live: editing/deleting an entry several days back only patched
// `timeline` (always "today"), so the visible list on that past day
// kept showing the stale version until navigating away and back forced
// a fresh `fetchDayTimeline()`. Harmless when the edited entry belongs
// to a different day than whatever `dayTimeline` currently holds - the
// view's own date-range filter (`visibleTimeline`) clips it back out
// before it would ever render, and the next real day-navigation
// overwrites `dayTimeline` wholesale from the server anyway. Correctly
// repositions on update too (editing a feed's `started_at` backwards,
// say), not just a same-slot overwrite - a plain `findIndex` +
// splice-in-place would leave it sorted wrong until the dashboard's own
// 5s poll caught up.
function upsertTimelineEntry(timeline: TimelineEntry[], entry: TimelineEntry): TimelineEntry[] {
  const withoutExisting = timeline.filter(
    (existing) => !(existing.type === entry.type && existing.data.id === entry.data.id),
  )
  const insertAt = withoutExisting.findIndex(
    (existing) => new Date(existing.at).getTime() < new Date(entry.at).getTime(),
  )

  if (insertAt === -1) {
    return [...withoutExisting, entry]
  }

  return [...withoutExisting.slice(0, insertAt), entry, ...withoutExisting.slice(insertAt)]
}

// Same idea as upsertTimelineEntry above, generalized for the two flat
// (single-type) lists - growthMeasurements and milestones - each sorted
// desc by their own date field.
function upsertByDate<T extends { id: number }>(
  list: T[],
  item: T,
  dateOf: (item: T) => string,
): T[] {
  const withoutExisting = list.filter((existing) => existing.id !== item.id)
  const insertAt = withoutExisting.findIndex(
    (existing) => new Date(dateOf(existing)).getTime() < new Date(dateOf(item)).getTime(),
  )

  if (insertAt === -1) {
    return [...withoutExisting, item]
  }

  return [...withoutExisting.slice(0, insertAt), item, ...withoutExisting.slice(insertAt)]
}

// Mismo orden que devuelve el backend: por fecha prevista, las que no
// tienen fecha al final.
function sortVaccinations(list: Vaccination[]): Vaccination[] {
  return [...list].sort((a, b) => {
    if (a.due_date === b.due_date) return a.id - b.id
    if (a.due_date === null) return 1
    if (b.due_date === null) return -1
    return a.due_date.localeCompare(b.due_date)
  })
}

/** Lo del bebé actual que se guarda en la foto del Dashboard
 * (lib/snapshot.ts) para pintarlo al abrir sin esperar al servidor. */
export interface BabiesSnapshotData {
  timeline: TimelineEntry[]
  growthMeasurements: GrowthMeasurement[]
  milestones: Milestone[]
  sleepPrediction: SleepPrediction | null
  feedPrediction: FeedPrediction | null
  vitaminDSchedule: VitaminDSchedule | null
  vitaminDRecentDoses: VitaminDDose[]
  temperatures: Temperature[]
  recentDiaperChanges: RecentDiaperChange[]
  vaccinations: Vaccination[]
  vaccinationTemplate: VaccinationTemplateInfo | null
  checkups: Checkup[]
  /** Ausente en las fotos guardadas antes de existir el bootstrap condicional. */
  bootstrapEtag?: string | null
}

// Lo que ya se sabía la última vez que se usó la app, si hay una foto
// guardada de esta sesión (lib/snapshot.ts). Se aplica al crear el store;
// los datos reales llegan después y la sustituyen.
function hydratedState(): Partial<BabiesState> {
  const snapshot = loadSnapshot(getStoredToken())
  if (!snapshot) return {}

  const storedId = getStoredActiveBabyId()
  const current =
    snapshot.babies.find((baby) => baby.id === (storedId ?? snapshot.currentId)) ??
    snapshot.babies.find((baby) => baby.id === snapshot.currentId) ??
    snapshot.babies[0] ??
    null
  // La foto es del bebé que era el actual al guardarla: si ahora es otro,
  // no se mezcla su historial con el de este.
  if (current === null || current.id !== snapshot.currentId) {
    return { babies: snapshot.babies, current }
  }

  return { ...snapshot.data, babies: snapshot.babies, current, hydratedFromSnapshot: true }
}

export const useBabiesStore = defineStore('babies', {
  state: (): BabiesState => ({
    current: null,
    babies: [],
    timeline: [],
    dayTimeline: [],
    growthMeasurements: [],
    growthReference: null,
    milestones: [],
    sleepPrediction: null,
    feedPrediction: null,
    contractions: [],
    statsSleeps: [],
    statsFeeds: [],
    statsDiaperChanges: [],
    statsTemperatures: [],
    temperatures: [],
    recentDiaperChanges: [],
    offlineQueue: loadQueue(),
    offlineUpdates: loadUpdates(),
    flushingQueue: false,
    vaccinations: [],
    vaccinationTemplate: null,
    checkups: [],
    vitaminDSchedule: null,
    vitaminDRecentDoses: [],
    vitaminDAllDoses: [],
    hydratedFromSnapshot: false,
    timelineEtag: null,
    bootstrapEtag: null,
    ...hydratedState(),
  }),

  actions: {
    /** Lo que se guarda en la foto del Dashboard (lib/snapshot.ts). */
    snapshotData(): BabiesSnapshotData {
      return {
        timeline: this.timeline,
        growthMeasurements: this.growthMeasurements,
        milestones: this.milestones,
        sleepPrediction: this.sleepPrediction,
        feedPrediction: this.feedPrediction,
        vitaminDSchedule: this.vitaminDSchedule,
        vitaminDRecentDoses: this.vitaminDRecentDoses,
        temperatures: this.temperatures,
        recentDiaperChanges: this.recentDiaperChanges,
        vaccinations: this.vaccinations,
        vaccinationTemplate: this.vaccinationTemplate,
        checkups: this.checkups,
        bootstrapEtag: this.bootstrapEtag,
      }
    },

    /** Loads every baby this caregiver has, and picks which one is
     * "current" - the previously-active one if it's still among them
     * (e.g. after a second baby was added elsewhere), otherwise the
     * first. */
    async fetchCurrent() {
      const { data } = await apiClient.get('/babies')
      this.babies = data.data

      const storedId = getStoredActiveBabyId()
      this.current = this.babies.find((baby) => baby.id === storedId) ?? this.babies[0] ?? null
      if (this.current) {
        storeActiveBabyId(this.current.id)
      }
    },

    /** Switches which already-loaded baby is shown - the caller (e.g.
     * DashboardView) still has to reload baby-scoped data (timeline,
     * predictions...) same as after create()/join(), since those belong
     * to whichever baby was current at the time they were fetched. */
    switchBaby(id: number) {
      const baby = this.babies.find((b) => b.id === id)
      if (!baby) return

      this.current = baby
      storeActiveBabyId(baby.id)
    },

    async create(payload: { name?: string; due_date?: string; sex?: BabySex }) {
      const { data } = await apiClient.post('/babies', payload)
      this.babies.push(data.data)
      this.current = data.data
      storeActiveBabyId(data.data.id)
    },

    async join(inviteCode: string) {
      const { data } = await apiClient.post('/babies/join', { invite_code: inviteCode })
      if (!this.babies.some((baby) => baby.id === data.data.id)) {
        this.babies.push(data.data)
      }
      this.current = data.data
      storeActiveBabyId(data.data.id)
    },

    async updateBaby(payload: UpdateBabyPayload) {
      const previousBirthDate = this.current!.birth_date
      const { data } = await apiClient.put(`/babies/${this.current!.id}`, payload)
      this.current = data.data
      this.babies = this.babies.map((baby) => (baby.id === data.data.id ? data.data : baby))
      // El servidor recalcula las fechas previstas de las vacunas
      // pendientes al cambiar la fecha de nacimiento: se recargan.
      if (data.data.birth_date !== previousBirthDate && data.data.vaccinations_enabled) {
        await this.fetchVaccinations()
      }
    },

    /** Unlinks the current user from the baby - the reverse of join(). The
     * backend rejects this as the last remaining caregiver (422), leaving
     * `current` untouched in that case. Falls back to another already-
     * loaded baby, if the caregiver still has one, instead of always
     * dropping to the onboarding screen. */
    async leave() {
      const leftId = this.current!.id
      await apiClient.delete(`/babies/${leftId}/leave`)

      this.babies = this.babies.filter((baby) => baby.id !== leftId)
      this.current = this.babies[0] ?? null
      if (this.current) {
        storeActiveBabyId(this.current.id)
      }
    },

    /** Permanently deletes the current baby and all its data - the
     * backend only allows this for the last remaining caregiver (422
     * otherwise), since deleting a baby someone else still cares for
     * would destroy their data without their consent - `leave()` is the
     * right action to share custody. Falls back to another already-
     * loaded baby, same as leave(), since a caregiver can have more than
     * one. */
    async remove() {
      const removedId = this.current!.id
      await apiClient.delete(`/babies/${removedId}`)

      this.babies = this.babies.filter((baby) => baby.id !== removedId)
      this.current = this.babies[0] ?? null
      if (this.current) {
        storeActiveBabyId(this.current.id)
      }
    },

    async regenerateInviteCode() {
      if (!this.current) {
        return
      }

      const { data } = await apiClient.post(`/babies/${this.current.id}/invite-code`)
      this.current = data.data
      this.babies = this.babies.map((baby) => (baby.id === data.data.id ? data.data : baby))
    },

    async fetchTimeline(force = false) {
      if (!this.current) {
        return
      }

      // Sondeo condicional: con la huella (ETag) de la última respuesta, el
      // servidor contesta 304 sin cuerpo si nada ha cambiado - casi siempre
      // - y no hay que volver a pintar la lista. `force` pide la completa
      // (red de seguridad contra una huella que no detecte un cambio).
      const headers =
        this.timelineEtag && !force ? { 'If-None-Match': this.timelineEtag } : undefined
      const response = await apiClient.get(`/babies/${this.current.id}/timeline`, {
        headers,
        validateStatus: (status) => (status >= 200 && status < 300) || status === 304,
      })
      if (response.status === 304) return

      this.timelineEtag = response.headers?.etag ?? null
      this.applyTimeline(response.data.data, this.current.id)
    },

    // Lo que sigue en la cola sin conexión no viene del servidor:
    // se vuelve a añadir para que no desaparezca en cada sondeo.
    applyTimeline(entries: TimelineEntry[], babyId: number) {
      this.timeline = withPendingUpdates(
        withPendingEntries(entries, this.offlineQueue, babyId),
        this.offlineUpdates,
        babyId,
      )
    },

    /** La petición del arranque, sin aplicar nada. Condicional: con el ETag de
     * la última respuesta (también el de la foto guardada), el servidor
     * contesta 304 si no ha cambiado nada y no se envía ni se recalcula
     * todo. */
    async requestBootstrap(babyId: number): Promise<BootstrapResult> {
      const since = new Date(Date.now() - ALERTS_WINDOW_DAYS * 86_400_000).toISOString()
      const response = await apiClient.get(`/babies/${babyId}/bootstrap`, {
        params: { tz: Intl.DateTimeFormat().resolvedOptions().timeZone, since },
        headers: this.bootstrapEtag ? { 'If-None-Match': this.bootstrapEtag } : undefined,
        validateStatus: (status) => (status >= 200 && status < 300) || status === 304,
      })

      if (response.status === 304) return { status: 'unchanged' }

      return { status: 'fresh', body: response.data, etag: response.headers?.etag ?? null }
    },

    /** Arranque en paralelo: lanza la petición del Dashboard AHORA, con el
     * bebé que ya se conoce (el de la foto guardada, o el último activo), sin
     * esperar a que `/babies` diga cuál es el actual. El resultado se recoge
     * después con fetchBootstrap(early) y solo se usa si el bebé coincide.
     * No se hace con registros pendientes sin conexión: esos se envían antes
     * (flushOfflineQueue) y la respuesta ya tendría que incluirlos. */
    startEarlyBootstrap(): EarlyBootstrap | null {
      if (this.offlineQueue.length > 0 || this.offlineUpdates.length > 0) return null

      const babyId = this.current?.id ?? getStoredActiveBabyId()
      if (babyId === null) return null

      return {
        babyId,
        // Sin rechazos sin atender: un fallo se recoge en fetchBootstrap.
        result: this.requestBootstrap(babyId).then(
          (value) => ({ ok: true as const, value }),
          () => ({ ok: false as const }),
        ),
      }
    },

    /** Todo lo que el Dashboard pide al abrir un bebé, en UNA petición
     * (GET /babies/{id}/bootstrap) en vez de 8-10 en paralelo: en
     * producción cada una pagaba su propia conexión a la base de datos y
     * tardaba 1,6-3 s. Si el backend todavía no tiene el endpoint (404,
     * p.ej. el frontend se despliega antes), se piden por separado. */
    async fetchBootstrap(early: EarlyBootstrap | null = null) {
      if (!this.current) {
        return
      }

      const babyId = this.current.id
      let result: BootstrapResult | null = null

      // El arranque en paralelo (startEarlyBootstrap) ya lo pidió: se espera
      // a esa respuesta. Si falló, o era para otro bebé, se pide de nuevo.
      if (early !== null && early.babyId === babyId) {
        const earlyResult = await early.result
        if (earlyResult.ok) result = earlyResult.value
      }

      if (result === null) {
        try {
          result = await this.requestBootstrap(babyId)
        } catch (error) {
          if ((error as { response?: { status?: number } }).response?.status !== 404) throw error
          await this.fetchBootstrapSeparately()
          return
        }
      }

      // Cambió de bebé mientras tanto: esa respuesta ya no vale.
      if (this.current?.id !== babyId) return

      // 304: no ha cambiado nada desde la última vez (la foto guardada, o lo
      // ya cargado, sigue siendo lo último): no hay nada que aplicar.
      if (result.status === 'unchanged') {
        this.hydratedFromSnapshot = false
        return
      }

      const body = result.body
      this.bootstrapEtag = result.etag
      this.applyTimeline(body.timeline.data, babyId)
      this.timelineEtag = body.timeline_etag ?? null
      this.growthMeasurements = body.growth_measurements.data
      this.milestones = body.milestones.data
      this.sleepPrediction = body.sleep_prediction.data
      this.feedPrediction = body.feed_prediction.data
      this.vitaminDSchedule = body.vitamin_d_schedule.data
      this.vitaminDRecentDoses = body.vitamin_d_schedule.recent_doses
      this.temperatures = withoutPendingDeletes(
        body.temperatures.data,
        this.offlineUpdates,
        babyId,
        'temperature',
      )
      this.recentDiaperChanges = withoutPendingDeletes(
        body.recent_diaper_changes.data,
        this.offlineUpdates,
        babyId,
        'diaper_change',
      )
      if (body.vaccinations && body.checkups) {
        this.vaccinations = body.vaccinations.data
        this.vaccinationTemplate = body.vaccinations.template
        this.checkups = body.checkups.data
      } else {
        this.vaccinations = []
        this.checkups = []
      }
      this.hydratedFromSnapshot = false
    },

    /** Respaldo de fetchBootstrap(): las mismas peticiones, una a una. */
    async fetchBootstrapSeparately() {
      await Promise.all([
        this.fetchTimeline(),
        this.fetchGrowthMeasurements(),
        this.fetchMilestones(),
        this.fetchSleepPrediction(),
        this.fetchFeedPrediction(),
        this.fetchVitaminDSchedule(),
        this.fetchTemperatures(),
        this.fetchRecentDiaperChanges(),
        this.current?.vaccinations_enabled
          ? this.fetchVaccinations()
          : Promise.resolve().then(() => {
              this.vaccinations = []
              this.checkups = []
            }),
      ])
      this.hydratedFromSnapshot = false
    },

    // `date` is a plain "YYYY-MM-DD" - the backend returns every entry
    // that could overlap that calendar day (see TimelineController),
    // not the usual "most recent N overall".
    async fetchDayTimeline(date: string) {
      if (!this.current) {
        return
      }

      const { data } = await apiClient.get(`/babies/${this.current.id}/timeline`, {
        params: { date },
      })
      this.dayTimeline = withPendingUpdates(data.data, this.offlineUpdates, this.current.id)
    },

    // The POST/PUT response is already the full created/updated record -
    // the second round-trip a plain fetchTimeline() would add exists only
    // to learn what that response just said, and was reported live as
    // making creating something feel as slow as the old (pre-optimistic)
    // delete did. Folded straight into `timeline` via upsertTimelineEntry
    // instead.
    // --- Registro sin conexión (lib/offlineQueue.ts) ---

    /** Crea un registro; si no hay red, lo deja en la cola y lo muestra
     * como pendiente. 'queued' para que la vista avise de ello en vez de
     * "guardado". Un error con respuesta (validación...) se relanza. */
    async createLog(
      type: QueuedLogType,
      payload: Record<string, unknown>,
    ): Promise<'saved' | 'queued'> {
      const log: QueuedLog = {
        clientUuid: newClientUuid(),
        tempId: -Date.now(),
        babyId: this.current!.id,
        type,
        payload,
        queuedAt: new Date().toISOString(),
      }
      try {
        const { data } = await apiClient.post(
          endpointFor(log),
          { ...payload, client_uuid: log.clientUuid },
          { timeout: QUEUED_WRITE_TIMEOUT_MS },
        )
        this.applyCreatedLog(type, data.data)
        return 'saved'
      } catch (error) {
        if (!isNetworkError(error)) throw error
        this.offlineQueue = [...this.offlineQueue, log]
        saveQueue(this.offlineQueue)
        this.timeline = upsertTimelineEntry(this.timeline, pendingEntry(log))
        return 'queued'
      }
    },

    applyCreatedLog(type: QueuedLogType, data: TimelineEntry['data']) {
      const at =
        type === 'diaper_change'
          ? (data as DiaperChange).changed_at
          : type === 'temperature'
            ? (data as Temperature).measured_at
            : (data as Feed | Sleep).started_at
      const entry = { type, at, data } as TimelineEntry
      this.timeline = upsertTimelineEntry(this.timeline, entry)
      this.dayTimeline = upsertTimelineEntry(this.dayTimeline, entry)
      if (type === 'diaper_change') {
        this.recentDiaperChanges = upsertByDate(
          this.recentDiaperChanges,
          data as DiaperChange,
          (c) => c.changed_at,
        )
      }
      if (type === 'temperature') {
        this.temperatures = upsertByDate(
          this.temperatures,
          data as Temperature,
          (t) => t.measured_at,
        )
      }
    },

    /** Envía la cola en orden. Para en el primer fallo de red (se
     * reintenta en el siguiente sondeo o al volver la conexión); un
     * registro rechazado por el servidor (p.ej. validación) se descarta
     * y cuenta en `rejected`, para que la vista lo avise. */
    async flushOfflineQueue(): Promise<{ sent: number; rejected: number }> {
      if (
        this.flushingQueue ||
        (this.offlineQueue.length === 0 && this.offlineUpdates.length === 0)
      )
        return { sent: 0, rejected: 0 }
      this.flushingQueue = true
      let sent = 0
      let rejected = 0
      try {
        let offline = false
        for (const log of [...this.offlineQueue]) {
          try {
            const { data } = await apiClient.post(endpointFor(log), {
              ...log.payload,
              client_uuid: log.clientUuid,
            })
            this.removeQueued(log.clientUuid)
            if (this.current?.id === log.babyId) this.applyCreatedLog(log.type, data.data)
            sent++
          } catch (error) {
            if (isNetworkError(error)) {
              offline = true
              break
            }
            this.removeQueued(log.clientUuid)
            rejected++
          }
        }
        // Después de las altas, los cambios sobre registros ya guardados.
        for (const update of offline ? [] : [...this.offlineUpdates]) {
          try {
            if (update.action === 'delete') {
              await apiClient.delete(updateEndpoint(update))
              this.removeQueuedUpdate(update)
            } else {
              const { data } = await apiClient.put(updateEndpoint(update), update.payload)
              this.removeQueuedUpdate(update)
              if (
                this.current?.id === update.babyId &&
                (update.type === 'feed' || update.type === 'sleep')
              )
                this.applySavedUpdate(update.type, data.data)
            }
            sent++
          } catch (error) {
            if (isNetworkError(error)) break
            this.removeQueuedUpdate(update)
            // Borrar algo que ya no existe (404) es el resultado buscado.
            if (
              update.action === 'delete' &&
              (error as { response?: { status?: number } }).response?.status === 404
            ) {
              sent++
            } else {
              rejected++
            }
          }
        }
      } finally {
        this.flushingQueue = false
      }
      return { sent, rejected }
    },

    /** Sin red al borrar algo ya guardado: el borrado queda en cola (la
     * entrada ya se quitó de la vista) y sustituye cualquier cambio
     * pendiente de ese registro. */
    queueDelete(type: QueuedLogType, targetId: number) {
      const update: QueuedUpdate = {
        babyId: this.current!.id,
        type,
        targetId,
        action: 'delete',
        payload: {},
        queuedAt: new Date().toISOString(),
      }
      this.offlineUpdates = [
        ...this.offlineUpdates.filter((u) => !(u.type === type && u.targetId === targetId)),
        update,
      ]
      saveUpdates(this.offlineUpdates)
    },

    removeQueuedUpdate(update: QueuedUpdate) {
      this.offlineUpdates = this.offlineUpdates.filter(
        (u) => !(u.type === update.type && u.targetId === update.targetId),
      )
      saveUpdates(this.offlineUpdates)
    },

    applySavedUpdate(type: 'feed' | 'sleep', data: Feed | Sleep) {
      const entry = { type, at: data.started_at, data } as TimelineEntry
      this.timeline = upsertTimelineEntry(this.timeline, entry)
      this.dayTimeline = upsertTimelineEntry(this.dayTimeline, entry)
    },

    /** Guarda un cambio sobre un registro ya existente; si no hay red y
     * `queueIfOffline`, lo deja en cola (y ya visible en la línea
     * temporal) en vez de fallar. Un error con respuesta se relanza. */
    async updateOrQueue(
      type: 'feed' | 'sleep',
      targetId: number,
      payload: Record<string, unknown>,
      queueIfOffline: boolean,
    ): Promise<'saved' | 'queued'> {
      const update: QueuedUpdate = {
        babyId: this.current!.id,
        type,
        targetId,
        payload,
        queuedAt: new Date().toISOString(),
      }
      try {
        const { data } = await apiClient.put(updateEndpoint(update), payload, {
          timeout: QUEUED_WRITE_TIMEOUT_MS,
        })
        this.applySavedUpdate(type, data.data)
        return 'saved'
      } catch (error) {
        if (!queueIfOffline || !isNetworkError(error)) throw error
        this.offlineUpdates = [
          ...this.offlineUpdates.filter((u) => !(u.type === type && u.targetId === targetId)),
          update,
        ]
        saveUpdates(this.offlineUpdates)
        this.timeline = withPendingUpdates(this.timeline, [update], update.babyId)
        this.dayTimeline = withPendingUpdates(this.dayTimeline, [update], update.babyId)
        return 'queued'
      }
    },

    removeQueued(clientUuid: string) {
      this.offlineQueue = this.offlineQueue.filter((log) => log.clientUuid !== clientUuid)
      saveQueue(this.offlineQueue)
      const keep = (entry: TimelineEntry) => entry.pending !== clientUuid
      this.timeline = this.timeline.filter(keep)
      this.dayTimeline = this.dayTimeline.filter(keep)
    },

    /** Cambia un registro todavía en cola (p.ej. "Finalizar" un sueño
     * creado sin conexión) - se envía ya con el cambio. */
    updateQueued(tempId: number, patch: Record<string, unknown>) {
      const log = this.offlineQueue.find((l) => l.tempId === tempId)
      if (!log) return
      const updated: QueuedLog = { ...log, payload: { ...log.payload, ...patch } }
      this.offlineQueue = this.offlineQueue.map((l) => (l.tempId === tempId ? updated : l))
      saveQueue(this.offlineQueue)
      this.timeline = upsertTimelineEntry(
        this.timeline.filter((e) => e.pending !== log.clientUuid),
        pendingEntry(updated),
      )
    },

    async createFeed(payload: CreateFeedPayload) {
      return this.createLog('feed', { ...payload })
    },

    async updateFeed(id: number, payload: CreateFeedPayload, queueIfOffline = false) {
      return this.updateOrQueue('feed', id, { ...payload }, queueIfOffline)
    },

    async createSleep(payload: CreateSleepPayload) {
      return this.createLog('sleep', { ...payload })
    },

    async updateSleep(id: number, payload: CreateSleepPayload, queueIfOffline = false) {
      return this.updateOrQueue('sleep', id, { ...payload }, queueIfOffline)
    },

    async createDiaperChange(payload: CreateDiaperChangePayload) {
      return this.createLog('diaper_change', { ...payload })
    },

    async updateDiaperChange(id: number, payload: CreateDiaperChangePayload) {
      const { data } = await apiClient.put(
        `/babies/${this.current!.id}/diaper-changes/${id}`,
        payload,
      )
      const entry: TimelineEntry = {
        type: 'diaper_change',
        at: data.data.changed_at,
        data: data.data,
      }
      this.timeline = upsertTimelineEntry(this.timeline, entry)
      this.dayTimeline = upsertTimelineEntry(this.dayTimeline, entry)
      this.recentDiaperChanges = upsertByDate(
        this.recentDiaperChanges,
        data.data,
        (c) => c.changed_at,
      )
    },

    async fetchRecentDiaperChanges() {
      if (!this.current) {
        return
      }

      const since = new Date(Date.now() - ALERTS_WINDOW_DAYS * 86_400_000).toISOString()
      const { data } = await apiClient.get(`/babies/${this.current.id}/diaper-changes`, {
        params: { since, compact: 1 },
      })
      this.recentDiaperChanges = withoutPendingDeletes(
        data.data,
        this.offlineUpdates,
        this.current.id,
        'diaper_change',
      )
    },

    // --- Vacunas y revisiones ---

    async fetchVaccinations() {
      if (!this.current) {
        return
      }

      const babyId = this.current.id
      const [vaccinations, checkups] = await Promise.all([
        apiClient.get(`/babies/${babyId}/vaccinations`),
        apiClient.get(`/babies/${babyId}/checkups`),
      ])
      this.vaccinations = vaccinations.data.data
      this.vaccinationTemplate = vaccinations.data.template
      this.checkups = checkups.data.data
    },

    /** Activa/desactiva y elige la comunidad; el backend genera (o
     * rehace) la lista desde la plantilla y devuelve el bebé y la lista. */
    async updateVaccinationSettings(payload: {
      vaccinations_enabled: boolean
      region: Region | null
    }) {
      const { data } = await apiClient.put(
        `/babies/${this.current!.id}/vaccinations/settings`,
        payload,
      )
      this.current = data.baby
      this.babies = this.babies.map((baby) => (baby.id === data.baby.id ? data.baby : baby))
      this.vaccinations = data.data
      this.vaccinationTemplate = data.template
    },

    async saveVaccination(id: number | null, payload: SaveVaccinationPayload) {
      const babyId = this.current!.id
      const { data } = id
        ? await apiClient.put(`/babies/${babyId}/vaccinations/${id}`, payload)
        : await apiClient.post(`/babies/${babyId}/vaccinations`, payload)
      const saved: Vaccination = data.data
      const others = this.vaccinations.filter((v) => v.id !== saved.id)
      this.vaccinations = sortVaccinations([...others, saved])
    },

    async deleteVaccination(id: number) {
      const previous = this.vaccinations
      this.vaccinations = this.vaccinations.filter((v) => v.id !== id)
      try {
        await apiClient.delete(`/babies/${this.current!.id}/vaccinations/${id}`)
      } catch (error) {
        this.vaccinations = previous
        throw error
      }
    },

    async saveCheckup(id: number | null, payload: SaveCheckupPayload) {
      const babyId = this.current!.id
      const { data } = id
        ? await apiClient.put(`/babies/${babyId}/checkups/${id}`, payload)
        : await apiClient.post(`/babies/${babyId}/checkups`, payload)
      const saved: Checkup = data.data
      this.checkups = [...this.checkups.filter((c) => c.id !== saved.id), saved].sort(
        (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime(),
      )
    },

    async deleteCheckup(id: number) {
      const previous = this.checkups
      this.checkups = this.checkups.filter((c) => c.id !== id)
      try {
        await apiClient.delete(`/babies/${this.current!.id}/checkups/${id}`)
      } catch (error) {
        this.checkups = previous
        throw error
      }
    },

    async fetchTemperatures() {
      if (!this.current) {
        return
      }

      const { data } = await apiClient.get(`/babies/${this.current.id}/temperatures`)
      this.temperatures = withoutPendingDeletes(
        data.data,
        this.offlineUpdates,
        this.current.id,
        'temperature',
      )
    },

    async createTemperature(payload: CreateTemperaturePayload) {
      return this.createLog('temperature', { ...payload })
    },

    async updateTemperature(id: number, payload: CreateTemperaturePayload) {
      const { data } = await apiClient.put(
        `/babies/${this.current!.id}/temperatures/${id}`,
        payload,
      )
      const entry: TimelineEntry = {
        type: 'temperature',
        at: data.data.measured_at,
        data: data.data,
      }
      this.timeline = upsertTimelineEntry(this.timeline, entry)
      this.dayTimeline = upsertTimelineEntry(this.dayTimeline, entry)
      this.temperatures = upsertByDate(this.temperatures, data.data, (t) => t.measured_at)
    },

    // Mismo borrado optimista que deleteFeed() más abajo.
    async deleteTemperature(id: number) {
      const previous = this.timeline
      const previousDay = this.dayTimeline
      const previousTemperatures = this.temperatures
      const keep = (entry: TimelineEntry) => !(entry.type === 'temperature' && entry.data.id === id)
      this.timeline = this.timeline.filter(keep)
      this.dayTimeline = this.dayTimeline.filter(keep)
      this.temperatures = this.temperatures.filter((t) => t.id !== id)

      try {
        await apiClient.delete(`/babies/${this.current!.id}/temperatures/${id}`, {
          timeout: QUEUED_WRITE_TIMEOUT_MS,
        })
      } catch (error) {
        if (isNetworkError(error)) return this.queueDelete('temperature', id)
        this.timeline = previous
        this.dayTimeline = previousDay
        this.temperatures = previousTemperatures
        throw error
      }
    },

    // Optimistic: removed from `timeline` synchronously, before the
    // request even fires - a caregiver tapping delete on a phone with a
    // slow connection used to wait through TWO round-trips in sequence
    // (the DELETE itself, then a full re-fetch of the whole timeline)
    // before anything moved on screen, reported live as "se siente
    // lento". The DELETE response already tells us the row is gone;
    // nothing here needs the extra GET just to confirm what we already
    // know. `previous` is the exact prior array (not just the removed
    // row) so a failed request restores original ordering perfectly,
    // not a best-guess re-insertion.
    async deleteFeed(id: number) {
      const previous = this.timeline
      const previousDay = this.dayTimeline
      this.timeline = this.timeline.filter(
        (entry) => !(entry.type === 'feed' && entry.data.id === id),
      )
      this.dayTimeline = this.dayTimeline.filter(
        (entry) => !(entry.type === 'feed' && entry.data.id === id),
      )

      try {
        await apiClient.delete(`/babies/${this.current!.id}/feeds/${id}`, {
          timeout: QUEUED_WRITE_TIMEOUT_MS,
        })
      } catch (error) {
        if (isNetworkError(error)) return this.queueDelete('feed', id)
        this.timeline = previous
        this.dayTimeline = previousDay
        throw error
      }
    },

    async deleteSleep(id: number) {
      const previous = this.timeline
      const previousDay = this.dayTimeline
      this.timeline = this.timeline.filter(
        (entry) => !(entry.type === 'sleep' && entry.data.id === id),
      )
      this.dayTimeline = this.dayTimeline.filter(
        (entry) => !(entry.type === 'sleep' && entry.data.id === id),
      )

      try {
        await apiClient.delete(`/babies/${this.current!.id}/sleeps/${id}`, {
          timeout: QUEUED_WRITE_TIMEOUT_MS,
        })
      } catch (error) {
        if (isNetworkError(error)) return this.queueDelete('sleep', id)
        this.timeline = previous
        this.dayTimeline = previousDay
        throw error
      }
    },

    async deleteDiaperChange(id: number) {
      const previous = this.timeline
      const previousDay = this.dayTimeline
      const previousRecent = this.recentDiaperChanges
      this.timeline = this.timeline.filter(
        (entry) => !(entry.type === 'diaper_change' && entry.data.id === id),
      )
      this.dayTimeline = this.dayTimeline.filter(
        (entry) => !(entry.type === 'diaper_change' && entry.data.id === id),
      )
      this.recentDiaperChanges = this.recentDiaperChanges.filter((c) => c.id !== id)

      try {
        await apiClient.delete(`/babies/${this.current!.id}/diaper-changes/${id}`, {
          timeout: QUEUED_WRITE_TIMEOUT_MS,
        })
      } catch (error) {
        if (isNetworkError(error)) return this.queueDelete('diaper_change', id)
        this.timeline = previous
        this.dayTimeline = previousDay
        this.recentDiaperChanges = previousRecent
        throw error
      }
    },

    async fetchGrowthMeasurements() {
      if (!this.current) {
        return
      }

      const { data } = await apiClient.get(`/babies/${this.current.id}/growth-measurements`)
      this.growthMeasurements = data.data
    },

    async fetchGrowthReference() {
      if (!this.current) {
        return
      }

      const { data } = await apiClient.get(`/babies/${this.current.id}/growth-reference`)
      this.growthReference = data.data.curves
    },

    async createGrowthMeasurement(payload: CreateGrowthMeasurementPayload) {
      const { data } = await apiClient.post(
        `/babies/${this.current!.id}/growth-measurements`,
        payload,
      )
      this.growthMeasurements = upsertByDate(
        this.growthMeasurements,
        data.data,
        (m) => m.measured_at,
      )
    },

    async updateGrowthMeasurement(id: number, payload: CreateGrowthMeasurementPayload) {
      const { data } = await apiClient.put(
        `/babies/${this.current!.id}/growth-measurements/${id}`,
        payload,
      )
      this.growthMeasurements = upsertByDate(
        this.growthMeasurements,
        data.data,
        (m) => m.measured_at,
      )
    },

    async deleteGrowthMeasurement(id: number) {
      const previous = this.growthMeasurements
      this.growthMeasurements = this.growthMeasurements.filter((m) => m.id !== id)

      try {
        await apiClient.delete(`/babies/${this.current!.id}/growth-measurements/${id}`)
      } catch (error) {
        this.growthMeasurements = previous
        throw error
      }
    },

    async fetchVitaminDSchedule() {
      if (!this.current) {
        return
      }

      const { data } = await apiClient.get(`/babies/${this.current.id}/vitamin-d-schedule`)
      this.vitaminDSchedule = data.data
      this.vitaminDRecentDoses = data.recent_doses
    },

    async upsertVitaminDSchedule(payload: {
      enabled: boolean
      start_date: string
      end_date: string
    }) {
      const { data } = await apiClient.put(
        `/babies/${this.current!.id}/vitamin-d-schedule`,
        payload,
      )
      this.vitaminDSchedule = data.data
    },

    async upsertVitaminDDose(date: string, given: boolean) {
      const { data } = await apiClient.put(`/babies/${this.current!.id}/vitamin-d-doses`, {
        date,
        given,
      })
      this.vitaminDRecentDoses = upsertByDate(this.vitaminDRecentDoses, data.data, (d) => d.date)
      this.vitaminDAllDoses = upsertByDate(this.vitaminDAllDoses, data.data, (d) => d.date)
    },

    /** Full history, unbounded by the 14-day window fetchVitaminDSchedule()
     * embeds - only Estadísticas needs this (for "dadas/días transcurridos"
     * over the whole pauta, not just the Dashboard's recent editor). */
    async fetchAllVitaminDDoses() {
      if (!this.current) {
        return
      }

      const { data } = await apiClient.get(`/babies/${this.current.id}/vitamin-d-doses`)
      this.vitaminDAllDoses = data.data
    },

    async fetchMilestones() {
      if (!this.current) {
        return
      }

      const { data } = await apiClient.get(`/babies/${this.current.id}/milestones`)
      this.milestones = data.data
    },

    async createMilestone(payload: CreateMilestonePayload) {
      const form = new FormData()
      form.append('achieved_at', payload.achieved_at)
      form.append('title', payload.title)
      if (payload.category) {
        form.append('category', payload.category)
      }
      if (payload.description) {
        form.append('description', payload.description)
      }
      if (payload.photo) {
        form.append('photo', payload.photo)
      }

      const { data } = await apiClient.post(`/babies/${this.current!.id}/milestones`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      this.milestones = upsertByDate(this.milestones, data.data, (m) => m.achieved_at)
    },

    // POST, not PUT - a multipart request carrying a replacement photo
    // needs Laravel's method-spoofing to reach a PUT route at all, since
    // PHP never parses a PUT request's multipart body into $_FILES. See
    // the matching note on this same route in api/routes/api.php.
    async updateMilestone(id: number, payload: UpdateMilestonePayload) {
      const form = new FormData()
      form.append('achieved_at', payload.achieved_at)
      form.append('title', payload.title)
      if (payload.category) {
        form.append('category', payload.category)
      }
      if (payload.description) {
        form.append('description', payload.description)
      }
      if (payload.photo) {
        form.append('photo', payload.photo)
      } else if (payload.removePhoto) {
        form.append('remove_photo', '1')
      }

      const { data } = await apiClient.post(`/babies/${this.current!.id}/milestones/${id}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      this.milestones = upsertByDate(this.milestones, data.data, (m) => m.achieved_at)
    },

    // A single toggle endpoint, not separate like/unlike actions - the
    // backend flips whatever the current user's state already is.
    async toggleMilestoneLike(id: number) {
      await apiClient.post(`/babies/${this.current!.id}/milestones/${id}/like`)
      await this.fetchMilestones()
    },

    async deleteMilestone(id: number) {
      const previous = this.milestones
      this.milestones = this.milestones.filter((m) => m.id !== id)

      try {
        await apiClient.delete(`/babies/${this.current!.id}/milestones/${id}`)
      } catch (error) {
        this.milestones = previous
        throw error
      }
    },

    async fetchSleepPrediction() {
      if (!this.current) {
        return
      }

      // La zona horaria del móvil: el servidor la necesita para saber
      // qué sueños son de noche (trabaja en UTC).
      const { data } = await apiClient.get(`/babies/${this.current.id}/sleep-prediction`, {
        params: { tz: Intl.DateTimeFormat().resolvedOptions().timeZone },
      })
      this.sleepPrediction = data.data
    },

    async fetchFeedPrediction() {
      if (!this.current) {
        return
      }

      const { data } = await apiClient.get(`/babies/${this.current.id}/feed-prediction`)
      this.feedPrediction = data.data
    },

    async fetchContractions() {
      if (!this.current) {
        return
      }

      const { data } = await apiClient.get(`/babies/${this.current.id}/contractions`)
      this.contractions = data.data
    },

    // Pushes onto the front instead of refetching the whole list - the
    // timer screen needs the new id immediately (to be able to stop
    // *this* contraction), and a full refetch would also be wasteful for
    // something that can happen every couple of minutes during labor.
    async startContraction() {
      const { data } = await apiClient.post(`/babies/${this.current!.id}/contractions`)
      this.contractions.unshift(data.data)
      return data.data as Contraction
    },

    async updateContraction(id: number, payload: UpdateContractionPayload) {
      const { data } = await apiClient.put(
        `/babies/${this.current!.id}/contractions/${id}`,
        payload,
      )
      this.contractions = this.contractions.map((c) => (c.id === id ? data.data : c))
    },

    async deleteContraction(id: number) {
      await apiClient.delete(`/babies/${this.current!.id}/contractions/${id}`)
      this.contractions = this.contractions.filter((c) => c.id !== id)
    },

    // Bulk reset for a false alarm, not a per-row action - see the
    // confirmation in DashboardView.vue's baby settings sheet.
    async deleteAllContractions() {
      await apiClient.delete(`/babies/${this.current!.id}/contractions`)
      this.contractions = []
    },

    // Returns the raw PDF as a Blob rather than triggering the download
    // itself - the API is Bearer-token auth, not cookies, so a plain
    // <a href> to this URL wouldn't carry the Authorization header; the
    // view turns this into an object URL and a temporary download link.
    async exportContractionsPdf(): Promise<Blob> {
      const { data } = await apiClient.get(`/babies/${this.current!.id}/contractions/export`, {
        responseType: 'blob',
      })
      return data
    },

    // The full history of each, for StatsView.vue - `feeds`/
    // `diaper-changes` already return everything with no `since` filter
    // (unlike `sleeps`, which defaults to the same unfiltered behavior
    // when called with none here), so no new backend endpoint was
    // needed for this. Fetched in parallel, once, when the stats page
    // mounts.
    async fetchStatsData() {
      if (!this.current) {
        return
      }

      const babyId = this.current.id
      const [sleeps, feeds, diaperChanges, temperatures] = await Promise.all([
        apiClient.get(`/babies/${babyId}/sleeps`),
        apiClient.get(`/babies/${babyId}/feeds`),
        apiClient.get(`/babies/${babyId}/diaper-changes`),
        apiClient.get(`/babies/${babyId}/temperatures`),
      ])
      this.statsSleeps = sleeps.data.data
      this.statsFeeds = feeds.data.data
      this.statsDiaperChanges = diaperChanges.data.data
      this.statsTemperatures = temperatures.data.data
    },

    // Same reasoning as exportContractionsPdf() for returning a Blob
    // instead of triggering the download itself. Unlike that one, this
    // is a POST with a body - the export doesn't recompute anything
    // server-side, it renders exactly what StatsView.vue already
    // computed (see ExportStatsRequest.php's own docblock on why: the
    // hour-bucket math needs the caregiver's real local timezone,
    // which Laravel has no way to know).
    async exportStatsPdf(payload: StatsExportPayload): Promise<Blob> {
      const { data } = await apiClient.post(`/babies/${this.current!.id}/stats/export`, payload, {
        responseType: 'blob',
      })
      return data
    },
  },
})
