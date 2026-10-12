<template>
  <el-dialog
    :model-value="modelValue"
    width="960px"
    top="6vh"
    class="member-picker-dialog"
    :close-on-click-modal="false"
    @update:model-value="handleVisibleChange"
  >
    <template #header>
      <div class="mp-header">
        <div class="mp-title">邀请成员查看批注</div>
        <div class="mp-subtitle">邀请项目成员协助处理当前批注</div>
      </div>
    </template>

    <!-- 当前批注上下文 -->
    <div class="mp-context">
      <span class="mp-context__target" aria-hidden="true" />
      <span class="mp-context__label">当前批注</span>
      <span class="mp-context__no">{{ currentAnnotationNo }}</span>
      <span
        v-if="currentSeverityLabel"
        class="mp-context__risk"
        :class="`is-${currentSeverity}`"
      >
        {{ currentSeverityLabel }}
      </span>
    </div>

    <div class="mp-body">
      <!-- 左：批注选择 + 成员 -->
      <section class="mp-col mp-col--main">
        <div class="mp-field">
          <label class="mp-label">选择批注</label>
          <el-select
            :model-value="localSelectedAnnotationKeys"
            class="mp-select"
            multiple
            collapse-tags
            collapse-tags-tooltip
            :max-collapse-tags="3"
            filterable
            placeholder="请选择需要邀请查看的批注"
            @update:model-value="handleAnnotationChange"
          >
            <el-option
              v-for="item in annotationOptions"
              :key="item.key"
              :label="item.title || '未命名批注'"
              :value="item.key"
            />
          </el-select>
        </div>

        <el-input
          v-model="keyword"
          class="mp-search"
          placeholder="搜索姓名、邮箱或手机号"
          clearable
          @clear="handleSearch"
          @keyup.enter="handleSearch"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>

        <div class="mp-list-head">
          <span class="mp-label">项目成员</span>
          <span class="mp-list-count">{{ total }} 位成员</span>
        </div>

        <div v-loading="memberLoading" class="mp-list">
          <el-empty
            v-if="!memberLoading && memberList.length === 0"
            description="暂无可邀请成员"
            :image-size="72"
          />
          <button
            v-for="member in memberList"
            v-else
            :key="member.userId"
            type="button"
            class="mp-member"
            :class="{ 'is-selected': isSelected(member.userId) }"
            @click="toggleMember(member)"
          >
            <el-checkbox
              :model-value="isSelected(member.userId)"
              @update:model-value="toggleMember(member)"
              @click.stop
            />
            <span class="mp-member__avatar">{{ memberInitial(member) }}</span>
            <span class="mp-member__info">
              <span class="mp-member__top">
                <span class="mp-member__name">
                  {{ getMemberDisplayName(member) }}
                  <span v-if="isCurrentAccount(member)" class="mp-member__self">
                    本人
                  </span>
                </span>
                <span class="mp-member__role">
                  {{ member.roleName || '未设置角色' }}
                </span>
              </span>
              <span class="mp-member__sub">{{ member.email || '-' }}</span>
            </span>
          </button>
        </div>

        <div class="mp-pagination">
          <el-pagination
            background
            layout="prev, pager, next, total"
            :total="total"
            :page-size="pageSize"
            :current-page="page"
            @current-change="handlePageChange"
          />
        </div>
      </section>

      <!-- 右：已选成员 + 邀请消息 -->
      <section class="mp-col mp-col--side">
        <div class="mp-card mp-card--selected">
          <div class="mp-card__head">
            <span class="mp-card__title">已选择成员</span>
            <span class="mp-card__count">{{ selectedMembers.length }} 人</span>
          </div>
          <div v-if="!selectedMembers.length" class="mp-selected-empty">
            <el-icon class="mp-selected-empty__icon"><UserFilled /></el-icon>
            <span>选择成员后将在这里显示</span>
          </div>
          <div v-else class="mp-chips">
            <span
              v-for="member in selectedMembers"
              :key="member.userId"
              class="mp-chip"
            >
              {{ getMemberDisplayName(member) }}
              <button
                type="button"
                class="mp-chip__remove"
                :aria-label="`移除 ${getMemberDisplayName(member)}`"
                @click="toggleMember(member)"
              >
                <el-icon><Close /></el-icon>
              </button>
            </span>
          </div>
        </div>

        <div class="mp-card mp-card--message">
          <div class="mp-card__head">
            <span class="mp-card__title">邀请消息（可选）</span>
          </div>
          <el-input
            v-model="messageText"
            class="mp-textarea"
            type="textarea"
            :rows="6"
            resize="none"
            maxlength="300"
            show-word-limit
            placeholder="请输入邀请消息"
          />
          <p class="mp-note">
            <el-icon><InfoFilled /></el-icon>
            留空将使用默认邀请内容
          </p>
        </div>
      </section>
    </div>

    <template #footer>
      <div class="mp-footer">
        <el-button text class="mp-cancel" @click="handleCancel">取消</el-button>
        <el-button
          type="primary"
          class="mp-submit"
          :disabled="!canSubmit"
          :loading="submitting"
          @click="handleSubmit"
        >
          发送邀请
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Close, InfoFilled, Search, UserFilled } from '@element-plus/icons-vue'
import {
  getProjectMembersForPicker,
  type ProjectMemberItem,
} from '@/api/notification'
import { getCurrentUser } from '@/api/user'
import { useUserStoreHook } from '@/store/modules/user'

interface Props {
  modelValue: boolean
  projectId: number | null
  annotationOptions?: AnnotationOption[]
  selectedAnnotationKeys?: string[]
  selectedAnnotationKey?: string
  annotationTitle?: string
  submitting?: boolean
}

interface AnnotationOption {
  key: string
  title: string
  severity?: string
  period?: string[]
}

interface SubmitPayload {
  annotationKeys: string[]
  memberIds: number[]
  members: ProjectMemberItem[]
  message: string
}

const props = withDefaults(defineProps<Props>(), {
  annotationOptions: () => [],
  selectedAnnotationKeys: () => [],
  selectedAnnotationKey: '',
  annotationTitle: '',
  submitting: false,
})

const emit = defineEmits<{
  'update:modelValue': [boolean]
  'update:selectedAnnotationKeys': [string[]]
  'update:selectedAnnotationKey': [string]
  submit: [SubmitPayload]
}>()

const userStore = useUserStoreHook()
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const keyword = ref('')
const memberLoading = ref(false)
const memberList = ref<ProjectMemberItem[]>([])
const messageText = ref('')
const localSelectedAnnotationKeys = ref<string[]>([])
const lastTemplate = ref('')
const currentAccountUsername = ref('')

const selectedMap = ref(new Map<number, ProjectMemberItem>())

const selectedMembers = computed(() => Array.from(selectedMap.value.values()))
const annotationOptions = computed(() => props.annotationOptions ?? [])
const fallbackAccountUsername = computed(() =>
  String(userStore.username || '').trim(),
)
const selectedAnnotations = computed(() => {
  if (!localSelectedAnnotationKeys.value.length) return []
  const keySet = new Set(localSelectedAnnotationKeys.value)
  return annotationOptions.value.filter((item) => keySet.has(item.key))
})
const selectedAnnotationTitles = computed(() => {
  return selectedAnnotations.value.map(
    (item) => item.title?.trim() || '未命名批注',
  )
})
const currentAnnotation = computed(() => {
  const key = localSelectedAnnotationKeys.value[0]
  if (!key) return null
  return annotationOptions.value.find((item) => item.key === key) ?? null
})
const currentAnnotationNo = computed(() => {
  const key = localSelectedAnnotationKeys.value[0]
  if (!key) return '—'
  const index = annotationOptions.value.findIndex((item) => item.key === key)
  return index >= 0 ? `#${index + 1}` : '—'
})
const currentSeverity = computed(() => {
  const raw = currentAnnotation.value?.severity
  return raw === 'high' || raw === 'medium' || raw === 'low' ? raw : ''
})
const currentSeverityLabel = computed(() => {
  if (currentSeverity.value === 'high') return '高风险'
  if (currentSeverity.value === 'medium') return '中风险'
  if (currentSeverity.value === 'low') return '低风险'
  return ''
})
const canSubmit = computed(
  () =>
    localSelectedAnnotationKeys.value.length > 0 &&
    selectedMembers.value.length > 0 &&
    !props.submitting,
)

const defaultMessageTemplate = computed(() => {
  if (!selectedAnnotationTitles.value.length) {
    return '你好，请查看批注，并协助确认处理意见。'
  }
  if (selectedAnnotationTitles.value.length === 1) {
    return `你好，请查看批注「${selectedAnnotationTitles.value[0]}」，并协助确认处理意见。`
  }
  const preview = selectedAnnotationTitles.value.slice(0, 3).join('、')
  const suffix = selectedAnnotationTitles.value.length > 3 ? '等' : ''
  return `你好，请查看 ${selectedAnnotationTitles.value.length} 条批注（${preview}${suffix}），并协助确认处理意见。`
})

const isSelected = (userId: number) => selectedMap.value.has(userId)
const getMemberDisplayName = (member: ProjectMemberItem) =>
  member.displayName || member.username || member.email || '-'

/** 头像首字母（中文取姓，英文取首字母）。 */
const memberInitial = (member: ProjectMemberItem) => {
  const name = getMemberDisplayName(member).trim()
  return name ? name.slice(0, 1).toUpperCase() : '?'
}

const isCurrentAccount = (member: ProjectMemberItem) => {
  const accountUsername = String(currentAccountUsername.value || '').trim()
  if (!accountUsername) return false
  const memberUsername = String(member.username || '').trim()
  return memberUsername === accountUsername
}

const handleVisibleChange = (visible: boolean) => {
  emit('update:modelValue', visible)
}

const normalizeAnnotationKeys = (keys: string[]) => {
  const validKeySet = new Set(annotationOptions.value.map((item) => item.key))
  const deduped = Array.from(
    new Set(keys.map((item) => item.trim()).filter((item) => item.length > 0)),
  )
  return deduped.filter((item) => validKeySet.has(item))
}

const syncSelectedAnnotationFromProps = () => {
  const sourceKeys = props.selectedAnnotationKeys?.length
    ? [...props.selectedAnnotationKeys]
    : props.selectedAnnotationKey
      ? [props.selectedAnnotationKey]
      : []
  const normalized = normalizeAnnotationKeys(sourceKeys)
  const fallbackKey = annotationOptions.value[0]?.key
  const nextKeys =
    normalized.length > 0 ? normalized : fallbackKey ? [fallbackKey] : []
  localSelectedAnnotationKeys.value = nextKeys
}

const syncMessageTemplate = (force = false) => {
  const template = defaultMessageTemplate.value
  if (
    force ||
    !messageText.value.trim() ||
    messageText.value === lastTemplate.value
  ) {
    messageText.value = template
  }
  lastTemplate.value = template
}

const resetDialogState = () => {
  page.value = 1
  total.value = 0
  keyword.value = ''
  memberList.value = []
  selectedMap.value = new Map<number, ProjectMemberItem>()
  syncSelectedAnnotationFromProps()
  syncMessageTemplate(true)
}

const loadCurrentAccount = async () => {
  const fallback = fallbackAccountUsername.value
  currentAccountUsername.value = fallback
  try {
    const res = await getCurrentUser()
    if (res.code !== 200) {
      throw new Error(res.msg || '获取当前账号失败')
    }
    const remoteUsername = String(res.data?.username || '').trim()
    currentAccountUsername.value = remoteUsername || fallback
  } catch (error) {}
}

const loadMembers = async () => {
  if (!props.projectId) {
    memberList.value = []
    total.value = 0
    return
  }

  memberLoading.value = true
  try {
    const res = await getProjectMembersForPicker(props.projectId, {
      page: page.value,
      pageSize: pageSize.value,
      keyword: keyword.value.trim() || undefined,
    })
    if (res.code !== 200) {
      throw new Error(res.msg || '成员加载失败')
    }
    memberList.value = res.data.list || []
    total.value = res.data.total || 0
  } catch (error: any) {
    memberList.value = []
    total.value = 0
    ElMessage.error(error?.message || '成员加载失败')
  } finally {
    memberLoading.value = false
  }
}

const handleSearch = () => {
  page.value = 1
  void loadMembers()
}

const handlePageChange = (nextPage: number) => {
  page.value = nextPage
  void loadMembers()
}

const toggleMember = (member: ProjectMemberItem) => {
  if (selectedMap.value.has(member.userId)) {
    selectedMap.value.delete(member.userId)
  } else {
    selectedMap.value.set(member.userId, member)
  }
  selectedMap.value = new Map(selectedMap.value)
}

const clearSelected = () => {
  selectedMap.value = new Map<number, ProjectMemberItem>()
}

const handleCancel = () => {
  emit('update:modelValue', false)
}

const handleAnnotationChange = (value: Array<string | number | boolean>) => {
  const normalized = normalizeAnnotationKeys(
    (value || [])
      .map((item) => String(item ?? ''))
      .filter((item) => item.length > 0),
  )
  localSelectedAnnotationKeys.value = normalized
  emit('update:selectedAnnotationKeys', [...normalized])
  emit('update:selectedAnnotationKey', normalized[0] ?? '')
  syncMessageTemplate()
}

const handleSubmit = () => {
  if (!localSelectedAnnotationKeys.value.length) {
    ElMessage.warning('请至少选择一条批注')
    return
  }
  if (selectedMembers.value.length === 0) {
    ElMessage.warning('请至少选择一个成员')
    return
  }

  emit('submit', {
    annotationKeys: [...localSelectedAnnotationKeys.value],
    memberIds: selectedMembers.value.map((item) => item.userId),
    members: selectedMembers.value,
    message: messageText.value.trim() || defaultMessageTemplate.value,
  })
}

watch(
  () => props.modelValue,
  (visible) => {
    if (!visible) return
    resetDialogState()
    void Promise.all([loadCurrentAccount(), loadMembers()])
  },
)

watch(
  () => [
    props.annotationTitle,
    props.selectedAnnotationKey,
    props.selectedAnnotationKeys,
    props.annotationOptions,
  ],
  () => {
    syncSelectedAnnotationFromProps()
    if (props.modelValue) syncMessageTemplate()
  },
  { deep: true },
)

watch(
  () => props.projectId,
  () => {
    if (!props.modelValue) return
    page.value = 1
    void loadMembers()
  },
)
</script>

<style scoped lang="scss">
:deep(.el-dialog) {
  padding: 0;
  overflow: hidden;
  border-radius: var(--radius-md);
  background: var(--bg-card);
}

:deep(.el-dialog__header) {
  margin-right: 0;
  padding: 20px 24px 12px;
}

:deep(.el-dialog__body) {
  padding: 0 24px 6px;
}

:deep(.el-dialog__footer) {
  padding: 14px 24px;
  border-top: 1px solid var(--border-color-light);
}

:deep(.el-dialog__headerbtn) {
  top: 18px;
  right: 18px;
}

/* 头部 */
.mp-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.mp-title {
  color: var(--text-primary);
  font-size: var(--font-size-md);
  font-weight: 650;
  line-height: 1.3;
}

.mp-subtitle {
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
}

/* 当前批注上下文条 */
.mp-context {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: var(--spacing-compact);
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  background: var(--color-primary-soft);
}

.mp-context__target {
  position: relative;
  width: 15px;
  height: 15px;
  border: 2px solid var(--color-primary);
  border-radius: 50%;

  &::after {
    content: '';
    position: absolute;
    inset: 3px;
    border-radius: 50%;
    background: var(--color-primary);
  }
}

.mp-context__label {
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  font-weight: 600;
}

.mp-context__no {
  padding: 1px 8px;
  border-radius: var(--radius-pill);
  color: #fff;
  background: var(--color-primary);
  font-size: var(--font-size-xs);
  font-weight: 600;
}

.mp-context__risk {
  padding: 1px 8px;
  border-radius: var(--radius-xs);
  font-size: var(--font-size-xs);
  font-weight: 600;
}

.mp-context__risk.is-high {
  color: var(--color-danger);
  background: var(--color-danger-soft);
}

.mp-context__risk.is-medium {
  color: var(--color-warning);
  background: var(--color-warning-soft);
}

.mp-context__risk.is-low {
  color: var(--color-success);
  background: var(--color-success-soft);
}

/* 两栏主体 */
.mp-body {
  display: flex;
  gap: var(--spacing-lg);
  height: min(58vh, 500px);
  min-height: 340px;
}

.mp-col {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.mp-col--main {
  flex: 1 1 auto;
  gap: var(--spacing-compact);
}

.mp-col--side {
  flex: 0 0 340px;
  gap: var(--spacing-md);
}

.mp-field {
  flex: 0 0 auto;
  display: grid;
  gap: 6px;
}

.mp-label {
  color: var(--text-secondary);
  font-size: var(--font-size-xs);
  font-weight: 600;
}

.mp-select,
.mp-search {
  width: 100%;
}

.mp-list-head {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.mp-list-count {
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
}

.mp-list {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding-right: 2px;
}

.mp-member {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--border-color-light);
  border-radius: var(--radius-sm);
  background: var(--bg-card);
  text-align: left;
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast);

  & + .mp-member {
    margin-top: 8px;
  }

  &:hover {
    border-color: var(--border-color-hover);
  }

  &.is-selected {
    border-color: var(--color-primary);
    background: var(--color-primary-soft);
  }
}

.mp-member__avatar {
  flex: 0 0 auto;
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: var(--text-secondary);
  background: var(--bg-control);
  font-size: var(--font-size-xs);
  font-weight: 600;

  .mp-member.is-selected & {
    color: #fff;
    background: var(--color-primary);
  }
}

.mp-member__info {
  flex: 1 1 auto;
  min-width: 0;
  display: grid;
  gap: 2px;
}

.mp-member__top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.mp-member__name {
  min-width: 0;
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  overflow: hidden;
  color: var(--text-primary);
  font-size: var(--font-size-sm);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mp-member__self {
  flex: 0 0 auto;
  padding: 0 6px;
  border-radius: var(--radius-xs);
  color: var(--color-primary);
  background: var(--color-primary-soft);
  font-size: 11px;
  font-weight: 500;

  .mp-member.is-selected & {
    background: var(--bg-card);
  }
}

.mp-member__role {
  flex: 0 0 auto;
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
  white-space: nowrap;
}

.mp-member__sub {
  overflow: hidden;
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mp-pagination {
  flex: 0 0 auto;
  display: flex;
  justify-content: flex-end;
}

.mp-note {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 5px;
  margin: 0;
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
}

/* 右侧卡片 */
.mp-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px;
  border: 1px solid var(--border-color-light);
  border-radius: var(--radius-sm);
  background: var(--bg-card);
}

.mp-card--selected {
  flex: 0 0 auto;
}

.mp-card--message {
  flex: 1 1 auto;
  min-height: 0;
}

.mp-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.mp-card__title {
  color: var(--text-primary);
  font-size: var(--font-size-sm);
  font-weight: 600;
}

.mp-card__count {
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
}

.mp-selected-empty {
  min-height: 120px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
}

.mp-selected-empty__icon {
  color: var(--text-disabled);
  font-size: 40px;
}

.mp-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-height: 120px;
  overflow-y: auto;
}

.mp-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 4px 3px 10px;
  border-radius: var(--radius-pill);
  color: var(--color-primary);
  background: var(--color-primary-soft);
  font-size: var(--font-size-xs);
}

.mp-chip__remove {
  width: 18px;
  height: 18px;
  display: inline-grid;
  place-items: center;
  border: 0;
  border-radius: 50%;
  color: var(--color-primary);
  background: transparent;
  cursor: pointer;

  &:hover {
    background: var(--bg-card);
  }

  .el-icon {
    font-size: 12px;
  }
}

.mp-textarea {
  flex: 1 1 auto;
  display: flex;

  :deep(.el-textarea__inner) {
    height: 100%;
    resize: none;
  }
}

/* 底部操作 */
.mp-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
}

.mp-cancel {
  color: var(--text-secondary);
}

.mp-submit {
  min-width: 96px;
}
</style>
