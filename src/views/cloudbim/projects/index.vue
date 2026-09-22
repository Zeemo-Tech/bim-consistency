<template>
  <CloudBimShell variant="page" active="projects">
    <section class="cb-projects">
      <div class="cb-toolbar">
        <div class="cb-toolbar__filters">
          <el-input
            v-model="filters.keyword"
            class="cb-search"
            placeholder="搜索项目名称 / 描述"
            :prefix-icon="Search"
            clearable
            @keyup.enter="reload"
            @clear="reload"
          />
          <el-select
            v-model="filters.status"
            class="cb-select"
            placeholder="项目状态"
            @change="reload"
          >
            <el-option label="全部状态" value="" />
            <el-option
              v-for="item in statusOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </div>
        <div class="cb-toolbar__actions">
          <button class="cb-button" type="button" @click="resetFilters">
            <el-icon :size="16"><Refresh /></el-icon>
            重置
          </button>
          <button class="cb-button" type="button" @click="reload">
            <el-icon :size="16"><Refresh /></el-icon>
            刷新
          </button>
          <button
            class="cb-button is-primary"
            type="button"
            @click="openCreate"
          >
            <el-icon :size="16"><CirclePlus /></el-icon>
            新建项目
          </button>
        </div>
      </div>

      <div v-loading="loading" class="cb-grid">
        <article
          v-for="project in projects"
          :key="project.id"
          class="cb-card"
          tabindex="0"
          role="link"
          :aria-label="`进入项目：${project.name}`"
          @click="enterProject(project)"
          @keydown.enter.self="enterProject(project)"
          @keydown.space.self.prevent="enterProject(project)"
        >
          <div class="cb-card__top">
            <span class="cb-card__folder">
              <el-icon><Folder /></el-icon>
            </span>
            <div class="cb-card__actions">
              <button
                type="button"
                title="编辑项目"
                @click="openEdit(project, $event)"
              >
                <el-icon><Edit /></el-icon>
              </button>
              <button
                type="button"
                title="删除项目"
                @click="removeProject(project, $event)"
              >
                <el-icon><Delete /></el-icon>
              </button>
            </div>
          </div>
          <div class="cb-card__copy">
            <h2>{{ project.name }}</h2>
            <p>{{ project.description || '暂无项目描述' }}</p>
          </div>
          <div class="cb-card__stats">
            <span>
              <strong>{{ fileCount(project) }}</strong>
              文件
            </span>
            <span>
              <strong>{{ typeCount(project, 'bim') }}</strong>
              BIM
            </span>
            <span>
              <strong>{{ typeCount(project, 'scan') }}</strong>
              点云
            </span>
          </div>
          <footer class="cb-card__footer">
            <span class="cb-status" :class="`is-${project.status}`">
              {{ statusText(project.status) }}
            </span>
            <span class="cb-card__date">
              {{
                project.deadline
                  ? `截止 ${formatDate(project.deadline)}`
                  : project.location || '未设置地点'
              }}
            </span>
            <button
              class="cb-enter"
              type="button"
              :aria-label="`进入项目：${project.name}`"
              @click.stop="enterProject(project)"
            >
              进入项目
              <el-icon><ArrowRight /></el-icon>
            </button>
          </footer>
        </article>

        <button
          v-if="!loading && !projects.length"
          class="cb-empty"
          type="button"
          @click="openCreate"
        >
          <el-icon><CirclePlus /></el-icon>
          <strong>创建第一个项目</strong>
          <span>开始管理设计模型与扫描点云</span>
        </button>
      </div>

      <footer v-if="total > 0" class="cb-pagination">
        <span class="cb-pagination__total">共 {{ total }} 条</span>
        <div class="cb-pagination__pages">
          <button
            type="button"
            :disabled="page <= 1"
            aria-label="上一页"
            @click="changePage(page - 1)"
          >
            ‹
          </button>
          <button
            v-for="p in pageList"
            :key="p"
            type="button"
            :class="{ 'is-active': p === page }"
            @click="changePage(p)"
          >
            {{ p }}
          </button>
          <button
            type="button"
            :disabled="page >= pageCount"
            aria-label="下一页"
            @click="changePage(page + 1)"
          >
            ›
          </button>
        </div>
        <el-select
          v-model="pageSize"
          class="cb-pagination__size"
          @change="reload"
        >
          <el-option :label="'8 条/页'" :value="8" />
          <el-option :label="'12 条/页'" :value="12" />
          <el-option :label="'16 条/页'" :value="16" />
          <el-option :label="'24 条/页'" :value="24" />
        </el-select>
      </footer>

      <el-dialog
        v-model="dialogVisible"
        class="cb-dialog"
        :title="editingId ? '编辑项目' : '新建项目'"
        width="480px"
      >
        <el-form label-position="top">
          <el-form-item label="项目名称">
            <el-input
              v-model="form.name"
              maxlength="160"
              placeholder="请输入项目名称"
            />
          </el-form-item>
          <el-form-item label="项目描述">
            <el-input
              v-model="form.description"
              type="textarea"
              :rows="3"
              maxlength="500"
              placeholder="补充项目位置、阶段等信息"
            />
          </el-form-item>
          <el-form-item label="项目地点">
            <el-input
              v-model="form.location"
              maxlength="160"
              placeholder="请输入项目地点"
            />
          </el-form-item>
          <el-form-item label="项目状态">
            <el-select
              v-model="form.status"
              placeholder="请选择项目状态"
              style="width: 100%"
            >
              <el-option
                v-for="item in statusOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="saving" @click="saveProject">
            保存
          </el-button>
        </template>
      </el-dialog>
    </section>
  </CloudBimShell>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  ArrowRight,
  CirclePlus,
  Delete,
  Edit,
  Folder,
  Refresh,
  Search,
} from '@element-plus/icons-vue'
import {
  createProject,
  deleteProject,
  getProjectList,
  updateProject,
  type ProjectData,
} from '@/api/project'
import CloudBimShell from '@/layout/cloudbim/CloudBimShell.vue'

defineOptions({ name: 'CloudBimProjects' })

const router = useRouter()

const statusOptions = [
  { label: '筹备中', value: 'planning' },
  { label: '进行中', value: 'in_progress' },
  { label: '已完成', value: 'completed' },
  { label: '已归档', value: 'archived' },
]

const projects = ref<ProjectData[]>([])
const loading = ref(false)
const total = ref(0)
const page = ref(1)
const pageSize = ref(12)
const dialogVisible = ref(false)
const editingId = ref<number | null>(null)
const saving = ref(false)
const filters = reactive({ keyword: '', status: '' })
const form = reactive({
  name: '',
  description: '',
  location: '',
  status: 'planning' as ProjectData['status'],
})

const pageCount = computed(() =>
  Math.max(1, Math.ceil(total.value / pageSize.value)),
)

const pageList = computed(() => {
  const list: number[] = []
  const end = Math.min(pageCount.value, page.value + 2)
  const start = Math.max(1, end - 4)
  for (let i = start; i <= end; i += 1) list.push(i)
  return list
})

function typeCount(project: ProjectData, type: string) {
  return project.fileTypeCounts?.find((item) => item.type === type)?.count ?? 0
}

function fileCount(project: ProjectData) {
  if (typeof project.fileCount === 'number') return project.fileCount
  return project.fileTypeCounts?.reduce((sum, item) => sum + item.count, 0) ?? 0
}

function statusText(status: ProjectData['status']) {
  const map: Record<string, string> = {
    planning: '筹备中',
    in_progress: '进行中',
    completed: '已完成',
    archived: '已归档',
  }
  return map[status] || status
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleDateString('zh-CN') : '-'
}

async function loadProjects() {
  loading.value = true
  try {
    const res = await getProjectList({
      page: page.value,
      pageSize: pageSize.value,
      keyword: filters.keyword.trim() || undefined,
      status: filters.status || undefined,
    })
    projects.value = res.data?.list || []
    total.value = res.data?.total || 0
  } catch (error: any) {
    projects.value = []
    total.value = 0
    ElMessage.error(
      error?.response?.data?.msg || error?.message || '加载项目失败',
    )
  } finally {
    loading.value = false
  }
}

function reload() {
  page.value = 1
  void loadProjects()
}

function changePage(next: number) {
  if (next < 1 || next > pageCount.value || next === page.value) return
  page.value = next
  void loadProjects()
}

function resetFilters() {
  filters.keyword = ''
  filters.status = ''
  reload()
}

function enterProject(project: ProjectData) {
  void router.push({
    path: '/design/overview',
    query: { projectId: project.id, projectName: project.name },
  })
}

function openCreate() {
  editingId.value = null
  form.name = ''
  form.description = ''
  form.location = ''
  form.status = 'planning'
  dialogVisible.value = true
}

function openEdit(project: ProjectData, event: Event) {
  event.stopPropagation()
  editingId.value = project.id ?? null
  form.name = project.name
  form.description = project.description || ''
  form.location = project.location || ''
  form.status = project.status || 'planning'
  dialogVisible.value = true
}

async function saveProject() {
  if (!form.name.trim()) {
    ElMessage.warning('请输入项目名称')
    return
  }
  saving.value = true
  try {
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      location: form.location.trim(),
      status: form.status,
    }
    if (editingId.value) {
      await updateProject(editingId.value, payload)
    } else {
      await createProject(payload)
    }
    dialogVisible.value = false
    ElMessage.success(editingId.value ? '项目已更新' : '项目已创建')
    await loadProjects()
  } catch (error: any) {
    ElMessage.error(
      error?.response?.data?.msg || error?.message || '保存项目失败',
    )
  } finally {
    saving.value = false
  }
}

async function removeProject(project: ProjectData, event: Event) {
  event.stopPropagation()
  try {
    await ElMessageBox.confirm(
      `确定删除项目“${project.name}”吗？`,
      '删除项目',
      {
        type: 'warning',
      },
    )
    await deleteProject(project.id as number)
    ElMessage.success('项目已删除')
    await loadProjects()
  } catch (error: any) {
    if (error === 'cancel' || error === 'close') return
    ElMessage.error(
      error?.response?.data?.msg || error?.message || '删除项目失败',
    )
  }
}

onMounted(() => {
  void loadProjects()
})
</script>

<style lang="scss" scoped>
.cb-projects {
  width: min(1800px, 92vw);
  padding: var(--spacing-xl) 0 40px;
  margin: 0 auto;
}

.cb-toolbar {
  display: flex;
  gap: var(--spacing-compact);
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-lg);
}

.cb-toolbar__filters {
  display: flex;
  flex: 1;
  gap: var(--spacing-sm);
  align-items: center;
  min-width: 0;
}

.cb-toolbar__actions {
  display: flex;
  gap: var(--spacing-sm);
  align-items: center;
}

.cb-search {
  flex: 1 1 210px;
  min-width: 170px;
  max-width: 260px;
}

.cb-select {
  width: 140px;
}

.cb-toolbar :deep(.el-input__wrapper),
.cb-toolbar :deep(.el-select__wrapper) {
  min-height: 40px;
  border-radius: var(--radius-lg);
  box-shadow: inset 0 0 0 1px var(--border-color-light);
}

.cb-button {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  justify-content: center;
  height: 40px;
  min-height: 40px;
  padding: 0 var(--spacing-md);
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--text-secondary);
  white-space: nowrap;
  cursor: pointer;
  background: var(--bg-control);
  border: 0;
  border-radius: var(--radius-lg);
  transition: color var(--transition-fast);
}

.cb-button:hover {
  color: var(--color-primary);
}

.cb-button.is-primary {
  color: #fff;
  background: var(--color-primary);
  box-shadow: var(--shadow-sm);
}

.cb-button.is-primary:hover {
  color: #fff;
  background: var(--color-primary-hover);
}

.cb-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--spacing-lg);
  min-height: 200px;
}

.cb-card {
  display: flex;
  flex-direction: column;
  padding: var(--spacing-lg);
  cursor: pointer;
  background: var(--bg-card-translucent);
  border: 1px solid var(--border-color-light);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  transition:
    transform var(--transition-fast),
    box-shadow var(--transition-fast);
}

.cb-card:hover,
.cb-card:focus-visible {
  border-color: var(--border-color-hover);
  box-shadow: var(--shadow-lg);
  transform: translateY(-3px);
}

.cb-card:focus-visible {
  outline: 2px solid var(--border-color-focus);
  outline-offset: 3px;
}

.cb-card__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.cb-card__folder {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  font-size: 18px;
  color: var(--color-primary);
  background: var(--color-primary-soft);
  border-radius: var(--radius-sm);
}

.cb-card__actions {
  display: flex;
  gap: var(--spacing-xs);
  opacity: 0.78;
}

.cb-card__actions button {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  color: var(--text-secondary);
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: var(--radius-xs);
}

.cb-card__actions button:hover {
  color: var(--text-link);
  background: var(--color-primary-soft);
}

.cb-card__actions button:last-child:hover {
  color: var(--text-danger);
  background: var(--color-danger-soft);
}

.cb-card__copy {
  margin-top: var(--spacing-md);
}

.cb-card__copy h2 {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: var(--font-size-md);
  font-weight: 650;
  color: var(--text-primary);
  white-space: nowrap;
}

.cb-card__copy p {
  display: -webkit-box;
  height: 40px;
  margin: var(--spacing-sm) 0 0;
  overflow: hidden;
  -webkit-line-clamp: 2;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
  -webkit-box-orient: vertical;
}

.cb-card__stats {
  display: flex;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-md);
}

.cb-card__stats span {
  display: inline-flex;
  gap: 4px;
  align-items: baseline;
  padding: 6px 10px;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
  background: var(--bg-control);
  border-radius: var(--radius-sm);
}

.cb-card__stats strong {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.cb-card__footer {
  display: flex;
  gap: var(--spacing-sm);
  align-items: center;
  padding-top: var(--spacing-md);
  margin-top: var(--spacing-md);
  border-top: 1px solid var(--border-color-light);
}

.cb-status {
  padding: 5px 10px;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
  background: var(--bg-muted);
  border-radius: var(--radius-pill);
}

.cb-status.is-completed {
  color: var(--text-success);
  background: var(--color-success-soft);
}

.cb-status.is-in_progress {
  color: var(--text-warning);
  background: var(--color-warning-soft);
}

.cb-status.is-archived {
  color: var(--text-info);
  background: var(--color-info-soft);
}

.cb-card__date {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: var(--font-size-xs);
  color: var(--text-disabled);
  white-space: nowrap;
}

.cb-enter {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  min-height: 32px;
  padding: 0 4px;
  font-size: var(--font-size-xs);
  color: var(--text-link);
  cursor: pointer;
  background: transparent;
  border: 0;
}

.cb-empty {
  display: grid;
  place-items: center;
  min-height: 220px;
  padding: var(--spacing-xl);
  color: var(--text-tertiary);
  cursor: pointer;
  background: var(--bg-card-translucent);
  border: 1px dashed var(--border-color-hover);
  border-radius: var(--radius-lg);
}

.cb-empty .el-icon {
  font-size: 28px;
  color: var(--color-primary);
}

.cb-empty strong {
  margin-top: var(--spacing-sm);
  font-size: var(--font-size-md);
  color: var(--text-primary);
}

.cb-empty span {
  margin-top: var(--spacing-xs);
  font-size: var(--font-size-xs);
}

.cb-pagination {
  display: flex;
  gap: var(--spacing-md);
  align-items: center;
  justify-content: flex-end;
  margin-top: var(--spacing-xl);
}

.cb-pagination__total {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.cb-pagination__pages {
  display: flex;
  gap: var(--spacing-xs);
  align-items: center;
}

.cb-pagination__pages button {
  min-width: 32px;
  height: 32px;
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  cursor: pointer;
  background: var(--bg-control);
  border: 0;
  border-radius: var(--radius-xs);
}

.cb-pagination__pages button:disabled {
  color: var(--text-disabled);
  cursor: not-allowed;
}

.cb-pagination__pages button.is-active {
  color: #fff;
  background: var(--color-primary);
}

.cb-pagination__size {
  width: 110px;
}

@media (width <= 900px) {
  .cb-toolbar {
    flex-wrap: wrap;
  }

  .cb-toolbar__filters {
    flex-wrap: wrap;
  }

  .cb-search {
    max-width: none;
  }

  .cb-toolbar__actions {
    justify-content: flex-end;
    width: 100%;
  }
}
</style>

<style lang="scss">
.cb-dialog {
  border-radius: var(--radius-lg);
}

.cb-dialog .el-dialog__title {
  font-size: var(--font-size-lg);
  font-weight: 650;
  color: var(--text-primary);
}

.cb-dialog .el-form-item__label {
  color: var(--text-secondary);
}
</style>
