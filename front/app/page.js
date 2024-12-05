'use client';

import { useState, useEffect } from 'react';

export default function Home() {
  const [tasks, setTasks] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const response = await fetch('http://localhost:8000/tasks/');
      const data = await response.json();
      setTasks(data);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    }
  };

  const generateTasks = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch('http://localhost:8000/tasks/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      });
      const generatedTasks = await response.json();
      setTasks([...tasks, ...generatedTasks]);
      setPrompt('');
    } catch (error) {
      console.error('Error generating tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleTaskComplete = async (taskId) => {
    try {
      await fetch(`http://localhost:8000/tasks/${taskId}/complete`, {
        method: 'PUT',
      });
      fetchTasks();
    } catch (error) {
      console.error('Error toggling task:', error);
    }
  };

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-gray-800">Smart Todo List</h1>
        
        <form onSubmit={generateTasks} className="mb-8">
          <div className="flex gap-4">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe your tasks (e.g., 'Plan a weekend trip to Paris')"
              className="flex-1 p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Generating...' : 'Generate Tasks'}
            </button>
          </div>
        </form>

        <div className="space-y-4">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <input
                    type="checkbox"
                    checked={task.is_completed}
                    onChange={() => toggleTaskComplete(task.id)}
                    className="mt-1.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <h3 className={`text-lg font-semibold ${task.is_completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                      {task.title}
                    </h3>
                    {task.description && (
                      <p className="mt-1 text-gray-600">{task.description}</p>
                    )}
                    <div className="mt-2 flex gap-2">
                      <span className={`px-2 py-1 rounded text-sm ${
                        task.priority === 'High' ? 'bg-red-100 text-red-800' :
                        task.priority === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {task.priority}
                      </span>
                      {task.due_date && (
                        <span className="px-2 py-1 rounded text-sm bg-gray-100 text-gray-800">
                          Due: {new Date(task.due_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
