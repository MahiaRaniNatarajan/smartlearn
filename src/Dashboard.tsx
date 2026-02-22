import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { Task, Note, Team, Message, StudyPlan } from './types';
import { 
  LayoutDashboard, 
  CheckSquare, 
  BookOpen, 
  Users, 
  MessageSquare, 
  BrainCircuit, 
  LogOut,
  Plus,
  Send,
  Award,
  Calendar,
  Paperclip,
  UserPlus,
  Clock,
  Book,
  Trash2,
  Check
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { generateQuiz, chatWithAssistant, generateStudyPlan } from './services/geminiService';

export const Dashboard: React.FC = () => {
  const { user, token, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [studyPlans, setStudyPlans] = useState<StudyPlan[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  
  // AI State
  const [quiz, setQuiz] = useState<any[]>([]);
  const [aiChat, setAiChat] = useState<{ role: string, text: string }[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [aiPlanLoading, setAiPlanLoading] = useState(false);
  const [aiPlanResult, setAiPlanResult] = useState<any[]>([]);

  // Team Management State
  const [showAddMember, setShowAddMember] = useState<number | null>(null);
  const [memberUsername, setMemberUsername] = useState('');

  useEffect(() => {
    if (!token) return;

    // Fetch initial data
    const fetchData = async () => {
      const headers = { 'Authorization': `Bearer ${token}` };
      const [tasksRes, notesRes, teamsRes, plansRes] = await Promise.all([
        fetch('/api/tasks', { headers }),
        fetch('/api/notes', { headers }),
        fetch('/api/teams', { headers }),
        fetch('/api/study-plans', { headers })
      ]);
      
      if (tasksRes.ok) setTasks(await tasksRes.json());
      if (notesRes.ok) setNotes(await notesRes.json());
      if (teamsRes.ok) {
        const teamsData = await teamsRes.json();
        setTeams(teamsData);
        if (teamsData.length > 0) setSelectedTeamId(teamsData[0].id);
      }
      if (plansRes.ok) setStudyPlans(await plansRes.json());
    };

    fetchData();

    // Setup WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}`);
    
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'auth', token }));
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'chat') {
        if (msg.teamId === selectedTeamId) {
          setMessages(prev => [...prev, msg]);
        }
      }
    };

    setSocket(ws);
    return () => ws.close();
  }, [token]);

  useEffect(() => {
    if (activeTab === 'chat' && selectedTeamId && token) {
      const fetchMessages = async () => {
        const res = await fetch(`/api/messages?teamId=${selectedTeamId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          setMessages(await res.json());
        }
      };
      fetchMessages();
    }
  }, [activeTab, selectedTeamId, token]);

  const handleAddTask = async (e: any) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        title: formData.get('title'),
        description: formData.get('description'),
        deadline: formData.get('deadline')
      })
    });
    if (res.ok) {
      const newTask = await res.json();
      setTasks([...tasks, newTask]);
      e.target.reset();
    }
  };

  const handleAiChat = async () => {
    if (!aiInput.trim()) return;
    const userMsg = { role: 'user', text: aiInput };
    setAiChat(prev => [...prev, userMsg]);
    setAiInput('');
    
    const response = await chatWithAssistant(aiInput);
    setAiChat(prev => [...prev, { role: 'assistant', text: response || 'Sorry, I could not process that.' }]);
  };

  const handleGenerateQuiz = async (topic: string) => {
    const questions = await generateQuiz(topic);
    setQuiz(questions);
  };

  const analyticsData = [
    { name: 'Mon', completed: 2, total: 5 },
    { name: 'Tue', completed: 4, total: 6 },
    { name: 'Wed', completed: 3, total: 4 },
    { name: 'Thu', completed: 5, total: 7 },
    { name: 'Fri', completed: 6, total: 8 },
    { name: 'Sat', completed: 2, total: 3 },
    { name: 'Sun', completed: 1, total: 2 },
  ];

  return (
    <div className="flex h-screen bg-stone-50 font-sans text-stone-900">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-stone-200 flex flex-col">
        <div className="p-6">
          <h2 className="text-xl font-bold text-emerald-600 flex items-center gap-2">
            <BookOpen size={24} />
            SmartLearn
          </h2>
        </div>
        
        <nav className="flex-1 px-4 space-y-2">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
            { id: 'tasks', icon: CheckSquare, label: 'Tasks' },
            { id: 'notes', icon: BookOpen, label: 'Notes' },
            { id: 'teams', icon: Users, label: 'Teams' },
            { id: 'planner', icon: Calendar, label: 'Study Planner' },
            { id: 'chat', icon: MessageSquare, label: 'Chat' },
            { id: 'ai', icon: BrainCircuit, label: 'AI Assistant' },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === item.id 
                  ? 'bg-emerald-50 text-emerald-700 font-semibold' 
                  : 'text-stone-500 hover:bg-stone-100'
              }`}
            >
              <item.icon size={20} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-stone-100">
          <div className="flex items-center gap-3 p-3 bg-stone-50 rounded-xl mb-4">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold">
              {user?.username[0].toUpperCase()}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-semibold truncate">{user?.username}</p>
              <p className="text-xs text-stone-500 flex items-center gap-1">
                <Award size={12} /> {user?.points} pts
              </p>
            </div>
          </div>
          <button 
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-2 text-red-600 hover:bg-red-50 rounded-xl transition-all"
          >
            <LogOut size={20} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <header>
                <h1 className="text-3xl font-bold">Welcome back, {user?.username}!</h1>
                <p className="text-stone-500">Here's what's happening with your studies today.</p>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100">
                  <h3 className="text-stone-500 text-sm font-medium uppercase tracking-wider mb-2">Tasks Completed</h3>
                  <p className="text-4xl font-bold text-emerald-600">{tasks.filter(t => t.status === 'completed').length}</p>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100">
                  <h3 className="text-stone-500 text-sm font-medium uppercase tracking-wider mb-2">Pending Tasks</h3>
                  <p className="text-4xl font-bold text-amber-600">{tasks.filter(t => t.status === 'pending').length}</p>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100">
                  <h3 className="text-stone-500 text-sm font-medium uppercase tracking-wider mb-2">Team Notes</h3>
                  <p className="text-4xl font-bold text-blue-600">{notes.length}</p>
                </div>
              </div>

              <div className="bg-white p-8 rounded-2xl shadow-sm border border-stone-100">
                <h3 className="text-xl font-bold mb-6">Performance Analytics</h3>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analyticsData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="completed" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="total" fill="#e5e7eb" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'tasks' && (
            <motion.div
              key="tasks"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-8"
            >
              <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Study Tasks</h1>
                <button className="bg-emerald-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-emerald-700">
                  <Plus size={20} /> Add Task
                </button>
              </div>

              <form onSubmit={handleAddTask} className="bg-white p-6 rounded-2xl border border-stone-200 grid grid-cols-1 md:grid-cols-3 gap-4">
                <input name="title" placeholder="Task Title" className="p-3 border rounded-xl" required />
                <input name="deadline" type="date" className="p-3 border rounded-xl" required />
                <button type="submit" className="bg-stone-900 text-white rounded-xl hover:bg-black">Create</button>
              </form>

              <div className="space-y-4">
                {tasks.map(task => (
                  <div key={task.id} className={`bg-white p-4 rounded-xl border border-stone-100 flex items-center justify-between transition-all ${
                    task.status === 'completed' ? 'opacity-60 grayscale' : ''
                  }`}>
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={async () => {
                          const newStatus = task.status === 'completed' ? 'pending' : 'completed';
                          const res = await fetch(`/api/tasks/${task.id}`, {
                            method: 'PATCH',
                            headers: { 
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({ status: newStatus })
                          });
                          if (res.ok) {
                            setTasks(tasks.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
                          }
                        }}
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                          task.status === 'completed' ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-stone-300 hover:border-emerald-500'
                        }`}
                      >
                        {task.status === 'completed' && <Check size={14} />}
                      </button>
                      <div>
                        <h3 className={`font-semibold ${task.status === 'completed' ? 'line-through' : ''}`}>{task.title}</h3>
                        <p className="text-sm text-stone-500">Deadline: {task.deadline}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                        task.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {task.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'notes' && (
            <motion.div
              key="notes"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-8"
            >
              <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Study Notes</h1>
                <button className="bg-emerald-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-emerald-700">
                  <Plus size={20} /> Create Note
                </button>
              </div>

              <form 
                onSubmit={async (e: any) => {
                  e.preventDefault();
                  const formData = new FormData(e.target);
                  const res = await fetch('/api/notes', {
                    method: 'POST',
                    headers: { 
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                      title: formData.get('title'),
                      content: formData.get('content'),
                      team_id: formData.get('team_id') || null,
                      is_public: formData.get('is_public') === 'on'
                    })
                  });
                  if (res.ok) {
                    const newNote = await res.json();
                    setNotes([newNote, ...notes]);
                    e.target.reset();
                  }
                }}
                className="bg-white p-6 rounded-2xl border border-stone-200 space-y-4"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input name="title" placeholder="Note Title" className="p-3 border rounded-xl" required />
                  <select name="team_id" className="p-3 border rounded-xl">
                    <option value="">Personal Note</option>
                    {teams.map(t => <option key={t.id} value={t.id}>Share with {t.name}</option>)}
                  </select>
                </div>
                <textarea name="content" placeholder="Write your notes here..." className="w-full p-3 border rounded-xl h-32" required />
                <div className="flex items-center gap-2">
                  <input type="checkbox" name="is_public" id="is_public" />
                  <label htmlFor="is_public" className="text-sm text-stone-600">Make Publicly Available</label>
                </div>
                <button type="submit" className="bg-stone-900 text-white px-6 py-2 rounded-xl hover:bg-black transition-colors">Save Note</button>
              </form>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {notes.map(note => (
                  <div key={note.id} className="bg-white p-6 rounded-2xl border border-stone-100 shadow-sm hover:shadow-md transition-all">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-xl font-bold">{note.title}</h3>
                      <span className="text-xs bg-stone-100 px-2 py-1 rounded text-stone-500">
                        {note.team_id ? 'Team Shared' : note.is_public ? 'Public' : 'Private'}
                      </span>
                    </div>
                    <p className="text-stone-600 line-clamp-3 mb-4">{note.content}</p>
                    <div className="flex justify-between items-center text-xs text-stone-400">
                      <span>By {note.author || 'Me'}</span>
                      <span>{new Date(note.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'teams' && (
            <motion.div
              key="teams"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-8"
            >
              <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">My Teams</h1>
                <button className="bg-emerald-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-emerald-700">
                  <Plus size={20} /> Create Team
                </button>
              </div>

              <form 
                onSubmit={async (e: any) => {
                  e.preventDefault();
                  const formData = new FormData(e.target);
                  const res = await fetch('/api/teams', {
                    method: 'POST',
                    headers: { 
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ name: formData.get('name') })
                  });
                  if (res.ok) {
                    const newTeam = await res.json();
                    setTeams([...teams, newTeam]);
                    e.target.reset();
                  }
                }}
                className="bg-white p-6 rounded-2xl border border-stone-200 flex gap-4"
              >
                <input name="name" placeholder="Team Name" className="flex-1 p-3 border rounded-xl" required />
                <button type="submit" className="bg-stone-900 text-white px-6 py-2 rounded-xl hover:bg-black">Create</button>
              </form>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {teams.map(team => (
                  <div key={team.id} className="bg-white p-6 rounded-2xl border border-stone-100 shadow-sm flex flex-col items-center text-center relative group">
                    <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mb-4">
                      <Users size={32} />
                    </div>
                    <h3 className="text-xl font-bold mb-2">{team.name}</h3>
                    <p className="text-sm text-stone-500 mb-4">Collaborate and share materials</p>
                    
                    <div className="w-full space-y-2">
                      <button 
                        onClick={() => {
                          setSelectedTeamId(team.id);
                          setActiveTab('chat');
                        }}
                        className="w-full py-2 bg-stone-900 text-white rounded-xl hover:bg-black transition-colors"
                      >
                        Open Chat
                      </button>
                      <button 
                        onClick={() => setShowAddMember(team.id)}
                        className="w-full py-2 border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors flex items-center justify-center gap-2"
                      >
                        <UserPlus size={16} /> Add Member
                      </button>
                      {team.created_by !== user?.id && (
                        <button 
                          onClick={async () => {
                            if (confirm('Are you sure you want to leave this team?')) {
                              const res = await fetch(`/api/teams/${team.id}/leave`, {
                                method: 'POST',
                                headers: { 'Authorization': `Bearer ${token}` }
                              });
                              if (res.ok) {
                                setTeams(teams.filter(t => t.id !== team.id));
                                if (selectedTeamId === team.id) setSelectedTeamId(null);
                              }
                            }
                          }}
                          className="w-full py-2 text-amber-600 hover:bg-amber-50 rounded-xl transition-colors text-sm font-semibold"
                        >
                          Leave Team
                        </button>
                      )}
                    </div>

                    {showAddMember === team.id && (
                      <div className="absolute inset-0 bg-white rounded-2xl p-6 flex flex-col justify-center gap-4 z-10 border-2 border-emerald-500">
                        <h4 className="font-bold">Add Member</h4>
                        <input 
                          placeholder="Username" 
                          className="p-2 border rounded-lg text-sm"
                          value={memberUsername}
                          onChange={(e) => setMemberUsername(e.target.value)}
                        />
                        <div className="flex gap-2">
                          <button 
                            onClick={async () => {
                              const res = await fetch(`/api/teams/${team.id}/members`, {
                                method: 'POST',
                                headers: { 
                                  'Content-Type': 'application/json',
                                  'Authorization': `Bearer ${token}`
                                },
                                body: JSON.stringify({ username: memberUsername })
                              });
                              if (res.ok) {
                                alert('Member added!');
                                setShowAddMember(null);
                                setMemberUsername('');
                              } else {
                                const data = await res.json();
                                alert(data.error);
                              }
                            }}
                            className="flex-1 bg-emerald-600 text-white py-2 rounded-lg text-sm"
                          >
                            Add
                          </button>
                          <button 
                            onClick={() => setShowAddMember(null)}
                            className="flex-1 bg-stone-100 py-2 rounded-lg text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
          {activeTab === 'ai' && (
            <motion.div
              key="ai"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="h-full flex flex-col gap-6"
            >
              <h1 className="text-3xl font-bold">AI Study Assistant</h1>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">
                {/* Chat Section */}
                <div className="bg-white rounded-2xl border border-stone-200 flex flex-col overflow-hidden">
                  <div className="p-4 border-b bg-stone-50 font-semibold">Doubt Clarification Chat</div>
                  <div className="flex-1 p-4 overflow-y-auto space-y-4">
                    {aiChat.map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] p-3 rounded-2xl markdown-body ${
                          msg.role === 'user' ? 'bg-emerald-600 text-white' : 'bg-stone-100 text-stone-800'
                        }`}>
                          <Markdown>{msg.text}</Markdown>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="p-4 border-t flex gap-2">
                    <input 
                      value={aiInput}
                      onChange={(e) => setAiInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAiChat()}
                      placeholder="Ask a question..." 
                      className="flex-1 p-3 border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button onClick={handleAiChat} className="bg-emerald-600 text-white p-3 rounded-xl">
                      <Send size={20} />
                    </button>
                  </div>
                </div>

                {/* Quiz Section */}
                <div className="bg-white rounded-2xl border border-stone-200 flex flex-col overflow-hidden">
                  <div className="p-4 border-b bg-stone-50 font-semibold flex justify-between items-center">
                    <span>Smart Quiz Generator</span>
                    <button 
                      onClick={() => handleGenerateQuiz('Computer Science')}
                      className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded"
                    >
                      Generate New
                    </button>
                  </div>
                  <div className="flex-1 p-6 overflow-y-auto">
                    {quiz.length > 0 ? (
                      <div className="space-y-6">
                        {quiz.map((q, i) => (
                          <div key={i} className="space-y-2">
                            <p className="font-semibold">{i+1}. {q.question}</p>
                            <div className="grid grid-cols-1 gap-2">
                              {q.options.map((opt: string, j: number) => (
                                <button key={j} className="text-left p-2 border rounded-lg hover:bg-stone-50 transition-colors">
                                  {opt}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-stone-400">
                        <BrainCircuit size={48} className="mb-4 opacity-20" />
                        <p>No quiz generated yet.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'planner' && (
            <motion.div
              key="planner"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-8"
            >
              <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Study Planner</h1>
                <div className="flex gap-2">
                  <button className="bg-emerald-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-emerald-700">
                    <Plus size={20} /> New Plan
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Manual Plan Form */}
                <form 
                  onSubmit={async (e: any) => {
                    e.preventDefault();
                    const formData = new FormData(e.target);
                    const res = await fetch('/api/study-plans', {
                      method: 'POST',
                      headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                      },
                      body: JSON.stringify({
                        title: formData.get('title'),
                        content: formData.get('content'),
                        type: formData.get('type'),
                        start_date: formData.get('start_date')
                      })
                    });
                    if (res.ok) {
                      const newPlan = await res.json();
                      setStudyPlans([newPlan, ...studyPlans]);
                      e.target.reset();
                    }
                  }}
                  className="bg-white p-6 rounded-2xl border border-stone-200 space-y-4"
                >
                  <h3 className="font-bold flex items-center gap-2"><Plus size={18} /> Manual Plan</h3>
                  <div className="grid grid-cols-1 gap-4">
                    <input name="title" placeholder="Plan Title" className="p-3 border rounded-xl" required />
                    <div className="grid grid-cols-2 gap-4">
                      <select name="type" className="p-3 border rounded-xl" required>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                      <input name="start_date" type="date" className="p-3 border rounded-xl" required />
                    </div>
                  </div>
                  <textarea name="content" placeholder="Outline your study schedule..." className="w-full p-3 border rounded-xl h-32" required />
                  <button type="submit" className="w-full bg-stone-900 text-white px-6 py-3 rounded-xl hover:bg-black transition-colors">Create Manual Plan</button>
                </form>

                {/* AI Plan Generator */}
                <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 space-y-4">
                  <h3 className="font-bold text-emerald-800 flex items-center gap-2"><BrainCircuit size={18} /> AI Smart Planner</h3>
                  <p className="text-sm text-emerald-700">Tell us your subjects and free time, and we'll build a custom timeline for you.</p>
                  <div className="space-y-4">
                    <input 
                      id="aiSubjects"
                      placeholder="Subjects (e.g., Math, Physics, History)" 
                      className="w-full p-3 border border-emerald-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" 
                    />
                    <input 
                      id="aiFreeTime"
                      placeholder="Free Time (e.g., 6pm-9pm weekdays, all day Sat)" 
                      className="w-full p-3 border border-emerald-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" 
                    />
                    <select id="aiDuration" className="w-full p-3 border border-emerald-200 rounded-xl outline-none">
                      <option value="weekly">Weekly Timeline</option>
                      <option value="monthly">Monthly Timeline</option>
                    </select>
                    <button 
                      onClick={async () => {
                        const subjects = (document.getElementById('aiSubjects') as HTMLInputElement).value;
                        const freeTime = (document.getElementById('aiFreeTime') as HTMLInputElement).value;
                        const duration = (document.getElementById('aiDuration') as HTMLSelectElement).value as 'weekly' | 'monthly';
                        
                        if (!subjects || !freeTime) return alert('Please fill in all fields');
                        
                        setAiPlanLoading(true);
                        try {
                          const result = await generateStudyPlan(subjects, freeTime, duration);
                          setAiPlanResult(result);
                        } catch (e) {
                          alert('Failed to generate plan');
                        } finally {
                          setAiPlanLoading(false);
                        }
                      }}
                      disabled={aiPlanLoading}
                      className="w-full bg-emerald-600 text-white px-6 py-3 rounded-xl hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {aiPlanLoading ? 'Generating...' : <><BrainCircuit size={18} /> Generate AI Timeline</>}
                    </button>
                  </div>
                </div>
              </div>

              {/* AI Result Timeline */}
              {aiPlanResult.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white p-8 rounded-2xl border border-stone-200"
                >
                  <h3 className="text-xl font-bold mb-8 flex items-center gap-2 text-emerald-700">
                    <Clock size={24} /> Your AI Study Timeline
                  </h3>
                  <div className="relative border-l-2 border-emerald-100 ml-4 space-y-8">
                    {aiPlanResult.map((item, i) => (
                      <div key={i} className="relative pl-8">
                        <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-emerald-500 border-4 border-white shadow-sm"></div>
                        <div className="bg-stone-50 p-4 rounded-xl border border-stone-100">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">{item.day} • {item.time}</span>
                            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-semibold">{item.subject}</span>
                          </div>
                          <p className="text-stone-700 font-medium">{item.activity}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button 
                    onClick={async () => {
                      const res = await fetch('/api/study-plans', {
                        method: 'POST',
                        headers: { 
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({
                          title: `AI Generated Plan (${new Date().toLocaleDateString()})`,
                          content: JSON.stringify(aiPlanResult),
                          type: 'weekly',
                          start_date: new Date().toISOString().split('T')[0]
                        })
                      });
                      if (res.ok) {
                        const newPlan = await res.json();
                        setStudyPlans([newPlan, ...studyPlans]);
                        setAiPlanResult([]);
                        alert('Plan saved to your library!');
                      }
                    }}
                    className="mt-8 w-full py-3 border-2 border-emerald-500 text-emerald-600 font-bold rounded-xl hover:bg-emerald-50 transition-colors"
                  >
                    Save this Timeline to Library
                  </button>
                </motion.div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {studyPlans.map(plan => (
                  <div key={plan.id} className="bg-white p-6 rounded-2xl border border-stone-100 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-xl font-bold">{plan.title}</h3>
                        <p className="text-sm text-stone-400 capitalize">{plan.type} Plan • Starts {new Date(plan.start_date).toLocaleDateString()}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                        plan.type === 'weekly' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                      }`}>
                        {plan.type}
                      </span>
                    </div>
                    <div className="prose prose-stone max-w-none text-stone-600 mb-4 whitespace-pre-wrap">
                      {plan.content.startsWith('[') ? (
                        <div className="space-y-2">
                          {JSON.parse(plan.content).slice(0, 3).map((item: any, i: number) => (
                            <div key={i} className="text-sm border-l-2 border-emerald-200 pl-3">
                              <span className="font-bold text-emerald-600">{item.day}:</span> {item.activity}
                            </div>
                          ))}
                          <p className="text-xs text-stone-400 italic">...and more</p>
                        </div>
                      ) : (
                        plan.content
                      )}
                    </div>
                    <div className="text-xs text-stone-400 border-t pt-4">
                      Created on {new Date(plan.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'chat' && (
            <motion.div
              key="chat"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-full flex bg-white rounded-2xl border border-stone-200 overflow-hidden"
            >
               {/* Team Selector Sidebar */}
               <div className="w-64 border-r bg-stone-50 flex flex-col">
                 <div className="p-4 border-b font-bold text-stone-600 uppercase text-xs tracking-widest">My Teams</div>
                 <div className="flex-1 overflow-y-auto">
                   {teams.map(team => (
                     <button
                       key={team.id}
                       onClick={() => setSelectedTeamId(team.id)}
                       className={`w-full p-4 text-left border-b transition-colors flex items-center gap-3 ${
                         selectedTeamId === team.id ? 'bg-white border-l-4 border-l-emerald-500' : 'hover:bg-stone-100'
                       }`}
                     >
                       <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
                         <Users size={16} />
                       </div>
                       <span className={`font-medium ${selectedTeamId === team.id ? 'text-emerald-700' : 'text-stone-600'}`}>
                         {team.name}
                       </span>
                     </button>
                   ))}
                 </div>
               </div>

               {/* Chat Area */}
               <div className="flex-1 flex flex-col">
                 <div className="p-4 border-b bg-stone-50 font-semibold flex justify-between items-center">
                   <span>{teams.find(t => t.id === selectedTeamId)?.name || 'Select a Team'}</span>
                   <div className="text-xs text-stone-400">Collaboration Hub</div>
                 </div>
                 <div className="flex-1 p-6 overflow-y-auto space-y-4">
                    {selectedTeamId ? (
                      messages.map((m, i) => (
                        <div key={i} className={`flex ${m.senderId === user?.id ? 'justify-end' : 'justify-start'}`}>
                          <div className={`p-3 rounded-2xl max-w-[70%] ${
                            m.senderId === user?.id ? 'bg-emerald-600 text-white' : 'bg-stone-100'
                          }`}>
                            <p className="text-xs opacity-70 mb-1">{m.senderName || `User ${m.senderId}`}</p>
                            <p>{m.content}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-stone-400">
                        <MessageSquare size={48} className="mb-4 opacity-20" />
                        <p>Select a team to start chatting</p>
                      </div>
                    )}
                 </div>
                 <div className="p-4 border-t flex gap-2 items-center">
                    <button className="p-2 text-stone-400 hover:text-emerald-600 transition-colors">
                      <label className="cursor-pointer">
                        <Paperclip size={20} />
                        <input type="file" className="hidden" onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file && selectedTeamId) {
                            // Simulated file upload
                            socket?.send(JSON.stringify({
                              type: 'chat',
                              content: `Shared a file: ${file.name}`,
                              teamId: selectedTeamId
                            }));
                            alert(`Simulated upload of ${file.name}`);
                          }
                        }} />
                      </label>
                    </button>
                    <input 
                      id="chatInput"
                      placeholder="Type a message..." 
                      className="flex-1 p-3 border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          const input = e.currentTarget;
                          if (!input.value.trim() || !selectedTeamId) return;
                          socket?.send(JSON.stringify({
                            type: 'chat',
                            content: input.value,
                            teamId: selectedTeamId
                          }));
                          input.value = '';
                        }
                      }}
                    />
                    <button 
                      onClick={() => {
                        const input = document.getElementById('chatInput') as HTMLInputElement;
                        if (input.value.trim() && selectedTeamId) {
                          socket?.send(JSON.stringify({
                            type: 'chat',
                            content: input.value,
                            teamId: selectedTeamId
                          }));
                          input.value = '';
                        }
                      }}
                      className="bg-emerald-600 text-white p-3 rounded-xl hover:bg-emerald-700 transition-colors"
                    >
                      <Send size={20} />
                    </button>
                 </div>
               </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};
