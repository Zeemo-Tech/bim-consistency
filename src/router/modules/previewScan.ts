export default {
  path: '/preview-scan/:id',
  name: 'PreviewScan',
  component: () => import('@/views/preview/scan.vue'),
  meta: {
    title: '点云预览',
    icon: 'ep/view',
    showLink: false,
    hideMenu: true,
    fullPage: true,
  },
}
