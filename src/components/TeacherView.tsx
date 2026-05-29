import React, { useState, useMemo } from 'react';
import { Question } from '../types';
import { CheckCircle, Reply, UserRound } from 'lucide-react';
import { formatDate } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface TeacherViewProps {
  questions: Question[];
  teacherName?: string;
  onSubmitAnswer: (id: string, answer: string) => Promise<void>;
}

export function TeacherView({ questions, teacherName, onSubmitAnswer }: TeacherViewProps) {
  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filter, setFilter] = useState<'pending' | 'answered' | 'all'>('pending');

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
      alert('Could not submit the answer. Check whether teacher access is still valid.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const pendingCount = questions.filter(q => !q.answer).length;

  return (
    <div className="max-w-4xl mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 space-y-4 md:space-y-0">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-semibold text-gray-900">Teacher Dashboard</h2>
            {teacherName && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
                <UserRound className="h-3.5 w-3.5" />
                {teacherName}
              </span>
            )}
          </div>
          <p className="text-gray-500 text-sm mt-1">You have {pendingCount} pending questions to answer.</p>
        </div>

        <div className="flex bg-gray-100 p-1 rounded-lg">
          {(['pending', 'answered', 'all'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                filter === f
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {f === 'pending' ? 'Pending' : f === 'answered' ? 'Answered' : 'All'}
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
              className="text-center py-16 bg-white border border-gray-100 rounded-2xl shadow-sm"
            >
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
              <p className="text-lg font-medium text-gray-900">All caught up!</p>
              <p className="text-gray-500">There are no questions matching this filter.</p>
            </motion.div>
          ) : (
            filteredQuestions.map((question) => (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                key={question.id}
                className={`bg-white rounded-2xl shadow-sm border p-6 ${
                  !question.answer ? 'border-primary/20 border-l-4 border-l-indigo-500' : 'border-gray-100'
                }`}
              >
                <div className="flex justify-between gap-4 items-start mb-4">
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                      Topic {question.topicNumber}
                    </span>
                    <span className="text-xs font-medium text-gray-500">Student: {question.studentName}</span>
                    <span className="text-xs text-gray-400">{formatDate(question.createdAt)}</span>
                  </div>
                  {!question.answer && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                      Pending
                    </span>
                  )}
                </div>

                <p className="text-gray-900 text-base mb-6 leading-relaxed bg-gray-50 p-4 rounded-lg border border-gray-100 whitespace-pre-wrap">
                  {question.text}
                </p>

                {question.answer ? (
                  <div className="pl-4 border-l-2 border-indigo-200 mt-4">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Answer</h4>
                    <p className="text-gray-800 text-sm whitespace-pre-wrap">{question.answer}</p>
                    {question.answeredBy && (
                      <p className="mt-3 text-xs font-medium text-gray-500">Answered by {question.answeredBy}</p>
                    )}
                  </div>
                ) : answeringId === question.id ? (
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
                      placeholder="Write the answer..."
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none text-sm"
                    />
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => {
                          setAnsweringId(null);
                          setAnswerText('');
                        }}
                        className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleAnswerSubmit(question.id)}
                        disabled={isSubmitting || !answerText.trim()}
                        className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <span>Submit Answer</span>
                        <Reply className="w-4 h-4 ml-1" />
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <button
                    onClick={() => setAnsweringId(question.id)}
                    className="mt-2 inline-flex items-center space-x-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
                  >
                    <Reply className="w-4 h-4" />
                    <span>Answer Question</span>
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
