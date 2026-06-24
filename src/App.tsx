import { FormEvent, ReactNode, useMemo, useState } from 'react';
import { StudentView } from './components/StudentView';
import { TeacherView } from './components/TeacherView';
import { useQuestions } from './hooks/useQuestions';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, GraduationCap, LockKeyhole, LogOut, UserRound } from 'lucide-react';

type AppRole = 'student' | 'teacher' | 'selector';

interface TeacherSession {
  token: string;
  name: string;
}

const STUDENT_NAME_KEY = 'qa-board.studentName';
const TEACHER_SESSION_KEY = 'qa-board.teacherSession';

function getInitialRole(): AppRole {
  const path = window.location.pathname.toLowerCase();

  if (path.startsWith('/teacher') || path.startsWith('/professor')) {
    return 'teacher';
  }

  if (path.startsWith('/student') || path.startsWith('/aluno')) {
    return 'student';
  }

  return 'selector';
}

function readTeacherSession(): TeacherSession | null {
  try {
    const raw = window.localStorage.getItem(TEACHER_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function App() {
  const role = getInitialRole();
  const [studentName, setStudentName] = useState(() => window.localStorage.getItem(STUDENT_NAME_KEY) ?? '');
  const [studentNameDraft, setStudentNameDraft] = useState('');
  const [teacherSession, setTeacherSession] = useState<TeacherSession | null>(() => readTeacherSession());
  const [teacherNameDraft, setTeacherNameDraft] = useState('');
  const [teacherPassword, setTeacherPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const { questions, loading, error, notifications, submitQuestion, submitAnswer, editAnswer } = useQuestions();

  const pageTitle = role === 'teacher' ? 'Teacher' : role === 'student' ? 'Student' : 'Home';
  const isTeacherAuthenticated = role === 'teacher' && Boolean(teacherSession?.token);
  const isStudentIdentified = role === 'student' && Boolean(studentName.trim());

  const contentKey = useMemo(() => {
    if (role === 'selector') return 'selector';
    if (role === 'teacher') return isTeacherAuthenticated ? 'teacher' : 'teacher-login';
    return isStudentIdentified ? 'student' : 'student-login';
  }, [isStudentIdentified, isTeacherAuthenticated, role]);

  const handleStudentIdentification = (e: FormEvent) => {
    e.preventDefault();
    const nextName = studentNameDraft.trim();
    if (!nextName) return;

    window.localStorage.setItem(STUDENT_NAME_KEY, nextName);
    setStudentName(nextName);
    setStudentNameDraft('');
  };

  const handleTeacherLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);

    try {
      const res = await fetch('/api/teacher/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: teacherPassword,
          name: teacherNameDraft.trim()
        })
      });

      if (!res.ok) {
        setLoginError('Invalid password. Check the password configured for this project.');
        return;
      }

      const session = await res.json();
      const nextSession: TeacherSession = {
        token: session.token,
        name: session.name ?? ''
      };

      window.localStorage.setItem(TEACHER_SESSION_KEY, JSON.stringify(nextSession));
      setTeacherSession(nextSession);
      setTeacherPassword('');
      setTeacherNameDraft('');
    } catch {
      setLoginError('Could not validate access right now.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleTeacherLogout = async () => {
    const token = teacherSession?.token;
    window.localStorage.removeItem(TEACHER_SESSION_KEY);
    setTeacherSession(null);

    if (token) {
      await fetch('/api/teacher/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => undefined);
    }
  };

  const handleSubmitAnswer = async (id: string, answer: string) => {
    if (!teacherSession?.token) {
      throw new Error('Teacher is not authenticated');
    }

    try {
      await submitAnswer(id, answer, teacherSession.token);
    } catch (err) {
      if (err instanceof Error && err.message === 'Teacher access has expired') {
        window.localStorage.removeItem(TEACHER_SESSION_KEY);
        setTeacherSession(null);
      }
      throw err;
    }
  };

  const handleEditAnswer = async (id: string, answer: string) => {
    if (!teacherSession?.token) {
      throw new Error('Teacher is not authenticated');
    }

    try {
      await editAnswer(id, answer, teacherSession.token);
    } catch (err) {
      if (err instanceof Error && err.message === 'Teacher access has expired') {
        window.localStorage.removeItem(TEACHER_SESSION_KEY);
        setTeacherSession(null);
      }
      throw err;
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50/50 text-gray-900 font-sans">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 gap-4">
            <div className="flex items-center space-x-2">
              <GraduationCap className="h-6 w-6 text-indigo-600" />
              <span className="text-xl font-semibold tracking-tight text-gray-900">Q&A Dashboard</span>
              <span className="hidden sm:inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                {pageTitle}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {role === 'teacher' && teacherSession && (
                <button
                  type="button"
                  onClick={handleTeacherLogout}
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              )}
              {role === 'teacher' && (
                <a
                  href="/student"
                  className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
                >
                  Student page
                </a>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 max-w-4xl mx-auto flex items-center">
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={contentKey}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {role === 'selector' && (
                <AccessPanel
                  icon={<GraduationCap className="h-6 w-6 text-indigo-600" />}
                  title="Choose an interface"
                  description="Join as a student to submit questions or as a teacher to answer them."
                >
                  <div className="grid gap-3">
                    <a
                      href="/student"
                      className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 font-medium text-white transition-colors hover:bg-indigo-700"
                    >
                      <UserRound className="h-4 w-4" />
                      Continue as student
                    </a>
                    <a
                      href="/teacher"
                      className="flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-900"
                    >
                      <LockKeyhole className="h-4 w-4" />
                      Continue as teacher
                    </a>
                  </div>
                </AccessPanel>
              )}

              {role === 'student' && !isStudentIdentified && (
                <AccessPanel
                  icon={<UserRound className="h-6 w-6 text-indigo-600" />}
                  title="Student identification"
                  description="Enter your name to join the question board."
                >
                  <form onSubmit={handleStudentIdentification} className="space-y-4">
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-gray-700">Name</span>
                      <input
                        autoFocus
                        required
                        maxLength={80}
                        value={studentNameDraft}
                        onChange={(e) => setStudentNameDraft(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                        placeholder="Enter your name"
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={!studentNameDraft.trim()}
                      className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Continue as student
                    </button>
                  </form>
                </AccessPanel>
              )}

              {role === 'student' && isStudentIdentified && (
                <StudentView
                  questions={questions}
                  studentName={studentName}
                  onSubmitQuestion={submitQuestion}
                  onChangeStudentName={() => {
                    window.localStorage.removeItem(STUDENT_NAME_KEY);
                    setStudentName('');
                    setStudentNameDraft(studentName);
                  }}
                />
              )}

              {role === 'teacher' && !isTeacherAuthenticated && (
                <AccessPanel
                  icon={<LockKeyhole className="h-6 w-6 text-indigo-600" />}
                  title="Teacher access"
                  description="Enter the password configured for this project. Name is optional."
                >
                  <form onSubmit={handleTeacherLogin} className="space-y-4">
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-gray-700">Password</span>
                      <input
                        autoFocus
                        required
                        type="password"
                        value={teacherPassword}
                        onChange={(e) => setTeacherPassword(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                        placeholder="Teacher password"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-gray-700">Teacher name</span>
                      <input
                        maxLength={80}
                        value={teacherNameDraft}
                        onChange={(e) => setTeacherNameDraft(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                        placeholder="Optional"
                      />
                    </label>
                    {loginError && (
                      <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                        {loginError}
                      </p>
                    )}
                    <button
                      type="submit"
                      disabled={isLoggingIn || !teacherPassword.trim()}
                      className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isLoggingIn ? 'Validating...' : 'Open dashboard'}
                    </button>
                  </form>
                </AccessPanel>
              )}

              {role === 'teacher' && isTeacherAuthenticated && (
                <TeacherView
                  questions={questions}
                  teacherName={teacherSession?.name}
                  onSubmitAnswer={handleSubmitAnswer}
                  onEditAnswer={handleEditAnswer}
                />
              )}
            </motion.div>
          </AnimatePresence>
        )}

      </main>

      <div className="fixed bottom-4 right-4 z-50 flex flex-col space-y-2 pointer-events-none">
        <AnimatePresence>
          {notifications.map((notif) => (
            <motion.div
              key={notif.id}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, x: 20 }}
              className="bg-gray-900 text-white px-5 py-3 rounded-xl shadow-lg border border-gray-800 flex items-center space-x-3 pointer-events-auto"
            >
              <Bell className="w-4 h-4 text-indigo-400" />
              <span className="text-sm font-medium">{notif.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <footer className="flex h-[34px] shrink-0 items-center justify-between bg-black px-3 text-xs font-semibold text-white">
        <span>Control Panel - Q&A Dashboard v1.0.0 - Made By Victor Samuel</span>
      </footer>
    </div>
  );
}

function AccessPanel({
  icon,
  title,
  description,
  children
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-start gap-3">
        <div className="rounded-xl bg-indigo-50 p-3">{icon}</div>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}
