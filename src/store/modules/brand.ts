import { defineStore } from 'pinia'
import pinia from '@/store'
import { getCurrentOrganization } from '@/api/user'

const DEFAULT_LOGO_URL = '/images/LOGO.png'

export const useBrandStore = defineStore('brand', {
  state: () => ({
    logoUrl: DEFAULT_LOGO_URL,
    defaultLogoUrl: DEFAULT_LOGO_URL,
    loading: false
  }),

  actions: {
    resolveLogoUrl(logoUrl?: string | null) {
      this.logoUrl = logoUrl?.trim() || DEFAULT_LOGO_URL
    },

    async fetchBrand() {
      try {
        this.loading = true
        const res = await getCurrentOrganization()
        this.resolveLogoUrl(res?.data?.logoUrl)
      } catch (_error) {
        this.resolveLogoUrl()
      } finally {
        this.loading = false
      }
    }
  }
})

export function useBrandStoreHook() {
  return useBrandStore(pinia)
}
