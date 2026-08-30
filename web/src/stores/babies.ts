import { defineStore } from 'pinia'
import { apiClient } from '@/lib/api'

export interface Baby {
  id: number
  name: string | null
  due_date: string | null
  birth_date: string | null
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

interface BabiesState {
  current: Baby | null
  timeline: TimelineEntry[]
}

export const useBabiesStore = defineStore('babies', {
  state: (): BabiesState => ({
    current: null,
    timeline: [],
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

    async createSleep(payload: CreateSleepPayload) {
      await apiClient.post(`/babies/${this.current!.id}/sleeps`, payload)
      await this.fetchTimeline()
    },

    async createDiaperChange(payload: CreateDiaperChangePayload) {
      await apiClient.post(`/babies/${this.current!.id}/diaper-changes`, payload)
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
  },
})
