'use client';

import { useState, useCallback } from 'react';
import { message } from 'antd';

export interface ServerStatus {
  system: {
    uptime: string;
    platform: string;
    cpu_usage: number;
  };
  memory: {
    total: number;
    used: number;
    percent: number;
  };
  disk: {
    total: number;
    used: number;
    percent: number;
  };
  application: {
    active_tasks: number;
    versions: Record<string, string>;
  };
}

export interface SystemInfo {
  system: {
    platform: string;
    arch: string;
    uptime: number;
  };
  cpu: {
    cores: number;
    model: string;
    speed: number;
    usage: number;
    loadAverage: {
      oneMinute: number;
      fiveMinutes: number;
      fifteenMinutes: number;
    };
  };
  memory: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };
  timestamp: string;
}

export function useAPI() {
  const [loading, setLoading] = useState(false);

  // 认证相关
  const login = useCallback(async (username: string, password: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();
      if (data.success) {
        message.success(data.message || '登录成功');
      } else {
        message.error(data.error || '登录失败');
      }
      return { success: data.success, data };
    } catch (err) {
      console.error('Login error:', err);
      message.error('登录请求失败');
      return { success: false, error: err };
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/logout', { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        message.success(data.message || '已登出');
      } else {
        message.error(data.error || '登出失败');
      }
      return { success: data.success, data };
    } catch (err) {
      console.error('Logout error:', err);
      message.error('登出请求失败');
      return { success: false, error: err };
    } finally {
      setLoading(false);
    }
  }, []);

  const getCurrentUser = useCallback(async () => {
    try {
      const response = await fetch('/api/me');
      const data = await response.json();
      return data.authenticated ? data.user : null;
    } catch (err) {
      console.error('Get user error:', err);
      return null;
    }
  }, []);

  // 系统信息
  const getServerStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/server-status');
      const data = await response.json();
      return data.success ? data : null;
    } catch (err) {
      console.error('Server status error:', err);
      message.error('获取服务器状态失败');
      return null;
    }
  }, []);

  const getSystemInfo = useCallback(async () => {
    try {
      const response = await fetch('/api/system-info');
      const data = await response.json();
      return data.success ? data : null;
    } catch (err) {
      console.error('System info error:', err);
      message.error('获取系统信息失败');
      return null;
    }
  }, []);

  // 更新和 Changelog
  const getChangelog = useCallback(async () => {
    try {
      const response = await fetch('/api/changelog');
      if (response.ok) {
        return await response.text();
      }
      message.error('获取 Changelog 失败');
      return null;
        } catch (err) {
      console.error('Get changelog error:', err);
      message.error('获取 Changelog 失败');
      return null;
    }
  }, []);

  const checkUpdates = useCallback(async () => {
    try {
      const response = await fetch('/api/update');
      const data = await response.json();
      return data.success ? data : null;
        } catch (err) {
      console.error('Check updates error:', err);
      message.error('检查更新失败');
      return null;
    }
  }, []);

  // 配置
  const getConfig = useCallback(async () => {
    try {
      const response = await fetch('/api/config');
      const data = await response.json();
      return data.success ? data.data : null;
        } catch (err) {
      console.error('Get config error:', err);
      message.error('获取配置失败');
      return null;
    }
  }, []);

  const saveConfig = useCallback(async (config: Record<string, string>) => {
    try {
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      const data = await response.json();
      if (data.success) {
        message.success(data.message || '配置已保存');
      } else {
        message.error(data.error || '保存配置失败');
      }
      return { success: data.success, data };
    } catch (err) {
      console.error('Save config error:', err);
      message.error('保存配置失败');
      return { success: false, error: err };
    }
  }, []);

  // 数据库
  const cleanupDatabase = useCallback(async () => {
    try {
      const response = await fetch('/api/database/cleanup', { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        message.success(data.message || '清理完成');
      } else {
        message.error(data.error || '清理失败');
      }
      return { success: data.success, data };
    } catch (err) {
      console.error('Database cleanup error:', err);
      message.error('数据库清理失败');
      return { success: false, error: err };
    }
  }, []);

  // 日志
  const getLog = useCallback(async (filename: string, accessKey: string) => {
    try {
      const response = await fetch(`/api/logs/${filename}?access_key=${accessKey}`);
      if (response.ok) {
        return await response.text();
      }
      message.error('获取日志失败');
      return null;
        } catch (err) {
      console.error('Get log error:', err);
      message.error('获取日志失败');
      return null;
    }
  }, []);

  return {
    loading,
    // 认证
    login,
    logout,
    getCurrentUser,
    // 系统
    getServerStatus,
    getSystemInfo,
    // 更新
    getChangelog,
    checkUpdates,
    // 配置
    getConfig,
    saveConfig,
    // 数据库
    cleanupDatabase,
    // 日志
    getLog,
  };
}
