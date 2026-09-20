const Layout = () => import('@/layout/index.vue')

export default {
  path: '/data/report',
  name: 'ReportModule',
  component: Layout,
  redirect: '/data/report-center',
  meta: {
    title: '报告模块',
    icon: 'ep/document',
    rank: 11,
    showLink: true,
  },
  children: [
    {
      path: '/data/report-center',
      name: 'ReportCenter',
      component: () => import('@/views/data/report-center/index.vue'),
      meta: {
        title: '报告中心',
        icon: 'ep/document',
        showLink: true,
      },
    },
    {
      path: '/data/report/:reportId',
      name: 'ReportDetail',
      component: () => import('@/views/data/report-detail/index.vue'),
      meta: {
        title: '报告预览',
        showLink: false,
        // 全屏页面，不显示侧边栏
    fullPage: true,
      },
    },
  ],
}
