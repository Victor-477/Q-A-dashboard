import React, { useState } from 'react';
import { Question } from '../types';
import { Send, BookOpen, UserRound, Pencil } from 'lucide-react';
import { formatDate } from '../lib/utils';
import { motion } from 'motion/react';

interface StudentViewProps {
  questions: Question[];
  studentName: string;
  onSubmitQuestion: (topicNumber: number, text: string, studentName: string) => Promise<void>;
  onChangeStudentName: () => void;
}

export function StudentView({ questions, studentName, onSubmitQuestion, onChangeStudentName }: StudentViewProps) {
  const [topicNumber, setTopicNumber] = useState<number | ''>('');
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof topicNumber !== 'number' || !text.trim() || text.length > 500) return;

    setIsSubmitting(true);
    try {
      await onSubmitQuestion(topicNumber, text.trim(), studentName);
      setTopicNumber('');
      setText('');
    } catch (err) {
      console.error(err);
      alert('Could not submit the question.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-7xl mx-auto items-start">
      <div className="md:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 sticky top-8">
        <div className="flex items-center justify-between gap-3 mb-6 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <UserRound className="h-5 w-5 flex-none text-indigo-600" />
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-indigo-700">Student</p>
              <p className="truncate text-sm font-semibold text-indigo-950">{studentName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onChangeStudentName}
            title="Change identification"
            className="rounded-lg p-2 text-indigo-700 transition-colors hover:bg-indigo-100"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center space-x-3 mb-6">
          <BookOpen className="w-5 h-5 text-indigo-600" />
          <h2 className="text-xl font-medium text-gray-900">New Question</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="topic" className="block text-sm font-medium text-gray-700 mb-1">
              Topic Number
            </label>
            <input
              id="topic"
              type="number"
              step="any"
              min="0"
              required
              value={topicNumber}
              onChange={(e) => setTopicNumber(e.target.value ? Number(e.target.value) : '')}
              placeholder="Example: 1.5"
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none text-gray-900"
            />
          </div>

          <div>
            <label htmlFor="questionText" className="block text-sm font-medium flex justify-between text-gray-700 mb-1">
              <span>Your question</span>
              <span className={text.length > 500 ? 'text-red-500' : 'text-gray-400'}>
                {text.length}/500
              </span>
            </label>
            <textarea
              id="questionText"
              required
              maxLength={500}
              rows={5}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Describe what you did not understand about this topic..."
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none resize-none text-gray-900"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || typeof topicNumber !== 'number' || text.length === 0 || text.length > 500}
            className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
          >
            <span>{isSubmitting ? 'Submitting...' : 'Submit Question'}</span>
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      <div className="md:col-span-2 space-y-6">
        <h2 className="text-xl font-medium text-gray-900 mb-4">Question Board</h2>

        {questions.length === 0 ? (
          <div className="text-center py-16 bg-gray-50 border border-dashed border-gray-200 rounded-2xl">
            <p className="text-gray-500">No questions have been submitted yet. Be the first to ask!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {questions.slice().reverse().map((question) => (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={question.id}
                className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100"
              >
                <div className="flex justify-between gap-4 items-start mb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                      Topic {question.topicNumber}
                    </div>
                    <span className="text-xs font-medium text-gray-500">by {question.studentName}</span>
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap">{formatDate(question.createdAt)}</span>
                </div>

                <p className="text-gray-900 text-base mb-4 whitespace-pre-wrap">{question.text}</p>

                {question.answer ? (
                  <div className="bg-indigo-50/50 rounded-xl p-4 border border-indigo-100/50 mt-4">
                    <h4 className="text-xs font-semibold text-indigo-900 uppercase tracking-wider mb-2">Teacher Answer</h4>
                    <p className="text-indigo-950 whitespace-pre-wrap text-sm">{question.answer}</p>
                    {question.answeredBy && (
                      <p className="mt-3 text-xs font-medium text-indigo-700">Answered by {question.answeredBy}</p>
                    )}
                  </div>
                ) : (
                  <div className="inline-flex mt-2 items-center text-xs font-medium text-amber-600 bg-amber-50 px-2.5 py-1 rounded-md">
                    Waiting for an answer...
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
