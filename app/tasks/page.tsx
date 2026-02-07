'use client';

import { useState, useEffect } from 'react';
import { Table, Card, Statistic, Button, Space, Tag, Input, Select, Row, Col, message } from 'antd';
import { ReloadOutlined, DeleteOutlined, PauseOutlined, PlayCircleOutlined, SearchOutlined } from '@ant-design/icons';

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
    downloading: tasks.filter((t) => t.status === 'downloading').length,
    failed: tasks.filter((t) => t.status === 'failed').length,
  };

  const renderActionButtons = (record: TableTask): React.ReactNode => {
    if (record.status === 'downloading') {
      return (
        <Button
          type="text"
          size="small"
          icon={<PauseOutlined />}
          onClick={() => message.info('暂停功能待实现')}
        >
          暂停
        </Button>
      );
    }
    if (record.status === 'paused') {
      return (
        <Button
          type="text"
          size="small"
          icon={<PlayCircleOutlined />}
          onClick={() => message.info('恢复功能待实现')}
        >
          恢复
        </Button>
      );
    }
    return null;
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
      render: (text: string) => <span title={text}>{text}</span>,
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
      width: 150,
      render: (_text: string, record: TableTask) => (
        <Space size="small">
          {renderActionButtons(record)}
          <Button
            type="text"
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => message.info('删除功能待实现')}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
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
                title="下载中"
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
