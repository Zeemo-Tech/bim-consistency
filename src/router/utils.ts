import {
  type RouterHistory,
  type RouteRecordRaw,
  createWebHistory,
  createWebHashHistory
} from "vue-router";
import { router } from "./index";
import { isProxy, toRaw } from "vue";
import { useTimeoutFn } from "@vueuse/core";
import {
  isString,
  cloneDeep,
  isAllEmpty,
  intersection,
  storageLocal,
  isIncludeAllChildren
} from "@pureadmin/utils";
import { getConfig } from "@/config";
import { buildHierarchyTree } from "@/utils/tree";
import { userKey, type DataInfo } from "@/utils/auth";
import { type menuType, type RouteConfigs, routerArrays } from "@/layout/types";
import { useMultiTagsStoreHook } from "@/store/modules/multiTags";
import { usePermissionStoreHook } from "@/store/modules/permission";
const IFrame = () => import("@/layout/frame.vue");
// https://cn.vitejs.dev/guide/features.html#glob-import
const modulesRoutes = import.meta.glob("/src/views/**/*.{vue,tsx}");

// 动态路由
import { getAsyncRoutes, getUserMenus, type MenuItem } from "@/api/routes";

/** Layout 组件 */
const Layout = () => import("@/layout/index.vue");

/**
 * 根据组件路径动态导入组件
 * @param component 组件路径字符串，如 "views/system/organization/index.vue"
 */
function loadComponent(component: string) {
  if (!component) return null;

  // 处理 Layout 组件
  if (
    component === "Layout" ||
    component === "layout" ||
    component === "@/layout/index.vue" ||
    component === "/src/layout/index.vue"
  ) {
    return Layout;
  }

  // 处理 IFrame 组件
  if (component === "IFrame" || component === "iframe") {
    return IFrame;
  }

  // 标准化路径格式
  let componentPath = component;

  // 1. 处理 @/ 前缀（将 @/ 替换为 /src/）
  if (componentPath.startsWith("@/")) {
    componentPath = componentPath.replace("@/", "/src/");
  }
  // 2. 处理 views/ 开头的路径
  else if (componentPath.startsWith("views/")) {
    componentPath = `/src/${componentPath}`;
  }
  // 3. 如果路径不以 /src/ 开头，添加 /src/views/ 前缀
  else if (!componentPath.startsWith("/src/")) {
    componentPath = `/src/views/${componentPath}`;
  }

  // 确保路径以 .vue 或 .tsx 结尾
  if (!componentPath.endsWith(".vue") && !componentPath.endsWith(".tsx")) {
    // 尝试 index.vue
    componentPath = componentPath.replace(/\/?$/, "/index.vue");
  }

  // 从 modulesRoutes 中查找对应的组件
  const matchedComponent = modulesRoutes[componentPath];

  if (matchedComponent) {
    return matchedComponent;
  }

  // 如果没找到，尝试其他可能的路径格式
  const alternativePaths = [
    component.replace("@/", "/src/"),
    `/src/views/${component}.vue`,
    `/src/views/${component}/index.vue`,
    `/src/${component}`,
    `/src/${component}.vue`
  ];

  for (const altPath of alternativePaths) {
    if (modulesRoutes[altPath]) {
      return modulesRoutes[altPath];
    }
  }

  console.error(`[Router] ✗ 未找到组件: ${component}`);
  console.error(`[Router] 尝试的主路径: ${componentPath}`);
  console.error(`[Router] 尝试的备用路径:`, alternativePaths);
  return null;
}

/**
 * 将后端菜单数据转换为 Vue Router 路由配置
 * @param menus 后端返回的菜单列表
 * @param parentPath 父级路径
 * @param rank 排序起始值
 */
function transformMenusToRoutes(menus: MenuItem[], parentPath = "", rank = 0): RouteRecordRaw[] {
  if (!menus || menus.length === 0) return [];

  return menus.map((menu, index) => {
    const { path, name, component, title, icon, show, children } = menu;

    // 判断是否是顶级路由（Layout 组件）
    const isLayout =
      component === "Layout" ||
      component === "layout" ||
      component === "@/layout/index.vue" ||
      component === "/src/layout/index.vue" ||
      component.includes("/layout/");

    // 加载组件
    let routeComponent: RouteRecordRaw["component"];
    if (isLayout) {
      routeComponent = Layout;
    } else {
      routeComponent = loadComponent(component);
      if (!routeComponent) {
        console.error(`[Router] ✗ 组件加载失败，路由: ${name}, 组件: ${component}`);
        return null;
      }
    }

    // 为系统管理和项目模块分配特定的 rank 值
    let routeRank = isLayout ? (rank + index) : undefined;
    if (isLayout && title === "系统管理") {
      routeRank = 1;
    } else if (isLayout && title === "项目模块") {
      routeRank = 2;
    }

    // 构建路由配置
    const route = {
      path: path,
      name: name,
      component: routeComponent,
      meta: {
        title: title,
        icon: icon,
        showLink: show !== false,
        rank: routeRank
      }
    } as RouteRecordRaw;

    // 处理子路由
    if (children && children.length > 0) {
      route.children = transformMenusToRoutes(children, path, 0);

      // 如果是 Layout，设置 redirect 到第一个子路由
      if (isLayout && route.children.length > 0) {
        route.redirect = route.children[0].path;
      }
    }
    return route;
  }).filter(route => route !== null);
}

/**
 * 从后端获取用户菜单并转换为路由
 */
async function fetchUserMenuRoutes(): Promise<RouteRecordRaw[]> {
  try {
    const response = await getUserMenus();

    if (response && response.code === 200 && response.data) {
      // 动态路由从 rank 1 开始，为系统管理和项目模块预留位置
      const routes = transformMenusToRoutes(response.data, "", 1);
      return routes;
    }

    console.warn("[Router] 获取菜单失败，响应码:", response?.code);
    return [];
  } catch (error) {
    console.error("[Router] 获取菜单出错:", error);
    return [];
  }
}

function handRank(routeInfo: any) {
  const { name, path, parentId, meta } = routeInfo;
  return isAllEmpty(parentId)
    ? isAllEmpty(meta?.rank) ||
      (meta?.rank === 0 && name !== "Home" && path !== "/")
      ? true
      : false
    : false;
}

/** 按照路由中meta下的rank等级升序来排序路由 */
function ascending(arr: any[]) {
  arr.forEach((v, index) => {
    // 当rank不存在时，根据顺序自动创建，首页路由永远在第一位
    if (handRank(v)) {
      // 只有当 rank 确实不存在时才设置
      if (v.meta.rank === undefined || v.meta.rank === null) {
        v.meta.rank = index + 2;
      }
    }
  });
  const sorted = arr.sort(
    (a: { meta: { rank: number } }, b: { meta: { rank: number } }) => {
      // 处理 undefined 的情况：undefined 排在最后
      const rankA = a?.meta?.rank ?? 999;
      const rankB = b?.meta?.rank ?? 999;
      return rankA - rankB;
    }
  );
  return sorted;
}

/** 过滤meta中showLink为false的菜单 */
function filterTree(data: RouteRecordRaw[]) {
  const newTree = cloneDeep(data).filter(
    (v: { meta: { showLink: boolean } }) => v.meta?.showLink !== false
  );
  newTree.forEach(
    (v: { children }) => v.children && (v.children = filterTree(v.children))
  );
  return newTree;
}

/** 过滤children长度为0的的目录，当目录下没有菜单时，会过滤此目录，目录没有赋予roles权限，当目录下只要有一个菜单有显示权限，那么此目录就会显示 */
function filterChildrenTree(data: RouteRecordRaw[]) {
  const newTree = cloneDeep(data).filter((v: any) => v?.children?.length !== 0);
  newTree.forEach(
    (v: { children }) => v.children && (v.children = filterTree(v.children))
  );
  return newTree;
}

/** 判断两个数组彼此是否存在相同值 */
function isOneOfArray(a: Array<string>, b: Array<string>) {
  return Array.isArray(a) && Array.isArray(b)
    ? intersection(a, b).length > 0
      ? true
      : false
    : true;
}

/** 从localStorage里取出当前登录用户的角色roles，过滤无权限的菜单 */
function filterNoPermissionTree(data: RouteRecordRaw[]) {
  const currentRoles =
    storageLocal().getItem<DataInfo<number>>(userKey)?.roles ?? [];
  const newTree = cloneDeep(data).filter((v: any) =>
    isOneOfArray(v.meta?.roles, currentRoles)
  );
  newTree.forEach(
    (v: any) => v.children && (v.children = filterNoPermissionTree(v.children))
  );
  return filterChildrenTree(newTree);
}

/** 通过指定 `key` 获取父级路径集合，默认 `key` 为 `path` */
function getParentPaths(value: string, routes: RouteRecordRaw[], key = "path") {
  // 深度遍历查找
  function dfs(routes: RouteRecordRaw[], value: string, parents: string[]) {
    for (let i = 0; i < routes.length; i++) {
      const item = routes[i];
      // 返回父级path
      if (item[key] === value) return parents;
      // children不存在或为空则不递归
      if (!item.children || !item.children.length) continue;
      // 往下查找时将当前path入栈
      parents.push(item.path);

      if (dfs(item.children, value, parents).length) return parents;
      // 深度遍历查找未找到时当前path 出栈
      parents.pop();
    }
    // 未找到时返回空数组
    return [];
  }

  return dfs(routes, value, []);
}

/** 查找对应 `path` 的路由信息 */
function findRouteByPath(path: string, routes: RouteRecordRaw[]) {
  // 添加空值检查
  if (!routes || !Array.isArray(routes) || routes.length === 0) {
    return null;
  }

  let res = routes.find((item: { path: string }) => item.path == path);
  if (res) {
    return isProxy(res) ? toRaw(res) : res;
  } else {
    for (let i = 0; i < routes.length; i++) {
      if (
        routes[i].children instanceof Array &&
        routes[i].children.length > 0
      ) {
        res = findRouteByPath(path, routes[i].children);
        if (res) {
          return isProxy(res) ? toRaw(res) : res;
        }
      }
    }
    return null;
  }
}

/** 动态路由注册完成后，再添加全屏404（页面不存在）页面，避免刷新动态路由页面时误跳转到404页面 */
function addPathMatch() {
  if (!router.hasRoute("pathMatch")) {
    router.addRoute({
      path: "/:pathMatch(.*)*",
      name: "PageNotFound",
      component: () => import("@/views/error/404.vue"),
      meta: {
        title: "menus.purePageNotFound",
        showLink: false
      }
    });
  }
}

/** 处理动态路由（后端返回的路由） */
async function handleAsyncRoutes(routeList) {

  if (routeList.length === 0) {
    // 当后端返回空路由时，使用前端静态路由
    const { constantMenus } = await import("./index");
    // 直接使用 setWholeMenus，避免重复添加 constantMenus
    usePermissionStoreHook().setWholeMenus(constantMenus);
  } else {
    const processedRoutes = addAsyncRoutes(routeList);

    const flattenedRoutes = formatFlatteningRoutes(processedRoutes);

    flattenedRoutes.map((v: RouteRecordRaw) => {

      // 防止重复添加路由
      if (
        router.options.routes[0].children.findIndex(
          value => value.path === v.path
        ) !== -1
      ) {
        return;
      } else {
        // 切记将路由push到routes后还需要使用addRoute，这样路由才能正常跳转
        router.options.routes[0].children.push(v);
        // 最终路由进行升序
        ascending(router.options.routes[0].children);
        if (!router.hasRoute(v?.name)) {
          router.addRoute(v);
        }
        const flattenRouters: any = router
          .getRoutes()
          .find(n => n.path === "/");
        // 保持router.options.routes[0].children与path为"/"的children一致，防止数据不一致导致异常
        flattenRouters.children = router.options.routes[0].children;
        router.addRoute(flattenRouters);
      }
    });

    console.log("[Router] 所有路由注册完成，当前路由表:", router.getRoutes());
    usePermissionStoreHook().handleWholeMenus(routeList);
  }
  if (!useMultiTagsStoreHook().getMultiTagsCache) {
    const fixedTagRoutes: RouteConfigs[] =
      usePermissionStoreHook().flatteningRoutes
        .filter(v => v?.meta?.fixedTag)
        .map(v => ({
          path: v.path,
          name: typeof v.name === "string" ? v.name : undefined,
          meta: v.meta,
          children: []
        }));
    useMultiTagsStoreHook().handleTags("equal", [
      ...routerArrays,
      ...fixedTagRoutes
    ]);
  }
  addPathMatch();
}

/** 初始化路由（`new Promise` 写法防止在异步请求中造成无限循环）*/
function initRouter() {
  return new Promise(async resolve => {
    try {
      // 优先从后端获取用户菜单
      const dynamicRoutes = await fetchUserMenuRoutes();

      if (dynamicRoutes && dynamicRoutes.length > 0) {
        // 使用后端返回的动态路由
        await handleAsyncRoutes(cloneDeep(dynamicRoutes));
      } else {
        // 后端没有返回路由，使用静态路由（fallback）
        const { data } = await getAsyncRoutes();
        await handleAsyncRoutes(cloneDeep(data));
      }

      resolve(router);
    } catch (error) {
      console.error("[Router] 初始化路由失败:", error);
      // 出错时使用静态路由作为 fallback
      const { data } = await getAsyncRoutes();
      await handleAsyncRoutes(cloneDeep(data));
      resolve(router);
    }
  });
}

/**
 * 将多级嵌套路由处理成一维数组
 * @param routesList 传入路由
 * @returns 返回处理后的一维路由
 */
function formatFlatteningRoutes(routesList: RouteRecordRaw[]) {
  if (routesList.length === 0) return routesList;
  let hierarchyList = buildHierarchyTree(routesList);
  for (let i = 0; i < hierarchyList.length; i++) {
    if (hierarchyList[i].children) {
      hierarchyList = hierarchyList
        .slice(0, i + 1)
        .concat(hierarchyList[i].children, hierarchyList.slice(i + 1));
    }
  }
  return hierarchyList;
}

/**
 * 一维数组处理成多级嵌套数组（三级及以上的路由全部拍成二级，keep-alive 只支持到二级缓存）
 * https://github.com/pure-admin/vue-pure-admin/issues/67
 * @param routesList 处理后的一维路由菜单数组
 * @returns 返回将一维数组重新处理成规定路由的格式
 */
function formatTwoStageRoutes(routesList: RouteRecordRaw[]) {
  if (routesList.length === 0) return routesList;
  const newRoutesList: RouteRecordRaw[] = [];
  routesList.forEach((v: RouteRecordRaw) => {
    if (v.path === "/") {
      newRoutesList.push({
        component: v.component,
        name: v.name,
        path: v.path,
        redirect: v.redirect,
        meta: v.meta,
        children: []
      });
    } else {
      newRoutesList[0]?.children.push({ ...v });
    }
  });
  return newRoutesList;
}

/** 处理缓存路由（添加、删除、刷新） */
function handleAliveRoute({ name }: ToRouteType, mode?: string) {
  const routeName = typeof name === 'symbol' ? String(name) : name;
  switch (mode) {
    case "add":
      usePermissionStoreHook().cacheOperate({
        mode: "add",
        name: routeName
      });
      break;
    case "delete":
      usePermissionStoreHook().cacheOperate({
        mode: "delete",
        name: routeName
      });
      break;
    case "refresh":
      usePermissionStoreHook().cacheOperate({
        mode: "refresh",
        name: routeName
      });
      break;
    default:
      usePermissionStoreHook().cacheOperate({
        mode: "delete",
        name: routeName
      });
      useTimeoutFn(() => {
        usePermissionStoreHook().cacheOperate({
          mode: "add",
          name: routeName
        });
      }, 100);
  }
}

/** 过滤后端传来的动态路由 重新生成规范路由 */
function addAsyncRoutes(arrRoutes: Array<RouteRecordRaw>) {
  if (!arrRoutes || !arrRoutes.length) return;
  const modulesRoutesKeys = Object.keys(modulesRoutes);
  arrRoutes.forEach((v: RouteRecordRaw) => {
    // 将backstage属性加入meta，标识此路由为后端返回路由
    v.meta.backstage = true;
    // 父级的redirect属性取值：如果子级存在且父级的redirect属性不存在，默认取第一个子级的path；如果子级存在且父级的redirect属性存在，取存在的redirect属性，会覆盖默认值
    if (v?.children && v.children.length && !v.redirect)
      v.redirect = v.children[0].path;
    // 父级的name属性取值：如果子级存在且父级的name属性不存在，默认取第一个子级的name；如果子级存在且父级的name属性存在，取存在的name属性，会覆盖默认值（注意：测试中发现父级的name不能和子级name重复，如果重复会造成重定向无效（跳转404），所以这里给父级的name起名的时候后面会自动加上`Parent`，避免重复）
    if (v?.children && v.children.length && !v.name)
      v.name = (v.children[0].name as string) + "Parent";
    if (v.meta?.frameSrc) {
      v.component = IFrame;
    } else if (typeof v.component !== 'function') {
      // 只有当 component 不是函数时才重新加载（避免覆盖已经加载好的组件）
      // 对后端传component组件路径和不传做兼容（如果后端传component组件路径，那么path可以随便写，如果不传，component组件路径会跟path保持一致）
      const index = v?.component
        ? modulesRoutesKeys.findIndex(ev => ev.includes(v.component as any))
        : modulesRoutesKeys.findIndex(ev => ev.includes(v.path));
      if (index !== -1) {
        v.component = modulesRoutes[modulesRoutesKeys[index]];
      } else {
        console.warn(`[Router] addAsyncRoutes: 未找到组件 for path: ${v.path}`);
      }
    }
    if (v?.children && v.children.length) {
      addAsyncRoutes(v.children);
    }
  });
  return arrRoutes;
}

/** 获取路由历史模式 https://next.router.vuejs.org/zh/guide/essentials/history-mode.html */
function getHistoryMode(routerHistory): RouterHistory {
  // len为1 代表只有历史模式 为2 代表历史模式中存在base参数 https://next.router.vuejs.org/zh/api/#%E5%8F%82%E6%95%B0-1
  const historyMode = routerHistory.split(",");
  const leftMode = historyMode[0];
  const rightMode = historyMode[1];
  // no param
  if (historyMode.length === 1) {
    if (leftMode === "hash") {
      return createWebHashHistory("");
    } else if (leftMode === "h5") {
      return createWebHistory("");
    }
  } //has param
  else if (historyMode.length === 2) {
    if (leftMode === "hash") {
      return createWebHashHistory(rightMode);
    } else if (leftMode === "h5") {
      return createWebHistory(rightMode);
    }
  }
}

/** 获取当前页面按钮级别的权限 */
function getAuths(): Array<string> {
  return router.currentRoute.value.meta.auths as Array<string>;
}

/** 是否有按钮级别的权限（根据路由`meta`中的`auths`字段进行判断）*/
function hasAuth(value: string | Array<string>): boolean {
  if (!value) return false;
  /** 从当前路由的`meta`字段里获取按钮级别的所有自定义`code`值 */
  const metaAuths = getAuths();
  if (!metaAuths) return false;
  const isAuths = isString(value)
    ? metaAuths.includes(value)
    : isIncludeAllChildren(value, metaAuths);
  return isAuths ? true : false;
}

function handleTopMenu(route) {
  if (route?.children && route.children.length > 1) {
    if (route.redirect) {
      return route.children.filter(cur => cur.path === route.redirect)[0];
    } else {
      return route.children[0];
    }
  } else {
    return route;
  }
}

/** 获取所有菜单中的第一个菜单（顶级菜单）*/
function getTopMenu(tag = false): menuType {
  const wholeMenus = usePermissionStoreHook().wholeMenus;

  // 确保 wholeMenus 有数据并且结构正确
  if (!wholeMenus?.[0]?.children?.[0]) {
    console.warn('菜单数据未准备好');
    return { value: null };
  }

  const topMenu = handleTopMenu(wholeMenus[0].children[0]);
  tag && topMenu && useMultiTagsStoreHook().handleTags("push", topMenu);
  return topMenu;
}

export {
  hasAuth,
  getAuths,
  ascending,
  filterTree,
  initRouter,
  getTopMenu,
  addPathMatch,
  isOneOfArray,
  getHistoryMode,
  addAsyncRoutes,
  getParentPaths,
  findRouteByPath,
  handleAliveRoute,
  formatTwoStageRoutes,
  formatFlatteningRoutes,
  filterNoPermissionTree,
  fetchUserMenuRoutes,
  transformMenusToRoutes
};
