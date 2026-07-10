import { useEffect, useState, useCallback } from 'react';
import { Question } from '../types';
import { useI18n } from '../i18n/I18nContext';

// Cache for translations to prevent duplicate network calls
const translationCache = new Map<string, string>();

async function translateText(text: string, targetLocale: string): Promise<string> {
  if (!text || !text.trim()) return text;
  
  const target = targetLocale || 'en';
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${target}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Translation failed');
    const json = await res.json();
    const translated = json[0].map((item: any) => item[0]).join('');
    return translated;
  } catch (err) {
    console.error('Translation error:', err);
    return text;
  }
}

export function useQuestions() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [translatedQuestions, setTranslatedQuestions] = useState<Question[]>([]);
  const [autoTranslateEnabled, setAutoTranslateEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<{ id: string; message: string }[]>([]);
  const { t, locale } = useI18n();

  const addNotification = useCallback((message: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setNotifications(prev => [...prev, { id, message }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  }, []);

  // Fetch translation configuration from server on load
  useEffect(() => {
    fetch('/api/config')
      .then(res => {
        if (res.ok) return res.json();
        throw new Error('Not OK');
      })
      .then(data => {
        setAutoTranslateEnabled(data.enableAutoTranslate !== false);
      })
      .catch(err => {
        console.warn('Failed to load server translation config:', err);
      });
  }, []);

  // SSE event source subscription
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
      addNotification(t('notify.newQuestion', { topic: data.topicNumber }));
    });

    eventSource.addEventListener('question_answered', (e) => {
      const data = JSON.parse(e.data);
      setQuestions(prev => prev.map(q => q.id === data.id ? data : q));
      addNotification(t('notify.questionAnswered', { topic: data.topicNumber }));
    });

    eventSource.addEventListener('question_answer_edited', (e) => {
      const data = JSON.parse(e.data);
      setQuestions(prev => prev.map(q => q.id === data.id ? data : q));
      addNotification(t('notify.answerEdited', { topic: data.topicNumber }));
    });

    eventSource.onerror = () => {
      setError(t('error.sseConnection'));
    };

    return () => {
      eventSource.close();
    };
  }, [addNotification, t]);

  // Translate questions state on change or locale change
  useEffect(() => {
    let active = true;

    if (!autoTranslateEnabled) {
      setTranslatedQuestions(questions);
      return;
    }

    async function translateAll() {
      const translated = await Promise.all(
        questions.map(async (q) => {
          const textKey = `${q.text}::${locale}`;
          const answerKey = q.answer ? `${q.answer}::${locale}` : '';

          let translatedText = q.text;
          if (q.text) {
            if (translationCache.has(textKey)) {
              translatedText = translationCache.get(textKey)!;
            } else {
              translatedText = await translateText(q.text, locale);
              translationCache.set(textKey, translatedText);
            }
          }

          let translatedAnswer = q.answer;
          if (q.answer) {
            if (translationCache.has(answerKey)) {
              translatedAnswer = translationCache.get(answerKey)!;
            } else {
              translatedAnswer = await translateText(q.answer, locale);
              translationCache.set(answerKey, translatedAnswer);
            }
          }

          return {
            ...q,
            text: translatedText,
            answer: translatedAnswer,
          };
        })
      );

      if (active) {
        setTranslatedQuestions(translated);
      }
    }

    translateAll();

    return () => {
      active = false;
    };
  }, [questions, locale, autoTranslateEnabled]);

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

  const editAnswer = async (id: string, answer: string, teacherToken: string) => {
    const res = await fetch(`/api/questions/${id}/answer`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${teacherToken}`
      },
      body: JSON.stringify({ answer })
    });
    if (!res.ok) {
      throw new Error(res.status === 401 ? 'Teacher access has expired' : 'Could not edit answer');
    }
  };

  return { questions: translatedQuestions, loading, error, notifications, submitQuestion, submitAnswer, editAnswer };
}
