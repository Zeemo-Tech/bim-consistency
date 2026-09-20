export const waitForNextFrame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

export const useCadRenderScheduler = <T extends { Render?: () => void }>(
  getViewer: () => T | null,
  isInactive: () => boolean,
) => {
  let cadRenderRafId: number | null = null

  const requestCadRender = () => {
    if (isInactive()) return

    const viewer = getViewer()
    if (!viewer || cadRenderRafId !== null) return

    cadRenderRafId = requestAnimationFrame(() => {
      cadRenderRafId = null
      if (isInactive()) return

      const activeViewer = getViewer()
      if (!activeViewer) return

      try {
        activeViewer.Render?.()
      } catch (error) {
        console.warn('CAD 渲染失败:', error)
      }
    })
  }

  const cancelCadRender = () => {
    if (cadRenderRafId !== null) {
      cancelAnimationFrame(cadRenderRafId)
      cadRenderRafId = null
    }
  }

  return {
    requestCadRender,
    cancelCadRender,
  }
}
