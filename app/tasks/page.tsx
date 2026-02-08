'use client';

import { useState, useEffect } from 'react';
import { Table, Card, Statistic, Button, Space, Tag, Input, Select, Row, Col, message, Modal, Tooltip } from 'antd';
import { ReloadOutlined, DeleteOutlined, PauseOutlined, PlayCircleOutlined, SearchOutlined, RetweetOutlined } from '@ant-design/icons';
import { useTasks } from '@/hooks/useTasks';

interface Task {
  id: string;
  url: string;
  status: string;
  progress?: number;
  createdAt: string;
  updatedAt: string;
}

interface TableTask extends Task {
  key: string;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<TableTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [searchText, setSearchText] = useState('');
  const { pauseTask, resumeTask, retryTask, cancelTask, deleteTask } = useTasks();

  const fetchTasks = async (): Promise<void> => {
    setLoading(true);
    try {
      const res = await fetch('/api/tasks');
      if (res.ok) {
        const data = await res.json();
        setTasks(data.map((task: Task) => ({ ...task, key: task.id })));
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
      message.error('加载任务失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 5000);
    return () => {
      clearInterval(interval);
    };
  }, []);

  const getStatusColor = (status: string): string => {
    const colorMap: Record<string, string> = {
      downloading: 'processing',
      running: 'processing',
      completed: 'success',
      failed: 'error',
      queued: 'default',
      paused: 'warning',
      compressing: 'processing',
      uploading: 'processing',
    };
    return colorMap[status] || 'default';
  };

  const getStatusLabel = (status: string): string => {
    const labelMap: Record<string, string> = {
      downloading: '下载中',
      running: '运行中',
      completed: '已完成',
      failed: '失败',
      queued: '等待中',
      paused: '已暂停',
      compressing: '压缩中',
      uploading: '上传中',
    };
    return labelMap[status] || status;
  };

  const filteredTasks = tasks.filter((task) => {
    const matchesStatus = !statusFilter || task.status === statusFilter;
    const matchesSearch = !searchText || task.url.toLowerCase().includes(searchText.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const stats = {
    total: tasks.length,
    completed: tasks.filter((t) => t.status === 'completed').length,
    downloading: tasks.filter((t) => t.status === 'downloading' || t.status === 'running').length,
    failed: tasks.filter((t) => t.status === 'failed').length,
  };

  // 暂停
  const handlePause = async (taskId: string) => {
    await pauseTask(taskId);
    await fetchTasks();
  };

  // 恢复
  const handleResume = async (taskId: string) => {
    await resumeTask(taskId);
    await fetchTasks();
  };

  // 重试
  const handleRetry = async (taskId: string) => {
    await retryTask(taskId);
    await fetchTasks();
  };

  // 取消
  const handleCancel = (taskId: string) => {
    Modal.confirm({
      title: '取消任务',
      content: '确定要取消此任务吗？',
      okText: '确定',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        await cancelTask(taskId);
        await fetchTasks();
      },
    });
  };

  // 删除
  const handleDelete = (taskId: string) => {
    Modal.confirm({
      title: '删除任务',
      content: '确定要删除此任务吗？此操作不可恢复。',
      okText: '确定',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        await deleteTask(taskId);
        await fetchTasks();
      },
    });
  };

  const renderActionButtons = (record: TableTask): React.ReactNode => {
    const buttons = [];

    if (record.status === 'running' || record.status === 'downloading') {
      buttons.push(
        <Tooltip key="pause" title="暂停任务">
          <Button
            type="text"
            size="small"
            icon={<PauseOutlined />}
            onClick={() => handlePause(record.id)}
          >
            暂停
          </Button>
        </Tooltip>
      );
    }

    if (record.status === 'paused') {
      buttons.push(
        <Tooltip key="resume" title="恢复任务">
          <Button
            type="text"
            size="small"
            icon={<PlayCircleOutlined />}
            onClick={() => handleResume(record.id)}
          >
            恢复
          </Button>
        </Tooltip>
      );
    }

    if (record.status === 'failed' || record.status === 'completed') {
      buttons.push(
        <Tooltip key="retry" title="重试任务">
          <Button
            type="text"
            size="small"
            icon={<RetweetOutlined />}
            onClick={() => handleRetry(record.id)}
          >
            重试
          </Button>
        </Tooltip>
      );
    }

    if (record.status === 'queued' || record.status === 'running' || record.status === 'downloading') {
      buttons.push(
        <Tooltip key="cancel" title="取消任务">
          <Button
            type="text"
            danger
            size="small"
            onClick={() => handleCancel(record.id)}
          >
            取消
          </Button>
        </Tooltip>
      );
    }

    buttons.push(
      <Tooltip key="delete" title="删除任务记录">
        <Button
          type="text"
          danger
          size="small"
          icon={<DeleteOutlined />}
          onClick={() => handleDelete(record.id)}
        >
          删除
        </Button>
      </Tooltip>
    );

    return <Space size="small">{buttons}</Space>;
  };

  const columns = [
    {
      title: '任务 ID',
      dataIndex: 'id',
      key: 'id',
      width: 150,
      render: (text: string) => <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>{text.slice(0, 8)}</span>,
    },
    {
      title: '下载链接',
      dataIndex: 'url',
      key: 'url',
      ellipsis: true,
      render: (text: string) => <Tooltip title={text}><span>{text}</span></Tooltip>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => <Tag color={getStatusColor(status)}>{getStatusLabel(status)}</Tag>,
    },
    {
      title: '进度',
      dataIndex: 'progress',
      key: 'progress',
      width: 100,
      render: (progress: number = 0) => `${progress}%`,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_text: string, record: TableTask) => renderActionButtons(record),
    },
  ];

  return (
    <div style={{ padding: '24px', minHeight: '100vh', backgroundColor: '#0a0e27' }}>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* 统计卡片 */}
        <Row gutter={16}>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic title="总任务数" value={stats.total} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title="已完成"
                value={stats.completed}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title="进行中"
                value={stats.downloading}
                valueStyle={{ color: '#1677ff' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title="失败"
                value={stats.failed}
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Card>
          </Col>
        </Row>

        {/* 搜索和过滤 */}
        <Card>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Input
                placeholder="搜索下载链接..."
                prefix={<SearchOutlined />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Select
                placeholder="按状态过滤"
                allowClear
                value={statusFilter}
                onChange={setStatusFilter}
                style={{ width: '100%' }}
              >
                <Select.Option value="running">运行中</Select.Option>
                <Select.Option value="downloading">下载中</Select.Option>
                <Select.Option value="completed">已完成</Select.Option>
                <Select.Option value="failed">失败</Select.Option>
                <Select.Option value="queued">等待中</Select.Option>
                <Select.Option value="paused">已暂停</Select.Option>
              </Select>
            </Col>
            <Col xs={24} sm={24} md={8}>
              <Button
                type="primary"
                icon={<ReloadOutlined />}
                loading={loading}
                onClick={fetchTasks}
                block
              >
                刷新
              </Button>
            </Col>
          </Row>
        </Card>

        {/* 任务表格 */}
        <Card title="任务列表">
          <Table
            columns={columns}
            dataSource={filteredTasks}
            loading={loading}
            pagination={{
              pageSize: 10,
              total: filteredTasks.length,
              showQuickJumper: true,
              showTotal: (total) => `共 ${total} 个任务`,
            }}
            scroll={{ x: 1200 }}
          />
        </Card>
      </Space>
    </div>
  );
}
