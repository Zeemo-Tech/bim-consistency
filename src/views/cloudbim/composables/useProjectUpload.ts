import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { MeshRemeshSummary } from '@/api/fileManage'
import type { UploadFormData } from '@/views/data/history-model/components/UploadDialog.vue'

type ProjectFileType = 'scan' | 'bim' | 'cad' | 'gauss'

interface UseProjectUploadOptions {
  onUploaded?: (projectId: number) => void
}

/**
 * 复用文件管理模块的上传弹窗与上传编排逻辑。
 * 页面只需挂载 <UploadDialog> 并绑定这里返回的 ref / 事件处理器。
 */
export function useProjectUpload(options: UseProjectUploadOptions = {}) {
  const uploadDialogRef = ref<any>(null)
  const uploadDialogVisible = ref(false)
  const currentUploader = ref<any | null>(null)

  const getRemeshStatusLabel = (meshRemesh?: MeshRemeshSummary) => {
    if (!meshRemesh?.supported) return '当前文件不支持网格均匀化'
    const textMap: Record<string, string> = {
      queued: '已进入均匀化队列',
      processing: '均匀化处理中',
      succeeded: '均匀化已完成',
      failed: '均匀化失败',
    }
    return textMap[meshRemesh.status || ''] || '均匀化状态未知'
  }

  const openUpload = () => {
    uploadDialogVisible.value = true
  }

  const handlePauseUpload = () => {
    if (currentUploader.value) {
      currentUploader.value.pause()
      ElMessage.info('上传已暂停，您可以稍后继续上传')
      uploadDialogRef.value?.setUploadPaused?.()
    }
  }

  const handleResumeUpload = async () => {
    if (currentUploader.value && currentUploader.value.getUploadId()) {
      try {
        uploadDialogRef.value?.setUploading?.(true)
        uploadDialogRef.value?.setUploadPhase?.('uploading')
        await currentUploader.value.resume()
      } catch (error: any) {
        console.error('继续上传失败:', error)
        uploadDialogRef.value?.setUploadFailed?.(
          error.message || '继续上传失败',
        )
        ElMessage.error(error.message || '继续上传失败')
      }
    } else {
      ElMessage.warning('没有可继续的上传任务')
    }
  }

  const handleUploadConfirm = async (data: UploadFormData) => {
    if (!data.file) {
      ElMessage.warning('请选择要上传的文件')
      return
    }

    if (!data.projectId) {
      ElMessage.warning('请选择项目')
      return
    }

    uploadDialogRef.value?.setUploading?.(true)

    try {
      const normalizeUploadSlotName = (value?: string) => value?.trim()

      const typeMap: Record<string, ProjectFileType> = {
        BIM: 'bim',
        CAD: 'cad',
        scan: 'scan',
        gauss: 'gauss',
      }

      const fileType = typeMap[data.fileType] || 'scan'

      const { FileUploader } = await import('@/utils/upload')

      const resumeUploadState = uploadDialogRef.value?.resumeUploadState?.value
      const uploader = new FileUploader({
        projectId: data.projectId,
        type: fileType,
        file: data.file,
        buildingName: ['bim', 'cad', 'scan', 'gauss'].includes(fileType)
          ? normalizeUploadSlotName(data.buildingName)
          : undefined,
        floorName: ['cad', 'scan', 'gauss'].includes(fileType)
          ? normalizeUploadSlotName(data.floorName)
          : undefined,
        producedAt: fileType === 'scan' ? data.producedAt : undefined,
        description: data.description,
        resumeFromState:
          uploadDialogRef.value?.isResumingUpload?.value || false,
        existingUploadId: resumeUploadState?.uploadId,
        existingFileHash: resumeUploadState?.fileHash,
        onHashProgress: (progress) =>
          uploadDialogRef.value?.setHashProgress?.(progress),
        onPhaseChange: (phase) =>
          uploadDialogRef.value?.setUploadPhase?.(phase),
        onProgress: (progress) =>
          uploadDialogRef.value?.setProgress?.(progress),
        onChunkProgress: (state) =>
          uploadDialogRef.value?.setChunkProgress?.(state),
        onSuccess: (fileInfo) => {
          if (fileInfo.meshRemesh?.supported) {
            ElMessage.success(
              `文件上传成功，${getRemeshStatusLabel(fileInfo.meshRemesh)}`,
            )
          } else {
            ElMessage.success('文件上传成功')
          }
          uploadDialogRef.value?.setUploading?.(false)
          void uploadDialogRef.value?.reloadProjectBuildings?.(
            data.projectId,
            true,
          )
          uploadDialogRef.value?.close?.()
          currentUploader.value = null
          options.onUploaded?.(data.projectId)
        },
        onError: () => {},
      })

      currentUploader.value = uploader
      await uploader.start()
    } catch (error: any) {
      if (error?.message === '上传已取消') return

      console.error('上传失败:', error)
      const errorMessage = error.message || '文件上传失败'

      if (
        error.message?.includes('已存在') ||
        error.message?.includes('正在上传')
      ) {
        ElMessage({
          type: 'warning',
          message: errorMessage,
          duration: 5000,
          showClose: true,
        })
      } else {
        uploadDialogRef.value?.setUploadFailed?.(errorMessage)
        ElMessage.error(errorMessage)
      }

      currentUploader.value = null
    }
  }

  return {
    uploadDialogRef,
    uploadDialogVisible,
    openUpload,
    handleUploadConfirm,
    handlePauseUpload,
    handleResumeUpload,
  }
}
