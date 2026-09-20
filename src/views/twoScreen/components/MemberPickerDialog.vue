<template>
  <el-dialog
    :model-value="modelValue"
    width="720px"
    class="member-picker-dialog"
    :close-on-click-modal="false"
    @update:model-value="handleVisibleChange"
  >
    <template #header>
      <div class="member-picker-header">
        <div class="member-picker-title">邀请成员查看批注</div>
        <div class="member-picker-subtitle">{{ annotationSubtitle }}</div>
      </div>
    </template>

    <div class="annotation-selector">
      <div class="annotation-selector-label">选择批注</div>
      <el-select
        :model-value="localSelectedAnnotationKeys"
        class="annotation-selector-input"
        multiple
        collapse-tags
        collapse-tags-tooltip
        :max-collapse-tags="3"
        filterable
        placeholder="请选择需要邀请查看的批注（可多选）"
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

    <div class="member-picker-toolbar">
      <el-input
        v-model="keyword"
        class="member-search"
        placeholder="搜索成员姓名/邮箱/手机号"
        clearable
        @clear="handleSearch"
        @keyup.enter="handleSearch"
      >
        <template #append>
          <el-button :loading="memberLoading" @click="handleSearch">
            搜索
          </el-button>
        </template>
      </el-input>
      <div class="member-selected-info">
        已选择 {{ selectedMembers.length }} 人
      </div>
      <el-button text type="primary" @click="clearSelected">清空选择</el-button>
    </div>

    <div v-loading="memberLoading" class="member-list">
      <el-empty
        v-if="!memberLoading && memberList.length === 0"
        description="暂无可邀请成员"
        :image-size="90"
      />
      <div
        v-for="member in memberList"
        v-else
        :key="member.userId"
        class="member-item"
        :class="{ 'is-selected': isSelected(member.userId) }"
        @click="toggleMember(member)"
      >
        <el-checkbox
          :model-value="isSelected(member.userId)"
          @update:model-value="toggleMember(member)"
          @click.stop
        />
        <div class="member-info">
          <div class="member-main-row">
            <span class="member-name">
              {{ getMemberDisplayName(member) }}
              <span v-if="isCurrentAccount(member)" class="member-self-tag">
                (本人)
              </span>
            </span>
            <span class="member-role">
              {{ member.roleName || '未设置角色' }}
            </span>
          </div>
          <div class="member-sub-row">
            <span>{{ member.email || '-' }}</span>
            <span>{{ member.phone || '-' }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="member-pagination">
      <el-pagination
        background
        layout="prev, pager, next, total"
        :total="total"
        :page-size="pageSize"
        :current-page="page"
        @current-change="handlePageChange"
      />
    </div>

    <div class="invite-message-block">
      <div class="invite-message-label">邀请文案（可选）</div>
      <el-input
        v-model="messageText"
        type="textarea"
        :rows="4"
        maxlength="300"
        show-word-limit
        placeholder="请输入邀请文案"
      />
      <div class="invite-message-hint">若不填写，将使用默认模板发送。</div>
    </div>

    <template #footer>
      <div class="member-picker-footer">
        <el-button @click="handleCancel">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">
          发送邀请
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
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
const annotationSubtitle = computed(() => {
  if (!selectedAnnotationTitles.value.length) {
    const fallback = props.annotationTitle?.trim() || '未选择'
    return `当前批注：${fallback}`
  }
  if (selectedAnnotationTitles.value.length === 1) {
    return `当前批注：${selectedAnnotationTitles.value[0]}`
  }
  return `当前已选择 ${selectedAnnotationTitles.value.length} 条批注`
})

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
  } catch (error) {
  }
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
.member-picker-header {
  display: flex;
  flex-direction: column;
  gap: 4px;

  .member-picker-title {
    font-size: 18px;
    font-weight: 600;
    color: #111827;
  }

  .member-picker-subtitle {
    font-size: 13px;
    color: #6b7280;
  }
}

.annotation-selector {
  margin-bottom: 12px;

  .annotation-selector-label {
    font-size: 13px;
    font-weight: 600;
    color: #334155;
    margin-bottom: 6px;
  }

  .annotation-selector-input {
    width: 100%;
  }
}

.member-picker-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;

  .member-search {
    flex: 1;
  }

  .member-selected-info {
    font-size: 13px;
    color: #475569;
    white-space: nowrap;
  }
}

.member-list {
  min-height: 280px;
  max-height: 340px;
  overflow: auto;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 8px;
  background: #f8fafc;

  .member-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 8px;
    background: #fff;
    border: 1px solid transparent;
    cursor: pointer;
    margin-bottom: 8px;

    &:hover {
      border-color: #dbeafe;
      background: #f8fbff;
    }

    &.is-selected {
      border-color: #93c5fd;
      background: #eff6ff;
    }
  }

  .member-info {
    flex: 1;
    min-width: 0;
  }

  .member-main-row {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 4px;

    .member-name {
      font-size: 14px;
      font-weight: 600;
      color: #1f2937;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .member-self-tag {
      font-size: 12px;
      color: #64748b;
      font-weight: 500;
    }

    .member-role {
      font-size: 12px;
      color: #64748b;
      white-space: nowrap;
    }
  }

  .member-sub-row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    font-size: 12px;
    color: #64748b;
    white-space: nowrap;
    overflow: hidden;

    span {
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
}

.member-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}

.invite-message-block {
  margin-top: 14px;

  .invite-message-label {
    margin-bottom: 6px;
    font-size: 13px;
    color: #374151;
    font-weight: 500;
  }

  .invite-message-hint {
    margin-top: 6px;
    font-size: 12px;
    color: #94a3b8;
  }
}

.member-picker-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
