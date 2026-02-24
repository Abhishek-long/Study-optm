import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, 
  Calendar, 
  Plus, 
  Trash2, 
  LogOut, 
  CheckCircle2, 
  Clock, 
  BarChart3, 
  BrainCircuit,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
interface User {
  id: number;
  username: string;
}

interface Subject {
  id: number;
  name: string;
  difficulty: number;
  exam_date: string;
  estimated_hours: number;
}

interface ScheduleItem {
  id: number;
  subject_id: number;
  subject_name: string;
  date: string;
  hours: number;
  type: 'study' | 'revision';
}

interface Progress {
  name: string;
  estimated_hours: number;
  completed_hours: number;
}

// --- Components ---

const Button = ({ className, variant = 'primary', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }) => {
  const variants = {
    primary: 'bg-zinc-900 text-white hover:bg-zinc-800',
    secondary: 'bg-white border border-zinc-200 text-zinc-900 hover:bg-zinc-50',
    danger: 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-100',
    ghost: 'hover:bg-zinc-100 text-zinc-600',
  };
  return (
    <button 
      className={cn('px-4 py-2 rounded-lg font-medium transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2', variants[variant], className)}
      {...props}
    />
  );
};

const Input = ({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input 
    className={cn('w-full px-4 py-2 bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all', className)}
    {...props}
  />
);

const Card = ({ children, className }: { children: React.ReactNode; className?: string; key?: React.Key }) => (
  <div className={cn('bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden', className)}>
    {children}
  </div>
);

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [view, setView] = useState<'auth' | 'dashboard'>('auth');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auth State
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authForm, setAuthForm] = useState({ username: '', password: '' });

  // Subject Form
  const [subjectForm, setSubjectForm] = useState({
    name: '',
    difficulty: 3,
    exam_date: '',
    estimated_hours: 10
  });

  useEffect(() => {
    if (token) {
      fetchData();
      setView('dashboard');
    }
  }, [token]);

  const fetchData = async () => {
    if (!token) return;
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const [subsRes, schedRes, progRes] = await Promise.all([
        fetch('/api/subjects', { headers }),
        fetch('/api/schedule', { headers }),
        fetch('/api/progress', { headers })
      ]);

      if (subsRes.ok) setSubjects(await subsRes.json());
      if (schedRes.ok) setSchedule(await schedRes.json());
      if (progRes.ok) setProgress(await progRes.json());
    } catch (err) {
      console.error("Failed to fetch data", err);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const endpoint = authMode === 'login' ? '/api/login' : '/api/register';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm)
      });
      const data = await res.json();
      if (res.ok) {
        if (authMode === 'login') {
          localStorage.setItem('token', data.token);
          setToken(data.token);
          setUser(data.user);
          setView('dashboard');
        } else {
          setAuthMode('login');
          setError("Registration successful! Please login.");
        }
      } else {
        setError(data.error || "Authentication failed");
      }
    } catch (err) {
      setError("Connection error");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setView('auth');
  };

  const addSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/subjects', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(subjectForm)
      });
      if (res.ok) {
        setSubjectForm({ name: '', difficulty: 3, exam_date: '', estimated_hours: 10 });
        fetchData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const deleteSubject = async (id: number) => {
    try {
      await fetch(`/api/subjects/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const generateNewSchedule = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/schedule/generate', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) fetchData();
      else {
        const data = await res.json();
        setError(data.error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const logSession = async (subjectId: number, hours: number) => {
    try {
      await fetch('/api/sessions', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          subject_id: subjectId,
          date: new Date().toISOString().split('T')[0],
          hours_completed: hours
        })
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  if (view === 'auth') {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-zinc-900 text-white rounded-2xl mb-4 shadow-lg">
              <BrainCircuit size={32} />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">StudyFlow AI</h1>
            <p className="text-zinc-500 mt-2">Optimize your learning with DSA-driven scheduling</p>
          </div>

          <Card className="p-8">
            <form onSubmit={handleAuth} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg flex items-center gap-2">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Username</label>
                <Input 
                  required
                  value={authForm.username}
                  onChange={e => setAuthForm({ ...authForm, username: e.target.value })}
                  placeholder="Enter your username"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Password</label>
                <Input 
                  required
                  type="password"
                  value={authForm.password}
                  onChange={e => setAuthForm({ ...authForm, password: e.target.value })}
                  placeholder="••••••••"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Processing..." : authMode === 'login' ? "Sign In" : "Create Account"}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button 
                onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
              >
                {authMode === 'login' ? "Don't have an account? Register" : "Already have an account? Sign In"}
              </button>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900">
      {/* Header */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BrainCircuit className="text-zinc-900" size={24} />
            <span className="font-bold text-lg tracking-tight">StudyFlow AI</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-500 hidden sm:inline">Welcome back, <span className="font-medium text-zinc-900">{user?.username}</span></span>
            <Button variant="ghost" onClick={handleLogout} className="p-2">
              <LogOut size={20} />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Subjects & Progress */}
          <div className="lg:col-span-4 space-y-8">
            {/* Subject Form */}
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 mb-4 flex items-center gap-2">
                <Plus size={16} /> Add New Subject
              </h2>
              <Card className="p-6">
                <form onSubmit={addSubject} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 uppercase mb-1">Subject Name</label>
                    <Input 
                      required
                      value={subjectForm.name}
                      onChange={e => setSubjectForm({ ...subjectForm, name: e.target.value })}
                      placeholder="e.g. Data Structures"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 uppercase mb-1">Difficulty (1-5)</label>
                      <Input 
                        type="number" min="1" max="5"
                        value={subjectForm.difficulty}
                        onChange={e => setSubjectForm({ ...subjectForm, difficulty: parseInt(e.target.value) })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 uppercase mb-1">Est. Hours</label>
                      <Input 
                        type="number" min="1"
                        value={subjectForm.estimated_hours}
                        onChange={e => setSubjectForm({ ...subjectForm, estimated_hours: parseInt(e.target.value) })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 uppercase mb-1">Exam Date</label>
                    <Input 
                      type="date"
                      required
                      value={subjectForm.exam_date}
                      onChange={e => setSubjectForm({ ...subjectForm, exam_date: e.target.value })}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    Add Subject
                  </Button>
                </form>
              </Card>
            </section>

            {/* Subjects List */}
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 mb-4 flex items-center gap-2">
                <BookOpen size={16} /> My Subjects
              </h2>
              <div className="space-y-3">
                {subjects.map(sub => (
                  <Card key={sub.id} className="p-4 flex items-center justify-between group">
                    <div>
                      <h3 className="font-semibold text-zinc-900">{sub.name}</h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs px-2 py-0.5 bg-zinc-100 rounded-full text-zinc-600">Diff: {sub.difficulty}</span>
                        <span className="text-xs text-zinc-400 flex items-center gap-1">
                          <Calendar size={12} /> {sub.exam_date}
                        </span>
                      </div>
                    </div>
                    <button 
                      onClick={() => deleteSubject(sub.id)}
                      className="text-zinc-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={18} />
                    </button>
                  </Card>
                ))}
                {subjects.length === 0 && (
                  <div className="text-center py-8 text-zinc-400 border-2 border-dashed border-zinc-200 rounded-xl">
                    No subjects added yet
                  </div>
                )}
              </div>
            </section>

            {/* Progress */}
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 mb-4 flex items-center gap-2">
                <BarChart3 size={16} /> Study Progress
              </h2>
              <div className="space-y-4">
                {progress.map(p => {
                  const percent = Math.min(100, Math.round((p.completed_hours / p.estimated_hours) * 100));
                  return (
                    <div key={p.name}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">{p.name}</span>
                        <span className="text-zinc-500">{percent}%</span>
                      </div>
                      <div className="h-2 bg-zinc-200 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${percent}%` }}
                          className="h-full bg-zinc-900"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          {/* Right Column: Schedule */}
          <div className="lg:col-span-8 space-y-8">
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 flex items-center gap-2">
                  <Calendar size={16} /> Smart Study Schedule
                </h2>
                <Button variant="secondary" onClick={generateNewSchedule} disabled={loading || subjects.length === 0}>
                  <BrainCircuit size={16} /> {schedule.length > 0 ? "Re-optimize" : "Generate Schedule"}
                </Button>
              </div>

              {schedule.length > 0 ? (
                <div className="space-y-6">
                  {/* Group schedule by date */}
                  {Array.from(new Set(schedule.map(s => s.date))).slice(0, 7).map((date: string) => (
                    <div key={date} className="relative">
                      <div className="flex items-center gap-4 mb-3">
                        <div className="h-px flex-1 bg-zinc-200"></div>
                        <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest bg-zinc-50 px-2">
                          {new Date(date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                        </span>
                        <div className="h-px flex-1 bg-zinc-200"></div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {schedule.filter(s => s.date === date).map((item, idx) => (
                          <motion.div
                            key={`${item.date}-${item.subject_id}-${idx}`}
                            whileHover={{ y: -2 }}
                          >
                            <Card className={cn(
                              "p-4 border-l-4",
                              item.type === 'revision' ? "border-l-emerald-500" : "border-l-zinc-900"
                            )}>
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className={cn(
                                      "text-[10px] font-bold uppercase tracking-tighter px-1.5 py-0.5 rounded",
                                      item.type === 'revision' ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-700"
                                    )}>
                                      {item.type}
                                    </span>
                                    <h4 className="font-bold text-zinc-900">{item.subject_name}</h4>
                                  </div>
                                  <div className="flex items-center gap-2 mt-2 text-zinc-500 text-sm">
                                    <Clock size={14} />
                                    <span>{item.hours} hours</span>
                                  </div>
                                </div>
                                <button 
                                  onClick={() => logSession(item.subject_id, item.hours)}
                                  className="p-2 text-zinc-300 hover:text-emerald-500 transition-colors"
                                  title="Mark as completed"
                                >
                                  <CheckCircle2 size={24} />
                                </button>
                              </div>
                            </Card>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 bg-white border border-zinc-200 border-dashed rounded-2xl text-zinc-400">
                  <BrainCircuit size={48} className="mb-4 opacity-20" />
                  <p>No schedule generated yet.</p>
                  <p className="text-sm">Add subjects and click "Generate Schedule" to start.</p>
                </div>
              )}
            </section>
          </div>

        </div>
      </main>
    </div>
  );
}
