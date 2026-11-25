import { useEffect, useState, useCallback } from 'react';
import { Question } from '../types';
import { useI18n } from '../i18n/I18nContext';

// Per-tab cache, so switching locales back and forth does not re-request.
// The server keeps its own shared cache; this one only avoids round trips.
const translationCache = new Map<string, string>();

/**
 * Translates a batch of strings through our own server.
 *
 * This used to call translate.googleapis.com directly from the browser, which
 * meant an undocumented endpoint, every student's device sending the class's
 * questions to Google, and thirty devices requesting the same strings. The
 * server now owns the provider and the cache; it answers 404 when no provider
 * is configured, in which case the originals are returned unchanged.
 */
async function translateBatch(texts: string[], targetLocale: string): Promise<string[]> {
  if (texts.length === 0) return texts;

  const target = targetLocale || 'en';
  try {
    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts, target })
    });
    if (!res.ok) throw new Error(`Translation failed (${res.status})`);

    const data = await res.json();
    if (!Array.isArray(data.translations) || data.translations.length !== texts.length) {
      throw new Error('Malformed translation response');
    }
    return data.translations.map((value: unknown, index: number) =>
      typeof value === 'string' && value ? value : texts[index]
    );
  } catch (err) {
    console.warn('Translation unavailable, showing the original text:', err);
    return texts;
  }
}

export function useQuestions() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [translatedQuestions, setTranslatedQuestions] = useState<Question[]>([]);
  // Starts false: translation is opt-in server-side, so nothing is requested
  // until /api/config confirms a provider is configured.
  const [autoTranslateEnabled, setAutoTranslateEnabled] = useState(false);
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
        setAutoTranslateEnabled(data.enableAutoTranslate === true);
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

    eventSource.addEventListener('board_cleared', () => {
      setQuestions([]);
      addNotification(t('notify.boardCleared'));
    });

    eventSource.onerror = () => {
      setError(t('error.sseConnection'));
    };

    return () => {
      eventSource.close();
    };
  }, [addNotification, t]);

  // Translate the board whenever it changes or the locale does.
  useEffect(() => {
    let active = true;

    if (!autoTranslateEnabled) {
      setTranslatedQuestions(questions);
      return;
    }

    async function translateAll() {
      // Collect every distinct string still missing from the cache, so one
      // request covers the whole board instead of one request per field.
      const pending: string[] = [];
      const seen = new Set<string>();

      for (const q of questions) {
        for (const value of [q.text, q.answer]) {
          if (!value) continue;
          const key = `${value}::${locale}`;
          if (translationCache.has(key) || seen.has(key)) continue;
          seen.add(key);
          pending.push(value);
        }
      }

      if (pending.length > 0) {
        const translations = await translateBatch(pending, locale);
        if (!active) return;
        pending.forEach((original, index) => {
          translationCache.set(`${original}::${locale}`, translations[index]);
        });
      }

      const translated = questions.map((q) => ({
        ...q,
        text: q.text ? translationCache.get(`${q.text}::${locale}`) ?? q.text : q.text,
        answer: q.answer ? translationCache.get(`${q.answer}::${locale}`) ?? q.answer : q.answer,
      }));

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

  const clearBoard = async (teacherToken: string) => {
    const res = await fetch('/api/questions', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${teacherToken}` }
    });
    if (!res.ok) {
      throw new Error(res.status === 401 ? 'Teacher access has expired' : 'Could not clear the board');
    }
  };

  return { questions: translatedQuestions, loading, error, notifications, submitQuestion, submitAnswer, editAnswer, clearBoard };
}
