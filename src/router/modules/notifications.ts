const Layout = () => import('@/layout/index.vue')

export default {
  path: '/notifications',
  name: 'Notifications',
  redirect: '/notifications/model',
  meta: {
    title: '消息中心',
    icon: 'ep/bell',
    rank: 99,
    showLink: false,
    // 全屏页面，不显示侧边栏
    fullPage: true,
  },
  children: [
    {
      path: '/notifications/model',
      name: 'NotificationsModel',
      component: () => import('@/views/notifications/index.vue'),
      meta: {
        title: '消息中心',
        icon: 'ep/bell',
        showLink: false,
        fullPage: true,
      },
    },
  ],
}
