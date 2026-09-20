<template>
  <el-dialog
    v-model="visible"
    :title="`扫描历史 - ${projectName}`"
    width="1180px"
    :close-on-click-modal="false"
    class="scan-calendar-dialog"
    @close="handleClose"
  >
    <div class="scan-calendar-container">
      <div class="calendar-section">
        <div class="calendar-header">
          <span class="scan-count-text">
            共 {{ scanCount }} 次扫描记录，点击日历日期查看详情
          </span>
        </div>

        <el-calendar v-model="selectedDate" class="scan-calendar">
          <template #date-cell="{ data }">
            <div
              class="calendar-day"
              :class="{
                'has-scan': hasScanOnDate(data.day),
                'is-today': isToday(data.day),
                'is-selected': isSelectedDate(data.day),
              }"
              @click="handleDateSelect(data.day)"
            >
              <div class="day-number">{{ data.day.split('-')[2] }}</div>
              <div v-if="hasScanOnDate(data.day)" class="scan-indicator">
                <div class="scan-dot">{{ getScanCountOnDate(data.day) }}</div>
              </div>
            </div>
          </template>
        </el-calendar>

        <div class="calendar-legend">
          <span class="legend-item">
            <span class="legend-box today" />
            今天
          </span>
          <span class="legend-item">
            <span class="legend-box selected" />
            已选择
          </span>
          <span class="legend-item">
            <span class="legend-dot" />
            扫描次数
          </span>
        </div>
      </div>

      <div class="scan-detail-section">
        <div v-if="selectedDateScans.length > 0" class="scan-detail-content">
          <div class="scan-detail-header">
            <div>
              <div class="scan-detail-header__title">
                {{ formatSelectedDate(selectedDate) }} 的点云列表
              </div>
              <div class="scan-detail-header__subtitle">
                共 {{ selectedDateScans.length }} 条记录
              </div>
            </div>
            <div class="scan-detail-header__count">
              {{ selectedDateScans.length }} 条
            </div>
          </div>

          <div class="scan-detail-list">
            <div
              v-for="scan in selectedDateScans"
              :key="scan.id"
              class="scan-detail-card"
            >
              <div class="scan-card-title" :title="scan.title">
                {{ scan.title }}
              </div>

              <div class="scan-card-head">
                <div class="scan-card-time">
                  {{ formatScanTime(scan.date) }}
                </div>
                <el-button
                  type="primary"
                  size="small"
                  :icon="Setting"
                  @click="handleCalibrate(scan)"
                >
                  {{ getCalibrationActionLabel(scan) }}
                </el-button>
              </div>

              <div class="scan-card-location">
                <div class="location-chip">
                  <el-icon><LocationFilled /></el-icon>
                  <span>所属幢 {{ formatSlotValue(scan.buildingName) }}</span>
                </div>
                <div class="location-chip">
                  <span>所属层 {{ formatSlotValue(scan.floorName) }}</span>
                </div>
              </div>

              <div class="scan-card-tags">
                <el-tag
                  v-if="scan.calibrated"
                  type="success"
                  size="small"
                  effect="plain"
                >
                  已完成校准
                </el-tag>
                <el-tag
                  v-if="scan.hasBimAlignment"
                  type="primary"
                  size="small"
                  effect="plain"
                >
                  BIM已校准
                </el-tag>
                <el-tag
                  v-if="scan.hasCadAlignment"
                  type="warning"
                  size="small"
                  effect="plain"
                >
                  CAD已校准
                </el-tag>
                <el-tag
                  v-if="
                    !scan.calibrated &&
                    !scan.hasBimAlignment &&
                    !scan.hasCadAlignment
                  "
                  type="info"
                  size="small"
                  effect="plain"
                >
                  待校准
                </el-tag>
              </div>
            </div>
          </div>
        </div>
        <el-empty v-else description="该日期暂无扫描记录" :image-size="120" />
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { LocationFilled, Setting } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

export interface ScanRecord {
  id: string
  title: string
  size: string
  buildingName?: string | null
  floorName?: string | null
  hasBimAlignment: boolean
  hasCadAlignment: boolean
  calibrated: boolean
  pointCloudSize: string
  trackSize: string
  date: string
}

interface Props {
  modelValue?: boolean
  projectName?: string
  scanCount?: number
  scanRecords?: Record<string, ScanRecord[]>
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'calibrate', scan: ScanRecord): void
  (e: 'delete', scanId: string): void
  (e: 'viewPointCloud', scan: ScanRecord): void
  (e: 'viewTrajectory', scan: ScanRecord): void
  (e: 'calibration', scan: ScanRecord): void
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  projectName: '',
  scanCount: 0,
  scanRecords: () => ({}),
})

const emit = defineEmits<Emits>()

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

const selectedDate = ref(new Date())
const selectedDateScans = ref<ScanRecord[]>([])

const availableDateKeys = computed(() => {
  const keys = Object.keys(props.scanRecords || {})
  return keys
    .filter((key) => (props.scanRecords?.[key]?.length || 0) > 0)
    .sort()
})

const hasScanOnDate = (date: string): boolean => {
  return (props.scanRecords?.[date]?.length || 0) > 0
}

const getScanCountOnDate = (date: string): number => {
  const records = props.scanRecords?.[date]
  return records ? records.length : 0
}

const isSelectedDate = (date: string): boolean => {
  return date === formatDate(selectedDate.value)
}

const isToday = (date: string): boolean => {
  return date === formatDate(new Date())
}

const handleDateSelect = (date: string) => {
  selectedDate.value = new Date(`${date}T00:00:00`)
  loadSelectedDateScans(date)
}

const loadSelectedDateScans = (date: string) => {
  selectedDateScans.value = props.scanRecords?.[date] || []
}

const formatDate = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formatSelectedDate = (date: Date): string => {
  return formatDate(date)
}

const formatScanTime = (value: string) => {
  const normalized = value.replace('T', ' ')
  if (!normalized.includes(' ')) return normalized.slice(0, 10)
  const time = normalized.split(' ')[1] || ''
  return time ? time.slice(0, 5) : normalized.slice(0, 10)
}

const formatSlotValue = (value?: string | null) => value || '未设置'

const handleCalibrate = (scan: ScanRecord) => {
  emit('calibrate', scan)
}

const getCalibrationActionLabel = (scan: ScanRecord) => {
  if (scan.calibrated) return '重新校准'
  if (scan.hasBimAlignment || scan.hasCadAlignment) return '继续校准'
  return '开始校准'
}

const handleClose = () => {
  visible.value = false
}

const initSelection = () => {
  const keys = availableDateKeys.value
  if (keys.length > 0) {
    const latest = keys[keys.length - 1]
    selectedDate.value = new Date(`${latest}T00:00:00`)
    loadSelectedDateScans(latest)
    return
  }

  selectedDate.value = new Date()
  selectedDateScans.value = []
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) initSelection()
  },
  { immediate: true },
)

watch(
  () => props.scanRecords,
  () => {
    if (!props.modelValue) return
    const currentKey = formatDate(selectedDate.value)
    if ((props.scanRecords?.[currentKey]?.length || 0) > 0) {
      loadSelectedDateScans(currentKey)
    } else {
      initSelection()
    }
  },
)
</script>

<style lang="scss" scoped>
.scan-calendar-dialog {
  :deep(.el-dialog__body) {
    padding: 0;
  }
}

.scan-calendar-container {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 380px;
  gap: 20px;
  min-height: 620px;
  padding: 20px;

  .calendar-section {
    display: flex;
    min-width: 0;
    flex-direction: column;

    .calendar-header {
      margin-bottom: 12px;
      padding: 8px 0;

      .scan-count-text {
        font-size: 13px;
        color: #606266;
      }
    }

    .scan-calendar {
      flex: 1;

      :deep(.el-calendar__header) {
        padding: 12px;
        border-bottom: 1px solid #e4e7ed;
      }

      :deep(.el-calendar__body) {
        padding: 12px;
      }

      :deep(.el-calendar-table) {
        .el-calendar-day {
          padding: 0;
          height: 70px;
        }
      }

      .calendar-day {
        position: relative;
        display: flex;
        width: 100%;
        height: 100%;
        cursor: pointer;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        border-radius: 8px;
        transition: all 0.25s ease;

        &:hover {
          background: #f5f7fa;
        }

        &.is-selected {
          background: #ecf5ff;
          border: 2px solid #409eff;
        }

        &.is-today {
          .day-number {
            color: #ef8738;
            font-weight: 700;
          }
        }

        .day-number {
          margin-bottom: 4px;
          font-size: 14px;
          color: #606266;
        }

        .scan-indicator {
          .scan-dot {
            display: flex;
            min-width: 20px;
            height: 20px;
            align-items: center;
            justify-content: center;
            border-radius: 999px;
            background: #2563eb;
            color: #fff;
            font-size: 11px;
            font-weight: 600;
            padding: 0 4px;
          }
        }

        &.has-scan {
          .day-number {
            color: #303133;
            font-weight: 600;
          }
        }
      }
    }

    .calendar-legend {
      display: flex;
      gap: 16px;
      margin-top: 12px;
      padding: 12px;
      background: #f5f7fa;
      border-radius: 8px;

      .legend-item {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: #606266;

        .legend-box {
          width: 16px;
          height: 16px;
          border-radius: 4px;

          &.today {
            background: #fff4e8;
            border: 1px solid #f59e0b;
          }

          &.selected {
            background: #ecf5ff;
            border: 2px solid #409eff;
          }
        }

        .legend-dot {
          width: 16px;
          height: 16px;
          border-radius: 999px;
          background: #2563eb;
        }
      }
    }
  }

  .scan-detail-section {
    display: flex;
    min-width: 0;
    flex-direction: column;
    border: 1px solid #e5edf7;
    border-radius: 16px;
    background: linear-gradient(180deg, #f8fbff 0%, #f5f7fa 100%);
    padding: 16px;

    .scan-detail-content {
      display: flex;
      min-height: 0;
      flex: 1;
      flex-direction: column;

      .scan-detail-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 16px;
        padding: 4px 0 14px;
        border-bottom: 1px solid #dbe5f0;

        .scan-detail-header__title {
          font-size: 16px;
          font-weight: 600;
          color: #1f2937;
        }

        .scan-detail-header__subtitle {
          margin-top: 6px;
          font-size: 12px;
          color: #64748b;
        }

        .scan-detail-header__count {
          flex-shrink: 0;
          border-radius: 999px;
          background: #e8f1ff;
          color: #1d4ed8;
          font-size: 12px;
          font-weight: 600;
          padding: 6px 12px;
        }
      }

      .scan-detail-list {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        padding-right: 4px;
      }

      .scan-detail-card {
        margin-bottom: 12px;
        border: 1px solid #e4eaf3;
        border-radius: 14px;
        background: rgba(255, 255, 255, 0.92);
        padding: 14px;
        box-shadow: 0 10px 24px rgba(15, 23, 42, 0.05);

        &:last-child {
          margin-bottom: 0;
        }

        .scan-card-title {
          overflow: hidden;
          margin-bottom: 10px;
          color: #111827;
          font-size: 14px;
          font-weight: 600;
          line-height: 1.45;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .scan-card-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 10px;

          .scan-card-time {
            color: #1f2937;
            font-size: 13px;
          }
        }

        .scan-card-location {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 12px;

          .location-chip {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            border-radius: 999px;
            background: #f1f5f9;
            color: #334155;
            font-size: 12px;
            padding: 6px 10px;

            .el-icon {
              color: #3b82f6;
            }
          }
        }

        .scan-card-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
      }
    }
  }
}

@media (max-width: 1200px) {
  .scan-calendar-container {
    grid-template-columns: 1fr;
  }

  .scan-calendar-container .scan-detail-section {
    max-height: 420px;
  }
}
</style>
