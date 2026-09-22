import Axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type CustomParamsSerializer
} from "axios";
import type {
  PureHttpError,
  RequestMethods,
  PureHttpResponse,
  PureHttpRequestConfig
} from "./types.d";
import { stringify } from "qs";
import { getToken, formatToken, getOrganizationId, removeToken } from "@/utils/auth";
import { useUserStoreHook } from "@/store/modules/user";


const defaultConfig: AxiosRequestConfig = {

  timeout: 20000,
  headers: {
    Accept: "application/json, text/plain, */*",
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest"
  },
  paramsSerializer: {
    serialize: stringify as unknown as CustomParamsSerializer
  }
};

interface WhitelistItem {
  url: string;
  methods?: string[];
  exact?: boolean;
}

const ORG_ID_WHITELIST: (string | WhitelistItem)[] = [
  "/api/me/organizations",
  { url: "/api/organizations", methods: ["POST"], exact: true },
  { url: "/api/organizations/", methods: ["PATCH", "DELETE"] },
  "/api/organizations/assignments"
];

function isUrlWhitelisted(url: string, method: string): boolean {
  const urlWithoutParams = url.split('?')[0];
  const upperMethod = method.toUpperCase();

  return ORG_ID_WHITELIST.some(item => {
    if (typeof item === 'string') {
      // 字符串形式：匹配所有方法
      const match = urlWithoutParams === item || urlWithoutParams.startsWith(item + '/');
      if (match) {
        console.log('[HTTP Whitelist] Matched (all methods):', urlWithoutParams, 'with:', item);
      }
      return match;
    } else {
      const urlMatch = item.exact
        ? urlWithoutParams === item.url
        : (urlWithoutParams === item.url || urlWithoutParams.startsWith(item.url + '/'));

      if (urlMatch) {
        if (!item.methods || item.methods.includes(upperMethod)) {
          return true;
        } else {
          console.log('[HTTP Whitelist] URL matched but method not allowed:', upperMethod, urlWithoutParams, 'allowed:', item.methods);
        }
      }
      return false;
    }
  });
}

class PureHttp {
  constructor() {
    this.httpInterceptorsRequest();
    this.httpInterceptorsResponse();
  }

  /** `token`过期后，暂存待执行的请求 */
  private static requests = [];

  /** 防止重复刷新`token` */
  private static isRefreshing = false;

  /** 初始化配置对象 */
  private static initConfig: PureHttpRequestConfig = {};

  /** 保存当前`Axios`实例对象 */
  private static axiosInstance: AxiosInstance = Axios.create(defaultConfig);

  /** 重连原始请求 */
  private static retryOriginalRequest(config: PureHttpRequestConfig) {
    return new Promise(resolve => {
      PureHttp.requests.push((token: string) => {
        config.headers["Authorization"] = formatToken(token);
        // 添加组织ID头（排除不需要组织ID的接口）
        const needsOrgId = !isUrlWhitelisted(config.url, config.method || 'GET');
        if (needsOrgId) {
          const orgId = getOrganizationId();
          if (orgId) {
            config.headers["X-Organization-Id"] = orgId.toString();
          }
        }
        resolve(config);
      });
    });
  }

  /** 请求拦截 */
  private httpInterceptorsRequest(): void {
    PureHttp.axiosInstance.interceptors.request.use(
      async (config: PureHttpRequestConfig): Promise<any> => {
        // 优先判断post/get等方法是否传入回调，否则执行初始化设置等回调
        if (typeof config.beforeRequestCallback === "function") {
          config.beforeRequestCallback(config);
          return config;
        }
        if (PureHttp.initConfig.beforeRequestCallback) {
          PureHttp.initConfig.beforeRequestCallback(config);
          return config;
        }
        /** 请求白名单，放置一些不需要`token`的接口（通过设置请求白名单，防止`token`过期后再请求造成的死循环问题） */
        const whiteList = ["/refresh-token", "/login"];
        return whiteList.some(url => config.url.endsWith(url))
          ? config
          : new Promise(resolve => {
              const data = getToken();
              if (data) {
                const now = new Date().getTime();
                const expired = (typeof data.expires === 'string' ? parseInt(data.expires) : data.expires) - now <= 0;
                if (expired) {
                  if (!PureHttp.isRefreshing) {
                    PureHttp.isRefreshing = true;
                    // token过期刷新
                    useUserStoreHook()
                      .handRefreshToken({ refreshToken: data.refreshToken })
                      .then(res => {
                        const token = res?.data?.accessToken;
                        if (!token) {
                          removeToken();
                          PureHttp.requests = [];
                          resolve(config);
                          return;
                        }
                        config.headers["Authorization"] = formatToken(token);
                        // 添加组织ID头（排除不需要组织ID的接口）
                        const needsOrgId = !isUrlWhitelisted(config.url, config.method || 'GET');
                        if (needsOrgId) {
                          const orgId = getOrganizationId();
                          if (orgId) {
                            config.headers["X-Organization-Id"] = orgId.toString();
                          }
                        }
                        PureHttp.requests.forEach(cb => cb(token));
                        PureHttp.requests = [];
                      })
                      .finally(() => {
                        PureHttp.isRefreshing = false;
                      });
                  }
                  resolve(PureHttp.retryOriginalRequest(config));
                } else {
                  config.headers["Authorization"] = formatToken(
                    data.accessToken
                  );
                  // 添加组织ID头（排除不需要组织ID的接口）
                  const isWhitelisted = isUrlWhitelisted(config.url, config.method || 'GET');
                  const needsOrgId = !isWhitelisted;

                  if (needsOrgId) {
                    const orgId = getOrganizationId();
                    if (orgId) {
                      config.headers["X-Organization-Id"] = orgId.toString();
                    } else {
                      console.warn('[HTTP] ✗ No organizationId available for:', config.url);
                    }
                  } else {
                    console.log('[HTTP] ○ Skipped X-Organization-Id (whitelisted)');
                  }
                  resolve(config);
                }
              } else {
                // 即使没有token，也尝试添加组织ID头（排除不需要组织ID的接口）
                const needsOrgId = !isUrlWhitelisted(config.url, config.method || 'GET');
                if (needsOrgId) {
                  const orgId = getOrganizationId();
                  if (orgId) {
                    config.headers["X-Organization-Id"] = orgId.toString();
                  }
                }
                resolve(config);
              }
            });
      },
      error => {
        return Promise.reject(error);
      }
    );
  }

  /** 响应拦截 */
  private httpInterceptorsResponse(): void {
    const instance = PureHttp.axiosInstance;
    instance.interceptors.response.use(
      (response: PureHttpResponse) => {
        const $config = response.config;
        if (typeof $config.beforeResponseCallback === "function") {
          $config.beforeResponseCallback(response);
          return response.data;
        }
        if (PureHttp.initConfig.beforeResponseCallback) {
          PureHttp.initConfig.beforeResponseCallback(response);
          return response.data;
        }
        return response.data;
      },
      (error: PureHttpError) => {
        const $error = error;
        $error.isCancelRequest = Axios.isCancel($error);

        // 后端在并发压力下会偶发返回 403/5xx（数据库瞬时错误），
        // 对幂等的 GET 请求做有限次退避重试，避免页面直接报错
        const retryConfig = $error.config as any;
        const status = $error.response?.status;
        const method = (retryConfig?.method || "get").toLowerCase();
        const retryableStatus = [403, 500, 502, 503, 504];
        const maxRetries = 2;

        if (
          retryConfig &&
          method === "get" &&
          retryableStatus.includes(status) &&
          (retryConfig.__retryCount || 0) < maxRetries
        ) {
          retryConfig.__retryCount = (retryConfig.__retryCount || 0) + 1;
          const delay = 200 * retryConfig.__retryCount;
          return new Promise(resolve => setTimeout(resolve, delay)).then(() =>
            instance.request(retryConfig)
          );
        }

        // 所有的响应异常 区分来源为取消请求/非取消请求
        return Promise.reject($error);
      }
    );
  }

  /** 通用请求工具函数 */
  public request<T>(
    method: RequestMethods,
    url: string,
    param?: AxiosRequestConfig,
    axiosConfig?: PureHttpRequestConfig
  ): Promise<T> {
    const config = {
      method,
      url,
      ...param,
      ...axiosConfig
    } as PureHttpRequestConfig;

    // 单独处理自定义请求/响应回调
    return new Promise((resolve, reject) => {
      PureHttp.axiosInstance
        .request(config)
        .then((response: undefined) => {
          resolve(response);
        })
        .catch(error => {
          reject(error);
        });
    });
  }

  /** 单独抽离的`post`工具函数 */
  public post<T, P>(
    url: string,
    params?: AxiosRequestConfig<P>,
    config?: PureHttpRequestConfig
  ): Promise<T> {
    return this.request<T>("post", url, params, config);
  }

  /** 单独抽离的`get`工具函数 */
  public get<T, P>(
    url: string,
    params?: AxiosRequestConfig<P>,
    config?: PureHttpRequestConfig
  ): Promise<T> {
    return this.request<T>("get", url, params, config);
  }
}

export const http = new PureHttp();
