import { defineStore } from 'pinia'
import { apiClient } from '@/lib/api'

export type BabySex = 'nino' | 'nina'

export interface Baby {
  id: number
  name: string | null
  due_date: string | null
  birth_date: string | null
  sex: BabySex | null
  invite_code: string
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
}

interface BabiesState {
  current: Baby | null
  timeline: TimelineEntry[]
  growthMeasurements: GrowthMeasurement[]
  milestones: Milestone[]
  sleepPrediction: SleepPrediction | null
}

export const useBabiesStore = defineStore('babies', {
  state: (): BabiesState => ({
    current: null,
    timeline: [],
    growthMeasurements: [],
    milestones: [],
    sleepPrediction: null,
  }),

  actions: {
    /** Loads the user's own baby, if any - there's normally at most one. */
    async fetchCurrent() {
      const { data } = await apiClient.get('/babies')
      this.current = data.data[0] ?? null
    },

    async create(payload: { name?: string; due_date?: string }) {
      const { data } = await apiClient.post('/babies', payload)
      this.current = data.data
    },

    async join(inviteCode: string) {
      const { data } = await apiClient.post('/babies/join', { invite_code: inviteCode })
      this.current = data.data
    },

    async updateBaby(payload: UpdateBabyPayload) {
      const { data } = await apiClient.put(`/babies/${this.current!.id}`, payload)
      this.current = data.data
    },

    async regenerateInviteCode() {
      if (!this.current) {
        return
      }

      const { data } = await apiClient.post(`/babies/${this.current.id}/invite-code`)
      this.current = data.data
    },

    async fetchTimeline() {
      if (!this.current) {
        return
      }

      const { data } = await apiClient.get(`/babies/${this.current.id}/timeline`)
      this.timeline = data.data
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
  },
})
