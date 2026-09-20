<template>
  <el-button
    class="toolbar-action-btn toolbar-action-btn--primary"
    type="primary"
    :loading="exporting"
    :disabled="disabled"
    @click="handleExport"
  >
    导出报告
  </el-button>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { ref } from 'vue'
import { exportReportToPdf } from '../services/reportExport'

const props = withDefaults(
  defineProps<{
    disabled?: boolean
    filename?: string
    reportGeneratedDate?: string
    watermarkText?: string
    pageSelector?: string
  }>(),
  {
    disabled: false,
    filename: '巡检报告.pdf',
    reportGeneratedDate: '',
    watermarkText: '中建八局',
    pageSelector: '.a4-stack .a4-page',
  },
)

const exporting = ref(false)
const EXPORT_BUTTON_RELEASE_TIMEOUT = 20000

const handleExport = async () => {
  if (props.disabled || exporting.value) return
  exporting.value = true
  const releaseTimer = window.setTimeout(() => {
    exporting.value = false
  }, EXPORT_BUTTON_RELEASE_TIMEOUT)

  try {
    await exportReportToPdf({
      filename: props.filename,
      pageSelector: props.pageSelector,
      reportGeneratedDate: props.reportGeneratedDate,
      watermarkText: props.watermarkText,
    })
    ElMessage.success('已打开打印窗口，请选择“另存为 PDF”')
  } catch (error: any) {
    ElMessage.error(error?.message || '导出失败')
  } finally {
    window.clearTimeout(releaseTimer)
    exporting.value = false
  }
}
</script>
