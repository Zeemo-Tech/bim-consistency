/**
 * 组织管理 API 测试文件
 * 用于演示如何调用组织管理相关的 API 接口
 */

import {
  getOrganizations,
  createOrganization,
  updateOrganization,
  deleteOrganization,
  assignMember,
  inviteMember,
} from './organization'

/**
 * 测试获取组织列表
 */
export async function testGetOrganizations() {
  console.log('=== 测试获取组织列表 ===')
  try {
    const response = await getOrganizations(1, 20)
    console.log('响应结果:', response)

    if (response.code === 0) {
      console.log('当前组织:', response.data.current)
      console.log('子组织列表:', response.data.children.list)
      console.log('总数:', response.data.children.total)
    }

    return response
  } catch (error) {
    console.error('获取组织列表失败:', error)
    throw error
  }
}

/**
 * 测试创建组织
 */
export async function testCreateOrganization() {
  console.log('=== 测试创建组织 ===')
  try {
    const params = {
      name: '测试组织',
      address: '测试地址',
      contactPerson: '张三',
      contactPhone: '13800138000',
      description: '这是一个测试组织',
      email: 'test@example.com',
    }


    const response = await createOrganization(params)
    console.log('响应结果:', response)

    if (response.code === 0) {
      console.log('创建成功，新组织ID:', response.data.id)
    }

    return response
  } catch (error) {
    console.error('创建组织失败:', error)
    throw error
  }
}

/**
 * 测试更新组织
 */
export async function testUpdateOrganization(id: number) {
  try {
    const params = {
      name: '更新后的组织名称',
      address: '更新后的地址',
      contactPerson: '李四',
      contactPhone: '13900139000',
      description: '组织信息已更新',
    }

    console.log('更新参数:', params)
    const response = await updateOrganization(id, params)
    console.log('响应结果:', response)

    if (response.code === 0) {
      console.log('更新成功')
    }

    return response
  } catch (error) {
    console.error('更新组织失败:', error)
    throw error
  }
}

/**
 * 测试删除组织
 */
export async function testDeleteOrganization(id: number) {
  console.log('=== 测试删除组织 ===')
  try {
    console.log('删除组织ID:', id)
    const response = await deleteOrganization(id)
    console.log('响应结果:', response)

    if (response.code === 0) {
      console.log('删除成功')
    }

    return response
  } catch (error) {
    console.error('删除组织失败:', error)
    throw error
  }
}

/**
 * 测试分配成员
 */
export async function testAssignMember() {
  try {
    const params = {
      userId: 1,
      roleId: 2,
      targetOrganizationId: 3,
    }

    const response = await assignMember(params)

    if (response.code === 0) {
      console.log('分配成功')
    }

    return response
  } catch (error) {
    console.error('分配成员失败:', error)
    throw error
  }
}

/**
 * 测试邀请成员
 */
export async function testInviteMember() {
  console.log('=== 测试邀请成员 ===')
  try {
    const params = {
      displayName: '王五',
      email: 'wangwu@example.com',
      phone: '13700137000',
      roleId: 2,
    }

    console.log('邀请参数:', params)
    const response = await inviteMember(params)
    console.log('响应结果:', response)

    if (response.code === 0) {
      console.log('邀请成功')
    }

    return response
  } catch (error) {
    console.error('邀请成员失败:', error)
    throw error
  }
}

/**
 * 运行所有测试（仅用于演示，实际使用时请根据需要调用）
 */
export async function runAllTests() {
  console.log('开始运行组织管理 API 测试...')

  try {
    // 1. 获取组织列表
    await testGetOrganizations()

    // 2. 创建组织
    const createResult = await testCreateOrganization()
    const newOrgId = createResult.data?.id

    // 3. 更新组织（如果创建成功）
    if (newOrgId) {
      await testUpdateOrganization(newOrgId)
    }

    // 4. 分配成员
    await testAssignMember()

    // 5. 邀请成员
    await testInviteMember()

    // 6. 删除组织（如果创建成功）
    if (newOrgId) {
      await testDeleteOrganization(newOrgId)
    }

    console.log('所有测试完成！')
  } catch (error) {
    console.error('测试过程中发生错误:', error)
  }
}
