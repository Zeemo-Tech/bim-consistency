import App from './App.vue'
import pinia from "@/store";
import router from "./router";
import { createApp, type Directive } from "vue";
import { getPlatformConfig } from "./config";
import { useVxeTable } from "@/plugins/vxeTable";
import { useElementPlus } from "@/plugins/elementPlus";
import { useI18n } from "@/plugins/i18n";
// 响应式本地存储
import { injectResponsiveStorage } from "@/utils/responsive";
import { useBrandStoreHook } from "@/store/modules/brand";

// 引入重置样式
import "./style/reset.scss";
// 导入公共样式
import "./style/index.scss";
import "./style/tailwind.css";
import "element-plus/dist/index.css";
// 导入字体图标
import "./assets/iconfont/iconfont.js";
import "./assets/iconfont/iconfont.css";
// 全局注册vue-tippy
import "tippy.js/dist/tippy.css";
import "tippy.js/themes/light.css";
import VueTippy from "vue-tippy";

const app = createApp(App);


app.use(VueTippy);


getPlatformConfig(app).then(async config => {
  app.use(router);
  app.use(pinia)
  void useBrandStoreHook().fetchBrand()
  injectResponsiveStorage(app, config);
  app
    .use(useI18n)
    .use(useElementPlus)
    .use(useVxeTable)
  app.mount("#app");
});
