import { http } from "@/utils/http";

/** 通用响应结果类型 */
export interface Result<T = any> {
  code: number;
  data: T;
  msg: string;
}

// 项目相关接口类型定义
export interface ProjectData {
  id?: number;
  name: string;
  description: string;
  location: string;
  status: "planning" | "in_progress" | "completed" | "archived";
  deadline?: string;
  memberCount?: number;
  fileCount?: number;
  fileTypeCounts?: Array<{
    type: string;
    count: number;
  }>;
  organizationId?: number;
}

export interface ProjectListResponse {
  list: ProjectData[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ProjectListParams {
  page?: number;
  pageSize?: number;
  keyword?: string;
  status?: string;
}

export interface ProjectActivity {
  id: number;
  action: string;
  createdAt: string;
  message: string;
  operatorId: number;
  operatorName: string;
}

export interface ProjectActivitiesResponse {
  list: ProjectActivity[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ProjectMember {
  id: number;
  userId: number;
  username: string;
  displayName: string;
  email: string;
  phone: string;
  roleName: string;
  joinedAt: string;
}

export interface ProjectMembersResponse {
  list: ProjectMember[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ActivityListParams {
  page?: number;
  pageSize?: number;
}

export interface MemberListParams {
  page?: number;
  pageSize?: number;
}

export interface InviteMembersParams {
  userIds: number[];
}

// 组织成员信息类型
export interface OrganizationMember {
  id: number;
  userId: number;
  username: string;
  displayName: string;
  email: string;
  phone: string;
  status: string;
  role: {
    id: number;
    name: string;
    description: string;
    color: string;
    bypassPermission: boolean;
    isSystem: boolean;
  };
}

export interface OrganizationMembersResponse {
  list: OrganizationMember[];
  page: number;
  pageSize: number;
  total: number;
}

export interface MemberListParams {
  page?: number;
  pageSize?: number;
}

// 创建项目
export const createProject = (data: Omit<ProjectData, "id" | "memberCount" | "organizationId">) => {
  return http.request<Result<ProjectData>>("post", "/api/projects", {
    data,
  });
};

// 获取项目列表
export const getProjectList = (params?: ProjectListParams) => {
  return http.request<Result<ProjectListResponse>>("get", "/api/projects", {
    params,
  });
};

// 获取所有项目列表（用于下拉选择，不传分页参数获取全部）
export const getAllProjects = (keyword?: string) => {
  return http.request<Result<ProjectListResponse>>("get", "/api/projects", {
    params: {
      page: 1,
      pageSize: 9999,
      keyword,
    },
  });
};

// 更新项目
export const updateProject = (id: number, data: Partial<ProjectData>) => {
  return http.request<Result<ProjectData>>("patch", `/api/projects/${id}`, {
    data,
  });
};

// 删除项目
export const deleteProject = (id: number) => {
  return http.request<Result<string>>("delete", `/api/projects/${id}`);
};

// 获取项目详情
export const getProjectDetail = (id: number) => {
  return http.request<Result<ProjectData>>("get", `/api/projects/${id}`);
};

// 获取项目动态
export const getProjectActivities = (id: number, params?: ActivityListParams) => {
  return http.request<Result<ProjectActivitiesResponse>>("get", `/api/projects/${id}/activities`, {
    params,
  });
};

// 获取项目成员
export const getProjectMembers = (id: number, params?: MemberListParams) => {
  return http.request<Result<ProjectMembersResponse>>("get", `/api/projects/${id}/members`, {
    params,
  });
};

// 邀请项目成员
export const inviteProjectMember = (id: number, params: InviteMembersParams) => {
  return http.request<Result<any>>("post", `/api/projects/${id}/members`, {
    data: params,
  });
};

// 移除项目成员
export const removeProjectMember = (id: number, userId: number) => {
  return http.request<Result<string>>("delete", `/api/projects/${id}/members/${userId}`);
};

// 获取组织成员
export const getOrganizationMembers = (params?: MemberListParams) => {
  return http.request<Result<OrganizationMembersResponse>>("get", "/api/organizations/members", {
    params,
  });
};
