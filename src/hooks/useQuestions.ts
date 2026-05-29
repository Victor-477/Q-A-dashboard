import { useEffect, useState, useCallback } from 'react';
import { Question } from '../types';

export function useQuestions() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<{ id: string; message: string }[]>([]);

  const addNotification = useCallback((message: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setNotifications(prev => [...prev, { id, message }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  }, []);

  useEffect(() => {
    const eventSource = new EventSource('/api/events');

    eventSource.addEventListener('init', (e) => {
      const data = JSON.parse(e.data);
      setQuestions(data);
      setLoading(false);
      setError(null);
    });

    eventSource.addEventListener('new_question', (e) => {
      const data = JSON.parse(e.data);
      setQuestions(prev => {
        if (prev.some(q => q.id === data.id)) return prev;
        return [...prev, data];
      });
      addNotification(`New question posted - Topic ${data.topicNumber}`);
    });

    eventSource.addEventListener('question_answered', (e) => {
      const data = JSON.parse(e.data);
      setQuestions(prev => prev.map(q => q.id === data.id ? data : q));
      addNotification(`The question for topic ${data.topicNumber} has been answered!`);
    });

    eventSource.onerror = () => {
      setError('Real-time connection issue. Trying to reconnect...');
    };

    return () => {
      eventSource.close();
    };
  }, [addNotification]);

  const submitQuestion = async (topicNumber: number, text: string, studentName: string) => {
    const res = await fetch('/api/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topicNumber, text, studentName })
    });
    if (!res.ok) {
      throw new Error('Could not submit question');
    }
  };

  const submitAnswer = async (id: string, answer: string, teacherToken: string) => {
    const res = await fetch(`/api/questions/${id}/answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${teacherToken}`
      },
      body: JSON.stringify({ answer })
    });
    if (!res.ok) {
      throw new Error(res.status === 401 ? 'Teacher access has expired' : 'Could not submit answer');
    }
  };

  return { questions, loading, error, notifications, submitQuestion, submitAnswer };
}
