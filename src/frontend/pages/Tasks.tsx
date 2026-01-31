import React, { useEffect, useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';

interface Task {
  id: number;
  name: string;
  url: string;
  status: string;
  progress: number;
  createdAt: string;
}

const Tasks: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUrl, setNewUrl] = useState('');
  const [newName, setNewName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchTasks = () => {
    fetch('/api/tasks')
      .then(res => res.json())
      .then(data => {
        setTasks(data.tasks);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl) return;

    setSubmitting(true);
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName || newUrl, url: newUrl })
    });
    
    setNewUrl('');
    setNewName('');
    setSubmitting(false);
    fetchTasks();
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Tasks</h1>

      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-xl font-semibold mb-4">Add New Download</h2>
        <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-4">
          <input
            type="text"
            placeholder="Task Name (Optional)"
            className="flex-1 p-2 border rounded"
            value={newName}
            onChange={e => setNewName(e.target.value)}
          />
          <input
            type="url"
            placeholder="Download URL"
            required
            className="flex-[2] p-2 border rounded"
            value={newUrl}
            onChange={e => setNewUrl(e.target.value)}
          />
          <button
            type="submit"
            disabled={submitting}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:bg-blue-300 flex items-center justify-center"
          >
            {submitting ? <Loader2 className="animate-spin" /> : <Plus className="mr-2" />}
            Add Task
          </button>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Progress</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Added</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td className="px-6 py-4 text-center text-gray-500" colSpan={4}>Loading tasks...</td>
              </tr>
            ) : tasks.length === 0 ? (
              <tr>
                <td className="px-6 py-4 text-center text-gray-500" colSpan={4}>No tasks found.</td>
              </tr>
            ) : (
              tasks.map(task => (
                <tr key={task.id}>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{task.name}</div>
                    <div className="text-xs text-gray-500 truncate w-64">{task.url}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                      ${task.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 
                        task.status === 'DOWNLOADING' ? 'bg-blue-100 text-blue-800' : 
                        task.status === 'FAILED' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                      {task.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${task.progress}%` }}></div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(task.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Tasks;