import React, { useState, useMemo } from 'react';
import { Question } from '../types';
import { CheckCircle, Pencil, Reply, UserRound, History } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import { motion, AnimatePresence } from 'motion/react';

interface TeacherViewProps {
  questions: Question[];
  teacherName?: string;
  onSubmitAnswer: (id: string, answer: string) => Promise<void>;
  onEditAnswer: (id: string, answer: string) => Promise<void>;
}

export function TeacherView({ questions, teacherName, onSubmitAnswer, onEditAnswer }: TeacherViewProps) {
  const { t, formatDate } = useI18n();
  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filter, setFilter] = useState<'pending' | 'answered' | 'all'>('pending');
  const [showPrevious, setShowPrevious] = useState<Record<string, boolean>>({});

  const filteredQuestions = useMemo(() => {
    let result = questions.slice().reverse();
    if (filter === 'pending') {
      result = result.filter(q => !q.answer);
    } else if (filter === 'answered') {
      result = result.filter(q => q.answer);
    }
    return result;
  }, [questions, filter]);

  const handleAnswerSubmit = async (id: string) => {
    if (!answerText.trim()) return;
    setIsSubmitting(true);
    try {
      await onSubmitAnswer(id, answerText.trim());
      setAnsweringId(null);
      setAnswerText('');
    } catch (err) {
      console.error(err);
      alert(t('teacher.submitError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (id: string) => {
    if (!answerText.trim()) return;
    setIsSubmitting(true);
    try {
      await onEditAnswer(id, answerText.trim());
      setEditingId(null);
      setAnswerText('');
    } catch (err) {
      console.error(err);
      alert(t('teacher.editError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEditing = (question: Question) => {
    setEditingId(question.id);
    setAnsweringId(null);
    setAnswerText(question.answer ?? '');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setAnswerText('');
  };

  const pendingCount = questions.filter(q => !q.answer).length;

  return (
    <div className="max-w-4xl mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 space-y-4 md:space-y-0">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{t('teacher.dashboard')}</h2>
            {teacherName && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1 text-xs font-medium text-indigo-700 dark:text-indigo-300">
                <UserRound className="h-3.5 w-3.5" />
                {teacherName}
              </span>
            )}
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{t('teacher.pendingCount', { count: pendingCount })}</p>
        </div>

        <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
          {(['pending', 'answered', 'all'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                filter === f
                  ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {f === 'pending' ? t('teacher.filterPending') : f === 'answered' ? t('teacher.filterAnswered') : t('teacher.filterAll')}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        <AnimatePresence mode="popLayout">
          {filteredQuestions.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-16 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm"
            >
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
              <p className="text-lg font-medium text-gray-900 dark:text-gray-100">{t('teacher.allCaughtUp')}</p>
              <p className="text-gray-500 dark:text-gray-400">{t('teacher.noMatching')}</p>
            </motion.div>
          ) : (
            filteredQuestions.map((question) => (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                key={question.id}
                className={`bg-white dark:bg-gray-800 rounded-2xl shadow-sm border p-6 ${
                  !question.answer ? 'border-primary/20 border-l-4 border-l-indigo-500' : 'border-gray-100 dark:border-gray-700'
                }`}
              >
                <div className="flex justify-between gap-4 items-start mb-4">
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-300">
                      {t('teacher.topic')} {question.topicNumber}
                    </span>
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('teacher.studentLabel')} {question.studentName}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">{formatDate(question.createdAt)}</span>
                  </div>
                  {!question.answer && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300">
                      {t('teacher.pending')}
                    </span>
                  )}
                </div>

                <p className="text-gray-900 dark:text-gray-100 text-base mb-6 leading-relaxed bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-gray-100 dark:border-gray-700 whitespace-pre-wrap">
                  {question.text}
                </p>

                {/* --- ANSWERED: show answer + Edit button --- */}
                {question.answer && editingId !== question.id ? (
                  <div className="pl-4 border-l-2 border-indigo-200 dark:border-indigo-700 mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('teacher.answerLabel')}</h4>
                      <button
                        onClick={() => startEditing(question)}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors rounded-md px-2 py-1 hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        {t('teacher.editButton')}
                      </button>
                    </div>
                    <p className="text-gray-800 dark:text-gray-200 text-sm whitespace-pre-wrap">{question.answer}</p>
                    {question.answeredBy && (
                      <p className="mt-3 text-xs font-medium text-gray-500 dark:text-gray-400">{t('teacher.answeredBy')} {question.answeredBy}</p>
                    )}
                    {question.previousAnswer && (
                      <div className="mt-3 pt-3 border-t border-indigo-100/30 dark:border-indigo-800/30 flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => setShowPrevious(prev => ({ ...prev, [question.id]: !prev[question.id] }))}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors w-fit px-2 py-1 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
                        >
                          <History className="h-3.5 w-3.5" />
                          {showPrevious[question.id] ? t('teacher.hidePrevious') : t('teacher.showPrevious')}
                        </button>
                        {showPrevious[question.id] && (
                          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 border border-gray-100 dark:border-gray-700 mt-1">
                            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">{t('teacher.previousVersion')}</p>
                            <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap text-sm">{question.previousAnswer}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : editingId === question.id ? (
                  /* --- EDITING MODE --- */
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-4 space-y-3"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Pencil className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">{t('teacher.editingAnswer')}</span>
                    </div>
                    <textarea
                      autoFocus
                      rows={4}
                      maxLength={1000}
                      value={answerText}
                      onChange={(e) => setAnswerText(e.target.value)}
                      placeholder={t('teacher.editPlaceholder')}
                      className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-amber-300 dark:border-amber-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none resize-none text-sm text-gray-900 dark:text-gray-100 dark:placeholder-gray-500"
                    />
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={cancelEditing}
                        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        {t('teacher.cancel')}
                      </button>
                      <button
                        onClick={() => handleEditSubmit(question.id)}
                        disabled={isSubmitting || !answerText.trim()}
                        className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <span>{t('teacher.saveChanges')}</span>
                        <Pencil className="w-4 h-4 ml-1" />
                      </button>
                    </div>
                  </motion.div>
                ) : answeringId === question.id ? (
                  /* --- ANSWERING MODE (new answer) --- */
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-4 space-y-3"
                  >
                    <textarea
                      autoFocus
                      rows={4}
                      maxLength={1000}
                      value={answerText}
                      onChange={(e) => setAnswerText(e.target.value)}
                      placeholder={t('teacher.answerPlaceholder')}
                      className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none text-sm text-gray-900 dark:text-gray-100 dark:placeholder-gray-500"
                    />
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => {
                          setAnsweringId(null);
                          setAnswerText('');
                        }}
                        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        {t('teacher.cancel')}
                      </button>
                      <button
                        onClick={() => handleAnswerSubmit(question.id)}
                        disabled={isSubmitting || !answerText.trim()}
                        className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <span>{t('teacher.submitAnswer')}</span>
                        <Reply className="w-4 h-4 ml-1" />
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  /* --- NOT ANSWERED: show Answer Question button --- */
                  <button
                    onClick={() => {
                      setAnsweringId(question.id);
                      setEditingId(null);
                      setAnswerText('');
                    }}
                    className="mt-2 inline-flex items-center space-x-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                  >
                    <Reply className="w-4 h-4" />
                    <span>{t('teacher.answerQuestion')}</span>
                  </button>
                )}
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
