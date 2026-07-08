import { FormEvent, ReactNode, useMemo, useState } from 'react';
import { StudentView } from './components/StudentView';
import { TeacherView } from './components/TeacherView';
import { LanguageSelector } from './components/LanguageSelector';
import { ThemeToggle } from './components/ThemeToggle';
import { useQuestions } from './hooks/useQuestions';
import { useI18n } from './i18n/I18nContext';
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
  const { t } = useI18n();
  const [studentName, setStudentName] = useState(() => window.localStorage.getItem(STUDENT_NAME_KEY) ?? '');
  const [studentNameDraft, setStudentNameDraft] = useState('');
  const [teacherSession, setTeacherSession] = useState<TeacherSession | null>(() => readTeacherSession());
  const [teacherNameDraft, setTeacherNameDraft] = useState('');
  const [teacherPassword, setTeacherPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const { questions, loading, error, notifications, submitQuestion, submitAnswer, editAnswer } = useQuestions();

  const pageTitle = role === 'teacher' ? t('role.teacher') : role === 'student' ? t('role.student') : t('role.home');
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
        setLoginError(t('teacherLogin.errorInvalid'));
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
      setLoginError(t('teacherLogin.errorNetwork'));
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
    <div className="flex flex-col min-h-screen bg-gray-50/50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans transition-colors">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 gap-4">
            <div className="flex items-center space-x-2">
              <GraduationCap className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              <span className="text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">{t('header.title')}</span>
              <span className="hidden sm:inline-flex rounded-full bg-gray-100 dark:bg-gray-700 px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-300">
                {pageTitle}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <LanguageSelector />
              <ThemeToggle />
              {role === 'teacher' && teacherSession && (
                <button
                  type="button"
                  onClick={handleTeacherLogout}
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100"
                >
                  <LogOut className="h-4 w-4" />
                  {t('header.signOut')}
                </button>
              )}
              {role === 'teacher' && (
                <a
                  href="/student"
                  className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100"
                >
                  {t('header.studentPage')}
                </a>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg mb-6 max-w-4xl mx-auto flex items-center">
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
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
                  icon={<GraduationCap className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />}
                  title={t('selector.title')}
                  description={t('selector.description')}
                >
                  <div className="grid gap-3">
                    <a
                      href="/student"
                      className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 font-medium text-white transition-colors hover:bg-indigo-700"
                    >
                      <UserRound className="h-4 w-4" />
                      {t('selector.continueStudent')}
                    </a>
                    <a
                      href="/teacher"
                      className="flex items-center justify-center gap-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-3 font-medium text-gray-700 dark:text-gray-300 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100"
                    >
                      <LockKeyhole className="h-4 w-4" />
                      {t('selector.continueTeacher')}
                    </a>
                  </div>
                </AccessPanel>
              )}

              {role === 'student' && !isStudentIdentified && (
                <AccessPanel
                  icon={<UserRound className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />}
                  title={t('studentLogin.title')}
                  description={t('studentLogin.description')}
                >
                  <form onSubmit={handleStudentIdentification} className="space-y-4">
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('studentLogin.nameLabel')}</span>
                      <input
                        autoFocus
                        required
                        maxLength={80}
                        value={studentNameDraft}
                        onChange={(e) => setStudentNameDraft(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-4 py-3 text-gray-900 dark:text-gray-100 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                        placeholder={t('studentLogin.namePlaceholder')}
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={!studentNameDraft.trim()}
                      className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {t('studentLogin.submit')}
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
                  icon={<LockKeyhole className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />}
                  title={t('teacherLogin.title')}
                  description={t('teacherLogin.description')}
                >
                  <form onSubmit={handleTeacherLogin} className="space-y-4">
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('teacherLogin.passwordLabel')}</span>
                      <input
                        autoFocus
                        required
                        type="password"
                        value={teacherPassword}
                        onChange={(e) => setTeacherPassword(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-4 py-3 text-gray-900 dark:text-gray-100 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                        placeholder={t('teacherLogin.passwordPlaceholder')}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('teacherLogin.nameLabel')}</span>
                      <input
                        maxLength={80}
                        value={teacherNameDraft}
                        onChange={(e) => setTeacherNameDraft(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-4 py-3 text-gray-900 dark:text-gray-100 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                        placeholder={t('teacherLogin.namePlaceholder')}
                      />
                    </label>
                    {loginError && (
                      <p className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 px-3 py-2 text-sm font-medium text-red-700 dark:text-red-300">
                        {loginError}
                      </p>
                    )}
                    <button
                      type="submit"
                      disabled={isLoggingIn || !teacherPassword.trim()}
                      className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isLoggingIn ? t('teacherLogin.validating') : t('teacherLogin.submit')}
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
              className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-5 py-3 rounded-xl shadow-lg border border-gray-800 dark:border-gray-300 flex items-center space-x-3 pointer-events-auto"
            >
              <Bell className="w-4 h-4 text-indigo-400 dark:text-indigo-600" />
              <span className="text-sm font-medium">{notif.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <footer className="flex h-[34px] shrink-0 items-center justify-between bg-black dark:bg-gray-950 px-3 text-xs font-semibold text-white">
        <span>{t('footer.text')} <a href="https://github.com/Victor-477" target="_blank" rel="noopener noreferrer" className="underline hover:text-indigo-300 transition-colors">Victor Samuel</a></span>
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
    <div className="mx-auto max-w-md rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm">
      <div className="mb-6 flex items-start gap-3">
        <div className="rounded-xl bg-indigo-50 dark:bg-indigo-900/30 p-3">{icon}</div>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{title}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}
