import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import pinia from '@/store'

export const useReportAccessStore = defineStore('report-access', () => {
  const activeProjectId = ref<number | null>(null)
  const activeScanFileId = ref<number | null>(null)

  const reportModuleVisible = computed(() =>
    Boolean(activeProjectId.value && activeScanFileId.value),
  )

  const activateForProject = (projectId: number, scanFileId: number) => {
    if (!Number.isFinite(projectId) || projectId <= 0) return
    if (!Number.isFinite(scanFileId) || scanFileId <= 0) return
    activeProjectId.value = projectId
    activeScanFileId.value = scanFileId
  }

  const clear = () => {
    activeProjectId.value = null
    activeScanFileId.value = null
  }

  const isActiveProject = (projectId: number | null | undefined) => {
    if (!projectId || !activeProjectId.value) return false
    return activeProjectId.value === projectId
  }

  return {
    activeProjectId,
    activeScanFileId,
    reportModuleVisible,
    activateForProject,
    isActiveProject,
    clear,
  }
})

export function useReportAccessStoreHook() {
  return useReportAccessStore(pinia)
}
