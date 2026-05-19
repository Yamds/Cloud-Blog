import { createRouter, createWebHistory } from 'vue-router'

import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior() {
    return { top: 0 }
  },
  routes: [
    {
      path: '/',
      component: () => import('@/layouts/PublicLayout.vue'),
      children: [
        {
          path: '',
          name: 'home',
          component: () => import('@/pages/public/HomePage.vue'),
        },
        {
          path: 'articles',
          name: 'articles',
          component: () => import('@/pages/public/ArticlesPage.vue'),
        },
        {
          path: 'articles/:slug',
          name: 'article-detail',
          component: () => import('@/pages/public/ArticlePage.vue'),
          props: true,
        },
      ],
    },
    {
      path: '/cms',
      meta: {
        requiresAdmin: true,
      },
      component: () => import('@/layouts/CmsLayout.vue'),
      children: [
        {
          path: '',
          name: 'cms-dashboard',
          component: () => import('@/pages/cms/CmsDashboardPage.vue'),
        },
        {
          path: 'articles/new',
          name: 'cms-article-new',
          component: () => import('@/pages/cms/CmsEditorPage.vue'),
        },
        {
          path: 'storage',
          name: 'cms-storage',
          component: () => import('@/pages/cms/CmsStoragePage.vue'),
        },
        {
          path: 'comments',
          name: 'cms-comments',
          component: () => import('@/pages/cms/CmsCommentsPage.vue'),
        },
        {
          path: 'analytics',
          name: 'cms-analytics',
          component: () => import('@/pages/cms/CmsAnalyticsPage.vue'),
        },
        {
          path: 'settings',
          name: 'cms-settings',
          component: () => import('@/pages/cms/CmsSettingsPage.vue'),
        },
        {
          path: 'articles/:id',
          name: 'cms-article-edit',
          component: () => import('@/pages/cms/CmsEditorPage.vue'),
          props: true,
        },
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})

router.beforeEach(async (to) => {
  if (!to.matched.some((record) => record.meta.requiresAdmin)) {
    return true
  }

  const authStore = useAuthStore()

  await authStore.loadMe()

  if (authStore.isAdmin) {
    return true
  }

  return {
    path: '/',
  }
})

export default router
