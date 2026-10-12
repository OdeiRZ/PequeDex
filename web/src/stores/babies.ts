import { defineStore } from 'pinia'
import { apiClient } from '@/lib/api'
import { getStoredActiveBabyId, storeActiveBabyId } from '@/lib/activeBaby'
import type { StatsExportPayload } from '@/lib/stats'
import type { GrowthReferenceCurves } from '@/lib/growthReference'
import { ALERTS_WINDOW_DAYS } from '@/lib/dailyAlerts'
import {
  endpointFor,
  isNetworkError,
  loadQueue,
  newClientUuid,
  pendingEntry,
  saveQueue,
  withPendingEntries,
  type QueuedLog,
  type QueuedLogType,
} from '@/lib/offlineQueue'

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
  /** false = la comunidad no tiene plantilla propia y se usa la común. */
  region_specific: boolean
}

export interface Checkup {
  id: number
  baby_id: number
  user_id: number
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
  user_id: number
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
  user_id: number
  started_at: string
  ended_at: string | null
  notes: string | null
}

export interface DiaperChange {
  id: number
  baby_id: number
  user_id: number
  changed_at: string
  type: DiaperType
  residue_color: DiaperResidueColor | null
  size: DiaperSize | null
  notes: string | null
}

export type TemperatureMethod = 'axila' | 'recto' | 'oido' | 'frente'

export interface Temperature {
  id: number
  baby_id: number
  user_id: number
  measured_at: string
  celsius: number
  method: TemperatureMethod | null
  notes: string | null
}

export interface GrowthMeasurement {
  id: number
  baby_id: number
  user_id: number
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
  user_id: number
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
  prediction: { type: 'wake_up' | 'next_sleep'; at: string; based_on: string } | null
}

export interface FeedPrediction {
  has_enough_data: boolean
  sample_size: number
  minimum_sample_size: number
  average_gap_minutes: number | null
  prediction: { type: 'next_feed'; at: string; based_on: string } | null
}

export interface Contraction {
  id: number
  baby_id: number
  user_id: number
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
  recentDiaperChanges: DiaperChange[]
  /** Registros creados sin conexión, pendientes de enviar
   * (lib/offlineQueue.ts). Persistidos en el propio móvil. */
  offlineQueue: QueuedLog[]
  flushingQueue: boolean
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
    flushingQueue: false,
    vaccinations: [],
    vaccinationTemplate: null,
    checkups: [],
    vitaminDSchedule: null,
    vitaminDRecentDoses: [],
    vitaminDAllDoses: [],
  }),

  actions: {
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

    async fetchTimeline() {
      if (!this.current) {
        return
      }

      const { data } = await apiClient.get(`/babies/${this.current.id}/timeline`)
      // Lo que sigue en la cola sin conexión no viene del servidor:
      // se vuelve a añadir para que no desaparezca en cada sondeo.
      this.timeline = withPendingEntries(data.data, this.offlineQueue, this.current.id)
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
      this.dayTimeline = data.data
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
        const { data } = await apiClient.post(endpointFor(log), {
          ...payload,
          client_uuid: log.clientUuid,
        })
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
      if (this.flushingQueue || this.offlineQueue.length === 0) return { sent: 0, rejected: 0 }
      this.flushingQueue = true
      let sent = 0
      let rejected = 0
      try {
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
            if (isNetworkError(error)) break
            this.removeQueued(log.clientUuid)
            rejected++
          }
        }
      } finally {
        this.flushingQueue = false
      }
      return { sent, rejected }
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

    async updateFeed(id: number, payload: CreateFeedPayload) {
      const { data } = await apiClient.put(`/babies/${this.current!.id}/feeds/${id}`, payload)
      const entry: TimelineEntry = { type: 'feed', at: data.data.started_at, data: data.data }
      this.timeline = upsertTimelineEntry(this.timeline, entry)
      this.dayTimeline = upsertTimelineEntry(this.dayTimeline, entry)
    },

    async createSleep(payload: CreateSleepPayload) {
      return this.createLog('sleep', { ...payload })
    },

    async updateSleep(id: number, payload: CreateSleepPayload) {
      const { data } = await apiClient.put(`/babies/${this.current!.id}/sleeps/${id}`, payload)
      const entry: TimelineEntry = { type: 'sleep', at: data.data.started_at, data: data.data }
      this.timeline = upsertTimelineEntry(this.timeline, entry)
      this.dayTimeline = upsertTimelineEntry(this.dayTimeline, entry)
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
        params: { since },
      })
      this.recentDiaperChanges = data.data
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
      this.temperatures = data.data
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
        await apiClient.delete(`/babies/${this.current!.id}/temperatures/${id}`)
      } catch (error) {
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
        await apiClient.delete(`/babies/${this.current!.id}/feeds/${id}`)
      } catch (error) {
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
        await apiClient.delete(`/babies/${this.current!.id}/sleeps/${id}`)
      } catch (error) {
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
        await apiClient.delete(`/babies/${this.current!.id}/diaper-changes/${id}`)
      } catch (error) {
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

      const { data } = await apiClient.get(`/babies/${this.current.id}/sleep-prediction`)
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
