<template>
  <footer v-if="props.total > 0" class="project-table-footer" role="navigation">
    <div class="pagination">
      <span class="pager-summary">共 {{ props.total }} 条</span>
      <button
        type="button"
        class="pager-button"
        aria-label="上一页"
        title="上一页"
        :disabled="props.currentPage <= 1"
        @click.prevent="setPage(props.currentPage - 1)"
      >
        ‹
      </button>
      <template v-for="page in visiblePages" :key="String(page)">
        <button
          v-if="typeof page === 'number'"
          type="button"
          class="pager-button"
          :class="{ active: page === props.currentPage }"
          :aria-label="`第 ${page} 页`"
          :aria-current="page === props.currentPage ? 'page' : undefined"
          @click.prevent="setPage(page)"
        >
          {{ page }}
        </button>
        <span v-else class="pager-ellipsis">...</span>
      </template>
      <button
        type="button"
        class="pager-button"
        aria-label="下一页"
        title="下一页"
        :disabled="props.currentPage >= pageCount"
        @click.prevent="setPage(props.currentPage + 1)"
      >
        ›
      </button>
      <label class="page-size">
        <span class="sr-only">每页显示条数</span>
        <select :value="props.pageSize" @change="setPageSize">
          <option
            v-for="size in props.pageSizeOptions"
            :key="size"
            :value="size"
          >
            {{ size }} 条/页
          </option>
        </select>
      </label>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    total: number
    currentPage: number
    pageSize: number
    pageSizeOptions?: number[]
  }>(),
  {
    pageSizeOptions: () => [10, 20, 50],
  },
)

const emit = defineEmits<{
  'update:currentPage': [value: number]
  'update:pageSize': [value: number]
}>()

const pageCount = computed(() =>
  Math.max(1, Math.ceil(props.total / props.pageSize)),
)

const visiblePages = computed<Array<number | string>>(() => {
  if (pageCount.value <= 7)
    return Array.from({ length: pageCount.value }, (_, index) => index + 1)
  if (props.currentPage <= 4)
    return [1, 2, 3, 4, 5, 'ellipsis', pageCount.value]
  if (props.currentPage >= pageCount.value - 3) {
    return [
      1,
      'ellipsis',
      pageCount.value - 4,
      pageCount.value - 3,
      pageCount.value - 2,
      pageCount.value - 1,
      pageCount.value,
    ]
  }
  return [
    1,
    'ellipsis',
    props.currentPage - 1,
    props.currentPage,
    props.currentPage + 1,
    'ellipsis-end',
    pageCount.value,
  ]
})

function setPage(page: number) {
  emit('update:currentPage', Math.min(Math.max(1, page), pageCount.value))
}

function setPageSize(event: Event) {
  emit('update:pageSize', Number((event.target as HTMLSelectElement).value))
  emit('update:currentPage', 1)
}
</script>

<style lang="scss" scoped>
@use '../styles/workspace-controls.scss' as controls;

.project-table-footer {
  display: flex;
  flex: 0 0 auto;
  justify-content: flex-end;
  padding: 0;
  margin-top: var(--spacing-md);
}

.pagination {
  display: flex;
  gap: var(--spacing-sm);
  align-items: center;
  color: var(--text-secondary);
}

.pager-summary {
  margin-right: 4px;
  font-size: var(--font-size-sm);
  white-space: nowrap;
}

.pager-button {
  @include controls.action;

  min-width: var(--control-height);
  padding: 0 var(--spacing-sm);
}

.pager-button.active {
  @include controls.primary;
}

.page-size {
  display: inline-flex;
  align-items: center;
  height: var(--control-height);
  margin-left: 4px;
  overflow: hidden;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  box-shadow: none;
}

.page-size select {
  height: 100%;
  min-width: 100px;
  padding: 0 12px;
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  cursor: pointer;
  background: transparent;
  border: 0;
  outline: 0;
}

.pager-ellipsis {
  padding: 0 3px;
  color: var(--text-tertiary);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  white-space: nowrap;
  border: 0;
  clip: rect(0, 0, 0, 0);
}

@media (width <= 620px) {
  .pagination {
    flex-wrap: wrap;
  }
}
</style>
