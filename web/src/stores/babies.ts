import { defineStore } from 'pinia'
import { apiClient } from '@/lib/api'
import { getStoredActiveBabyId, storeActiveBabyId } from '@/lib/activeBaby'

export type BabySex = 'nino' | 'nina'

export interface Baby {
  id: number
  name: string | null
  due_date: string | null
  birth_date: string | null
  sex: BabySex | null
  invite_code: string
  water_broke_at: string | null
}

export type FeedType = 'pecho' | 'biberon' | 'solido'
export type FeedSide = 'izquierdo' | 'derecho' | 'ambos'
export type DiaperType = 'mojado' | 'sucio' | 'ambos'

export interface Feed {
  id: number
  baby_id: number
  user_id: number
  type: FeedType
  side: FeedSide | null
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

export type TimelineEntry =
  | { type: 'feed'; at: string; data: Feed }
  | { type: 'sleep'; at: string; data: Sleep }
  | { type: 'diaper_change'; at: string; data: DiaperChange }

interface CreateFeedPayload {
  type: FeedType
  side?: FeedSide
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
  milestones: Milestone[]
  sleepPrediction: SleepPrediction | null
  feedPrediction: FeedPrediction | null
  recentSleeps: Sleep[]
  contractions: Contraction[]
}

export const useBabiesStore = defineStore('babies', {
  state: (): BabiesState => ({
    current: null,
    babies: [],
    timeline: [],
    dayTimeline: [],
    growthMeasurements: [],
    milestones: [],
    sleepPrediction: null,
    feedPrediction: null,
    recentSleeps: [],
    contractions: [],
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

    async create(payload: { name?: string; due_date?: string }) {
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
      const { data } = await apiClient.put(`/babies/${this.current!.id}`, payload)
      this.current = data.data
      this.babies = this.babies.map((baby) => (baby.id === data.data.id ? data.data : baby))
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
      this.timeline = data.data
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

    async createFeed(payload: CreateFeedPayload) {
      await apiClient.post(`/babies/${this.current!.id}/feeds`, payload)
      await this.fetchTimeline()
    },

    async updateFeed(id: number, payload: CreateFeedPayload) {
      await apiClient.put(`/babies/${this.current!.id}/feeds/${id}`, payload)
      await this.fetchTimeline()
    },

    async createSleep(payload: CreateSleepPayload) {
      await apiClient.post(`/babies/${this.current!.id}/sleeps`, payload)
      await this.fetchTimeline()
    },

    async updateSleep(id: number, payload: CreateSleepPayload) {
      await apiClient.put(`/babies/${this.current!.id}/sleeps/${id}`, payload)
      await this.fetchTimeline()
    },

    async createDiaperChange(payload: CreateDiaperChangePayload) {
      await apiClient.post(`/babies/${this.current!.id}/diaper-changes`, payload)
      await this.fetchTimeline()
    },

    async updateDiaperChange(id: number, payload: CreateDiaperChangePayload) {
      await apiClient.put(`/babies/${this.current!.id}/diaper-changes/${id}`, payload)
      await this.fetchTimeline()
    },

    async deleteFeed(id: number) {
      await apiClient.delete(`/babies/${this.current!.id}/feeds/${id}`)
      await this.fetchTimeline()
    },

    async deleteSleep(id: number) {
      await apiClient.delete(`/babies/${this.current!.id}/sleeps/${id}`)
      await this.fetchTimeline()
    },

    async deleteDiaperChange(id: number) {
      await apiClient.delete(`/babies/${this.current!.id}/diaper-changes/${id}`)
      await this.fetchTimeline()
    },

    async fetchGrowthMeasurements() {
      if (!this.current) {
        return
      }

      const { data } = await apiClient.get(`/babies/${this.current.id}/growth-measurements`)
      this.growthMeasurements = data.data
    },

    async createGrowthMeasurement(payload: CreateGrowthMeasurementPayload) {
      await apiClient.post(`/babies/${this.current!.id}/growth-measurements`, payload)
      await this.fetchGrowthMeasurements()
    },

    async updateGrowthMeasurement(id: number, payload: CreateGrowthMeasurementPayload) {
      await apiClient.put(`/babies/${this.current!.id}/growth-measurements/${id}`, payload)
      await this.fetchGrowthMeasurements()
    },

    async deleteGrowthMeasurement(id: number) {
      await apiClient.delete(`/babies/${this.current!.id}/growth-measurements/${id}`)
      await this.fetchGrowthMeasurements()
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

      await apiClient.post(`/babies/${this.current!.id}/milestones`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      await this.fetchMilestones()
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

      await apiClient.post(`/babies/${this.current!.id}/milestones/${id}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      await this.fetchMilestones()
    },

    // A single toggle endpoint, not separate like/unlike actions - the
    // backend flips whatever the current user's state already is.
    async toggleMilestoneLike(id: number) {
      await apiClient.post(`/babies/${this.current!.id}/milestones/${id}/like`)
      await this.fetchMilestones()
    },

    async deleteMilestone(id: number) {
      await apiClient.delete(`/babies/${this.current!.id}/milestones/${id}`)
      await this.fetchMilestones()
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

    // `days` is a lookback window, not the number of days the chart ends
    // up showing (see summarizeSleepByDay) - a couple of days' buffer so
    // an overnight sleep that started just before the chart's own first
    // day still gets counted, instead of being cut off at the fetch
    // boundary.
    async fetchRecentSleeps(days = 9) {
      if (!this.current) {
        return
      }

      const since = new Date()
      since.setDate(since.getDate() - days)
      const sinceParam = since.toISOString().slice(0, 10)

      const { data } = await apiClient.get(`/babies/${this.current.id}/sleeps`, {
        params: { since: sinceParam },
      })
      this.recentSleeps = data.data
    },
  },
})
