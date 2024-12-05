'use client';

import { useState, useEffect } from 'react';

function TaskAssistanceModal({ task, onClose }) {
  const [assistance, setAssistance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAssistance();
  }, [task.id]);

  const fetchAssistance = async () => {
    try {
      const response = await fetch(`http://localhost:8000/tasks/${task.id}/assistance`);
      if (!response.ok) throw new Error('Failed to fetch assistance');
      const data = await response.json();
      setAssistance(data);
      setError(null);
    } catch (error) {
      console.error('Error fetching assistance:', error);
      setError('Failed to load task assistance. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-800">{task.title}</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-100 text-red-700 rounded">
              {error}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Difficulty Level */}
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-sm ${
                  assistance.difficulty_level === 'Easy' ? 'bg-green-100 text-green-800' :
                  assistance.difficulty_level === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {assistance.difficulty_level}
                </span>
                <span className="text-gray-600">• Estimated time: {assistance.estimated_time}</span>
              </div>

              {/* Steps */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Steps to Complete</h3>
                <div className="space-y-3">
                  {assistance.steps.map((step) => (
                    <div key={step.step} className="flex gap-3">
                      <div className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center">
                        {step.step}
                      </div>
                      <p className="text-gray-700">{step.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Resources */}
              {assistance.resources.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Useful Resources</h3>
                  <div className="space-y-3">
                    {assistance.resources.map((resource, index) => (
                      <div key={index} className="bg-gray-50 p-3 rounded">
                        <a
                          href={resource.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          {resource.title}
                        </a>
                        <p className="text-sm text-gray-600 mt-1">{resource.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tips */}
              {assistance.tips.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Tips & Best Practices</h3>
                  <ul className="list-disc list-inside space-y-2">
                    {assistance.tips.map((tip, index) => (
                      <li key={index} className="text-gray-700">{tip}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [tasks, setTasks] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [filters, setFilters] = useState({
    search: '',
    category: '',
    priority: '',
    completed: null,
  });
  const [error, setError] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);

  useEffect(() => {
    fetchTasks();
    fetchCategories();
  }, []);

  useEffect(() => {
    if (filters.search || filters.category || filters.priority || filters.completed !== null) {
      searchTasks();
    } else {
      fetchTasks();
    }
  }, [filters]);

  const fetchCategories = async () => {
    try {
      const response = await fetch('http://localhost:8000/tasks/categories');
      if (!response.ok) throw new Error('Failed to fetch categories');
      const data = await response.json();
      setCategories(data);
    } catch (error) {
      console.error('Error fetching categories:', error);
      setError('Failed to fetch categories. Please try again later.');
    }
  };

  const searchTasks = async () => {
    try {
      const queryParams = new URLSearchParams();
      if (filters.search) queryParams.append('q', filters.search);
      if (filters.category) queryParams.append('category', filters.category);
      if (filters.priority) queryParams.append('priority', filters.priority);
      if (filters.completed !== null) queryParams.append('completed', filters.completed);

      const response = await fetch(`http://localhost:8000/tasks/search?${queryParams}`);
      if (!response.ok) throw new Error('Failed to search tasks');
      const data = await response.json();
      setTasks(data);
      setError(null);
    } catch (error) {
      console.error('Error searching tasks:', error);
      setError('Failed to search tasks. Please try again later.');
    }
  };

  const fetchTasks = async () => {
    try {
      const response = await fetch('http://localhost:8000/tasks/');
      if (!response.ok) throw new Error('Failed to fetch tasks');
      const data = await response.json();
      setTasks(data);
      setError(null);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      setError('Failed to fetch tasks. Please try again later.');
    }
  };

  const generateTasks = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:8000/tasks/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(prompt),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const generatedTasks = await response.json();
      if (Array.isArray(generatedTasks)) {
        for (const task of generatedTasks) {
          const saveResponse = await fetch('http://localhost:8000/tasks/', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(task),
          });
          if (!saveResponse.ok) {
            throw new Error('Failed to save task');
          }
          const savedTask = await saveResponse.json();
          setTasks(prevTasks => [...prevTasks, savedTask]);
        }
        setPrompt('');
        fetchCategories(); // Refresh categories after adding new tasks
      } else {
        throw new Error('Unexpected response format');
      }
    } catch (error) {
      console.error('Error generating tasks:', error);
      setError('Failed to generate tasks. Please try again later.');
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

  const updateTaskProgress = async (taskId, progress) => {
    try {
      await fetch(`http://localhost:8000/tasks/${taskId}/progress`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(progress),
      });
      fetchTasks();
    } catch (error) {
      console.error('Error updating progress:', error);
    }
  };

  const addTaskNote = async (taskId, note) => {
    try {
      await fetch(`http://localhost:8000/tasks/${taskId}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(note),
      });
      fetchTasks();
    } catch (error) {
      console.error('Error adding note:', error);
    }
  };

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-gray-800">Smart Todo List</h1>
        
        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}
        
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

        {/* Filters */}
        <div className="mb-6 p-4 bg-white rounded-lg shadow">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <input
              type="text"
              placeholder="Search tasks..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="p-2 border rounded"
            />
            <select
              value={filters.category}
              onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
              className="p-2 border rounded"
            >
              <option value="">All Categories</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            <select
              value={filters.priority}
              onChange={(e) => setFilters(prev => ({ ...prev, priority: e.target.value }))}
              className="p-2 border rounded"
            >
              <option value="">All Priorities</option>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
            <select
              value={filters.completed === null ? '' : filters.completed.toString()}
              onChange={(e) => setFilters(prev => ({ 
                ...prev, 
                completed: e.target.value === '' ? null : e.target.value === 'true'
              }))}
              className="p-2 border rounded"
            >
              <option value="">All Status</option>
              <option value="false">Active</option>
              <option value="true">Completed</option>
            </select>
          </div>
        </div>

        <div className="space-y-4">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setSelectedTask(task)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  <input
                    type="checkbox"
                    checked={task.is_completed}
                    onChange={(e) => {
                      e.stopPropagation();
                      toggleTaskComplete(task.id);
                    }}
                    className="mt-1.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <h3 className={`text-lg font-semibold ${task.is_completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                      {task.title}
                    </h3>
                    {task.description && (
                      <p className="mt-1 text-gray-600">{task.description}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className={`px-2 py-1 rounded text-sm ${
                        task.priority === 'High' ? 'bg-red-100 text-red-800' :
                        task.priority === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {task.priority}
                      </span>
                      {task.category && (
                        <span className="px-2 py-1 rounded text-sm bg-purple-100 text-purple-800">
                          {task.category}
                        </span>
                      )}
                      {task.due_date && (
                        <span className="px-2 py-1 rounded text-sm bg-gray-100 text-gray-800">
                          Due: {new Date(task.due_date).toLocaleDateString()}
                        </span>
                      )}
                      {task.tags && task.tags.map(tag => (
                        <span key={tag} className="px-2 py-1 rounded text-sm bg-blue-100 text-blue-800">
                          #{tag}
                        </span>
                      ))}
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="mt-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-200 rounded-full">
                          <div
                            className="h-2 bg-blue-600 rounded-full"
                            style={{ width: `${task.progress}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-600">{task.progress}%</span>
                      </div>
                    </div>

                    {/* Notes Section */}
                    {task.notes && task.notes.length > 0 && (
                      <div className="mt-3 space-y-2">
                        <h4 className="font-medium text-gray-700">Notes:</h4>
                        {task.notes.map((note, index) => (
                          <p key={index} className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                            {note}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {selectedTask && (
          <TaskAssistanceModal
            task={selectedTask}
            onClose={() => setSelectedTask(null)}
          />
        )}
      </div>
    </main>
  );
}
