export type Locale = 'en' | 'pt' | 'es' | 'de' | 'ja';

export interface LocaleInfo {
  code: Locale;
  name: string;
  flag: string;
  dateLocale: string;
}

export const LOCALES: LocaleInfo[] = [
  { code: 'en', name: 'English', flag: '🇺🇸', dateLocale: 'en-US' },
  { code: 'pt', name: 'Português', flag: '🇧🇷', dateLocale: 'pt-BR' },
  { code: 'es', name: 'Español', flag: '🇪🇸', dateLocale: 'es-ES' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪', dateLocale: 'de-DE' },
  { code: 'ja', name: '日本語', flag: '🇯🇵', dateLocale: 'ja-JP' },
];

type TranslationKeys = {
  // Header
  'header.title': string;
  'header.signOut': string;
  'header.studentPage': string;
  // Role labels
  'role.teacher': string;
  'role.student': string;
  'role.home': string;
  // Selector
  'selector.title': string;
  'selector.description': string;
  'selector.continueStudent': string;
  'selector.continueTeacher': string;
  // Student Login
  'studentLogin.title': string;
  'studentLogin.description': string;
  'studentLogin.nameLabel': string;
  'studentLogin.namePlaceholder': string;
  'studentLogin.submit': string;
  // Teacher Login
  'teacherLogin.title': string;
  'teacherLogin.description': string;
  'teacherLogin.passwordLabel': string;
  'teacherLogin.passwordPlaceholder': string;
  'teacherLogin.nameLabel': string;
  'teacherLogin.namePlaceholder': string;
  'teacherLogin.submit': string;
  'teacherLogin.validating': string;
  'teacherLogin.errorInvalid': string;
  'teacherLogin.errorNetwork': string;
  // Student View
  'student.label': string;
  'student.newQuestion': string;
  'student.topicLabel': string;
  'student.topicPlaceholder': string;
  'student.questionLabel': string;
  'student.questionPlaceholder': string;
  'student.submitButton': string;
  'student.submitting': string;
  'student.submitError': string;
  'student.changeId': string;
  'student.questionBoard': string;
  'student.noQuestions': string;
  'student.teacherAnswer': string;
  'student.waitingAnswer': string;
  'student.showPrevious': string;
  'student.hidePrevious': string;
  'student.previousVersion': string;
  // Teacher View
  'teacher.dashboard': string;
  'teacher.pendingCount': string;
  'teacher.filterPending': string;
  'teacher.filterAnswered': string;
  'teacher.filterAll': string;
  'teacher.allCaughtUp': string;
  'teacher.noMatching': string;
  'teacher.topic': string;
  'teacher.studentLabel': string;
  'teacher.pending': string;
  'teacher.answerLabel': string;
  'teacher.editButton': string;
  'teacher.editingAnswer': string;
  'teacher.editPlaceholder': string;
  'teacher.cancel': string;
  'teacher.saveChanges': string;
  'teacher.answerPlaceholder': string;
  'teacher.submitAnswer': string;
  'teacher.answerQuestion': string;
  'teacher.answeredBy': string;
  'teacher.submitError': string;
  'teacher.editError': string;
  'teacher.showPrevious': string;
  'teacher.hidePrevious': string;
  'teacher.previousVersion': string;
  // Notifications
  'notify.newQuestion': string;
  'notify.questionAnswered': string;
  'notify.answerEdited': string;
  // SSE error
  'error.sseConnection': string;
  // Footer
  'footer.text': string;
  // By prefix
  'student.by': string;
};

export type TranslationKey = keyof TranslationKeys;

const en: TranslationKeys = {
  'header.title': 'Q&A Dashboard',
  'header.signOut': 'Sign out',
  'header.studentPage': 'Student page',
  'role.teacher': 'Teacher',
  'role.student': 'Student',
  'role.home': 'Home',
  'selector.title': 'Choose an interface',
  'selector.description': 'Join as a student to submit questions or as a teacher to answer them.',
  'selector.continueStudent': 'Continue as student',
  'selector.continueTeacher': 'Continue as teacher',
  'studentLogin.title': 'Student identification',
  'studentLogin.description': 'Enter your name to join the question board.',
  'studentLogin.nameLabel': 'Name',
  'studentLogin.namePlaceholder': 'Enter your name',
  'studentLogin.submit': 'Continue as student',
  'teacherLogin.title': 'Teacher access',
  'teacherLogin.description': 'Enter the password configured for this project. Name is optional.',
  'teacherLogin.passwordLabel': 'Password',
  'teacherLogin.passwordPlaceholder': 'Teacher password',
  'teacherLogin.nameLabel': 'Teacher name',
  'teacherLogin.namePlaceholder': 'Optional',
  'teacherLogin.submit': 'Open dashboard',
  'teacherLogin.validating': 'Validating...',
  'teacherLogin.errorInvalid': 'Invalid password. Check the password configured for this project.',
  'teacherLogin.errorNetwork': 'Could not validate access right now.',
  'student.label': 'Student',
  'student.newQuestion': 'New Question',
  'student.topicLabel': 'Topic Number',
  'student.topicPlaceholder': 'Example: 1.5',
  'student.questionLabel': 'Your question',
  'student.questionPlaceholder': 'Describe what you did not understand about this topic...',
  'student.submitButton': 'Submit Question',
  'student.submitting': 'Submitting...',
  'student.submitError': 'Could not submit the question.',
  'student.changeId': 'Change identification',
  'student.questionBoard': 'Question Board',
  'student.noQuestions': 'No questions have been submitted yet. Be the first to ask!',
  'student.teacherAnswer': 'Teacher Answer',
  'student.waitingAnswer': 'Waiting for an answer...',
  'student.showPrevious': 'Show previous version',
  'student.hidePrevious': 'Hide previous version',
  'student.previousVersion': 'Previous version',
  'student.by': 'by',
  'teacher.dashboard': 'Teacher Dashboard',
  'teacher.pendingCount': 'You have {count} pending questions to answer.',
  'teacher.filterPending': 'Pending',
  'teacher.filterAnswered': 'Answered',
  'teacher.filterAll': 'All',
  'teacher.allCaughtUp': 'All caught up!',
  'teacher.noMatching': 'There are no questions matching this filter.',
  'teacher.topic': 'Topic',
  'teacher.studentLabel': 'Student:',
  'teacher.pending': 'Pending',
  'teacher.answerLabel': 'Answer',
  'teacher.editButton': 'Edit',
  'teacher.editingAnswer': 'Editing answer',
  'teacher.editPlaceholder': 'Edit the answer...',
  'teacher.cancel': 'Cancel',
  'teacher.saveChanges': 'Save Changes',
  'teacher.answerPlaceholder': 'Write the answer...',
  'teacher.submitAnswer': 'Submit Answer',
  'teacher.answerQuestion': 'Answer Question',
  'teacher.answeredBy': 'Answered by',
  'teacher.submitError': 'Could not submit the answer. Check whether teacher access is still valid.',
  'teacher.editError': 'Could not update the answer. Check whether teacher access is still valid.',
  'teacher.showPrevious': 'Show previous version',
  'teacher.hidePrevious': 'Hide previous version',
  'teacher.previousVersion': 'Previous version',
  'notify.newQuestion': 'New question posted - Topic {topic}',
  'notify.questionAnswered': 'The question for topic {topic} has been answered!',
  'notify.answerEdited': 'The answer for topic {topic} has been updated!',
  'error.sseConnection': 'Real-time connection issue. Trying to reconnect...',
  'footer.text': 'Control Panel - Q&A Dashboard v1.1.0 - Made By',
};

const pt: TranslationKeys = {
  'header.title': 'Painel de Perguntas',
  'header.signOut': 'Sair',
  'header.studentPage': 'Página do aluno',
  'role.teacher': 'Professor',
  'role.student': 'Aluno',
  'role.home': 'Início',
  'selector.title': 'Escolha uma interface',
  'selector.description': 'Entre como aluno para enviar perguntas ou como professor para respondê-las.',
  'selector.continueStudent': 'Continuar como aluno',
  'selector.continueTeacher': 'Continuar como professor',
  'studentLogin.title': 'Identificação do aluno',
  'studentLogin.description': 'Digite seu nome para entrar no painel de perguntas.',
  'studentLogin.nameLabel': 'Nome',
  'studentLogin.namePlaceholder': 'Digite seu nome',
  'studentLogin.submit': 'Continuar como aluno',
  'teacherLogin.title': 'Acesso do professor',
  'teacherLogin.description': 'Digite a senha configurada para este projeto. O nome é opcional.',
  'teacherLogin.passwordLabel': 'Senha',
  'teacherLogin.passwordPlaceholder': 'Senha do professor',
  'teacherLogin.nameLabel': 'Nome do professor',
  'teacherLogin.namePlaceholder': 'Opcional',
  'teacherLogin.submit': 'Abrir painel',
  'teacherLogin.validating': 'Validando...',
  'teacherLogin.errorInvalid': 'Senha inválida. Verifique a senha configurada para este projeto.',
  'teacherLogin.errorNetwork': 'Não foi possível validar o acesso agora.',
  'student.label': 'Aluno',
  'student.newQuestion': 'Nova Pergunta',
  'student.topicLabel': 'Número do Tópico',
  'student.topicPlaceholder': 'Exemplo: 1.5',
  'student.questionLabel': 'Sua pergunta',
  'student.questionPlaceholder': 'Descreva o que você não entendeu sobre este tópico...',
  'student.submitButton': 'Enviar Pergunta',
  'student.submitting': 'Enviando...',
  'student.submitError': 'Não foi possível enviar a pergunta.',
  'student.changeId': 'Alterar identificação',
  'student.questionBoard': 'Quadro de Perguntas',
  'student.noQuestions': 'Nenhuma pergunta foi enviada ainda. Seja o primeiro a perguntar!',
  'student.teacherAnswer': 'Resposta do Professor',
  'student.waitingAnswer': 'Aguardando resposta...',
  'student.showPrevious': 'Mostrar versão anterior',
  'student.hidePrevious': 'Ocultar versão anterior',
  'student.previousVersion': 'Versão anterior',
  'student.by': 'por',
  'teacher.dashboard': 'Painel do Professor',
  'teacher.pendingCount': 'Você tem {count} perguntas pendentes para responder.',
  'teacher.filterPending': 'Pendentes',
  'teacher.filterAnswered': 'Respondidas',
  'teacher.filterAll': 'Todas',
  'teacher.allCaughtUp': 'Tudo em dia!',
  'teacher.noMatching': 'Não há perguntas correspondentes a este filtro.',
  'teacher.topic': 'Tópico',
  'teacher.studentLabel': 'Aluno:',
  'teacher.pending': 'Pendente',
  'teacher.answerLabel': 'Resposta',
  'teacher.editButton': 'Editar',
  'teacher.editingAnswer': 'Editando resposta',
  'teacher.editPlaceholder': 'Edite a resposta...',
  'teacher.cancel': 'Cancelar',
  'teacher.saveChanges': 'Salvar Alterações',
  'teacher.answerPlaceholder': 'Escreva a resposta...',
  'teacher.submitAnswer': 'Enviar Resposta',
  'teacher.answerQuestion': 'Responder Pergunta',
  'teacher.answeredBy': 'Respondido por',
  'teacher.submitError': 'Não foi possível enviar a resposta. Verifique se o acesso do professor ainda é válido.',
  'teacher.editError': 'Não foi possível atualizar a resposta. Verifique se o acesso do professor ainda é válido.',
  'teacher.showPrevious': 'Mostrar versão anterior',
  'teacher.hidePrevious': 'Ocultar versão anterior',
  'teacher.previousVersion': 'Versão anterior',
  'notify.newQuestion': 'Nova pergunta publicada - Tópico {topic}',
  'notify.questionAnswered': 'A pergunta do tópico {topic} foi respondida!',
  'notify.answerEdited': 'A resposta do tópico {topic} foi atualizada!',
  'error.sseConnection': 'Problema na conexão em tempo real. Tentando reconectar...',
  'footer.text': 'Painel de Controle - Q&A Dashboard v1.1.0 - Feito por',
};

const es: TranslationKeys = {
  'header.title': 'Panel de Preguntas',
  'header.signOut': 'Cerrar sesión',
  'header.studentPage': 'Página del estudiante',
  'role.teacher': 'Profesor',
  'role.student': 'Estudiante',
  'role.home': 'Inicio',
  'selector.title': 'Elige una interfaz',
  'selector.description': 'Únete como estudiante para enviar preguntas o como profesor para responderlas.',
  'selector.continueStudent': 'Continuar como estudiante',
  'selector.continueTeacher': 'Continuar como profesor',
  'studentLogin.title': 'Identificación del estudiante',
  'studentLogin.description': 'Ingresa tu nombre para unirte al panel de preguntas.',
  'studentLogin.nameLabel': 'Nombre',
  'studentLogin.namePlaceholder': 'Ingresa tu nombre',
  'studentLogin.submit': 'Continuar como estudiante',
  'teacherLogin.title': 'Acceso del profesor',
  'teacherLogin.description': 'Ingresa la contraseña configurada para este proyecto. El nombre es opcional.',
  'teacherLogin.passwordLabel': 'Contraseña',
  'teacherLogin.passwordPlaceholder': 'Contraseña del profesor',
  'teacherLogin.nameLabel': 'Nombre del profesor',
  'teacherLogin.namePlaceholder': 'Opcional',
  'teacherLogin.submit': 'Abrir panel',
  'teacherLogin.validating': 'Validando...',
  'teacherLogin.errorInvalid': 'Contraseña inválida. Verifica la contraseña configurada para este proyecto.',
  'teacherLogin.errorNetwork': 'No se pudo validar el acceso en este momento.',
  'student.label': 'Estudiante',
  'student.newQuestion': 'Nueva Pregunta',
  'student.topicLabel': 'Número del Tema',
  'student.topicPlaceholder': 'Ejemplo: 1.5',
  'student.questionLabel': 'Tu pregunta',
  'student.questionPlaceholder': 'Describe lo que no entendiste sobre este tema...',
  'student.submitButton': 'Enviar Pregunta',
  'student.submitting': 'Enviando...',
  'student.submitError': 'No se pudo enviar la pregunta.',
  'student.changeId': 'Cambiar identificación',
  'student.questionBoard': 'Tablero de Preguntas',
  'student.noQuestions': '¡Aún no se han enviado preguntas. Sé el primero en preguntar!',
  'student.teacherAnswer': 'Respuesta del Profesor',
  'student.waitingAnswer': 'Esperando respuesta...',
  'student.showPrevious': 'Mostrar versión anterior',
  'student.hidePrevious': 'Ocultar versión anterior',
  'student.previousVersion': 'Versión anterior',
  'student.by': 'por',
  'teacher.dashboard': 'Panel del Profesor',
  'teacher.pendingCount': 'Tienes {count} preguntas pendientes por responder.',
  'teacher.filterPending': 'Pendientes',
  'teacher.filterAnswered': 'Respondidas',
  'teacher.filterAll': 'Todas',
  'teacher.allCaughtUp': '¡Todo al día!',
  'teacher.noMatching': 'No hay preguntas que coincidan con este filtro.',
  'teacher.topic': 'Tema',
  'teacher.studentLabel': 'Estudiante:',
  'teacher.pending': 'Pendiente',
  'teacher.answerLabel': 'Respuesta',
  'teacher.editButton': 'Editar',
  'teacher.editingAnswer': 'Editando respuesta',
  'teacher.editPlaceholder': 'Edita la respuesta...',
  'teacher.cancel': 'Cancelar',
  'teacher.saveChanges': 'Guardar Cambios',
  'teacher.answerPlaceholder': 'Escribe la respuesta...',
  'teacher.submitAnswer': 'Enviar Respuesta',
  'teacher.answerQuestion': 'Responder Pregunta',
  'teacher.answeredBy': 'Respondido por',
  'teacher.submitError': 'No se pudo enviar la respuesta. Verifica si el acceso del profesor sigue vigente.',
  'teacher.editError': 'No se pudo actualizar la respuesta. Verifica si el acceso del profesor sigue vigente.',
  'teacher.showPrevious': 'Mostrar versión anterior',
  'teacher.hidePrevious': 'Ocultar versión anterior',
  'teacher.previousVersion': 'Versión anterior',
  'notify.newQuestion': 'Nueva pregunta publicada - Tema {topic}',
  'notify.questionAnswered': '¡La pregunta del tema {topic} fue respondida!',
  'notify.answerEdited': '¡La respuesta del tema {topic} fue actualizada!',
  'error.sseConnection': 'Problema de conexión en tiempo real. Intentando reconectar...',
  'footer.text': 'Panel de Control - Q&A Dashboard v1.1.0 - Hecho por',
};

const de: TranslationKeys = {
  'header.title': 'Fragen-Dashboard',
  'header.signOut': 'Abmelden',
  'header.studentPage': 'Schülerseite',
  'role.teacher': 'Lehrer',
  'role.student': 'Schüler',
  'role.home': 'Startseite',
  'selector.title': 'Oberfläche wählen',
  'selector.description': 'Melden Sie sich als Schüler an, um Fragen zu stellen, oder als Lehrer, um sie zu beantworten.',
  'selector.continueStudent': 'Als Schüler fortfahren',
  'selector.continueTeacher': 'Als Lehrer fortfahren',
  'studentLogin.title': 'Schüleridentifikation',
  'studentLogin.description': 'Geben Sie Ihren Namen ein, um dem Fragenboard beizutreten.',
  'studentLogin.nameLabel': 'Name',
  'studentLogin.namePlaceholder': 'Geben Sie Ihren Namen ein',
  'studentLogin.submit': 'Als Schüler fortfahren',
  'teacherLogin.title': 'Lehrerzugang',
  'teacherLogin.description': 'Geben Sie das für dieses Projekt konfigurierte Passwort ein. Name ist optional.',
  'teacherLogin.passwordLabel': 'Passwort',
  'teacherLogin.passwordPlaceholder': 'Lehrerpasswort',
  'teacherLogin.nameLabel': 'Lehrername',
  'teacherLogin.namePlaceholder': 'Optional',
  'teacherLogin.submit': 'Dashboard öffnen',
  'teacherLogin.validating': 'Wird überprüft...',
  'teacherLogin.errorInvalid': 'Ungültiges Passwort. Überprüfen Sie das konfigurierte Passwort.',
  'teacherLogin.errorNetwork': 'Der Zugang konnte jetzt nicht überprüft werden.',
  'student.label': 'Schüler',
  'student.newQuestion': 'Neue Frage',
  'student.topicLabel': 'Themennummer',
  'student.topicPlaceholder': 'Beispiel: 1.5',
  'student.questionLabel': 'Ihre Frage',
  'student.questionPlaceholder': 'Beschreiben Sie, was Sie zu diesem Thema nicht verstanden haben...',
  'student.submitButton': 'Frage absenden',
  'student.submitting': 'Wird gesendet...',
  'student.submitError': 'Die Frage konnte nicht gesendet werden.',
  'student.changeId': 'Identifikation ändern',
  'student.questionBoard': 'Fragenboard',
  'student.noQuestions': 'Es wurden noch keine Fragen gestellt. Stellen Sie die erste Frage!',
  'student.teacherAnswer': 'Lehrerantwort',
  'student.waitingAnswer': 'Warten auf Antwort...',
  'student.showPrevious': 'Vorherige Version anzeigen',
  'student.hidePrevious': 'Vorherige Version ausblenden',
  'student.previousVersion': 'Vorherige Version',
  'student.by': 'von',
  'teacher.dashboard': 'Lehrer-Dashboard',
  'teacher.pendingCount': 'Sie haben {count} ausstehende Fragen zu beantworten.',
  'teacher.filterPending': 'Ausstehend',
  'teacher.filterAnswered': 'Beantwortet',
  'teacher.filterAll': 'Alle',
  'teacher.allCaughtUp': 'Alles erledigt!',
  'teacher.noMatching': 'Keine Fragen entsprechen diesem Filter.',
  'teacher.topic': 'Thema',
  'teacher.studentLabel': 'Schüler:',
  'teacher.pending': 'Ausstehend',
  'teacher.answerLabel': 'Antwort',
  'teacher.editButton': 'Bearbeiten',
  'teacher.editingAnswer': 'Antwort bearbeiten',
  'teacher.editPlaceholder': 'Antwort bearbeiten...',
  'teacher.cancel': 'Abbrechen',
  'teacher.saveChanges': 'Änderungen speichern',
  'teacher.answerPlaceholder': 'Antwort schreiben...',
  'teacher.submitAnswer': 'Antwort absenden',
  'teacher.answerQuestion': 'Frage beantworten',
  'teacher.answeredBy': 'Beantwortet von',
  'teacher.submitError': 'Die Antwort konnte nicht gesendet werden. Prüfen Sie den Lehrerzugang.',
  'teacher.editError': 'Die Antwort konnte nicht aktualisiert werden. Prüfen Sie den Lehrerzugang.',
  'teacher.showPrevious': 'Vorherige Version anzeigen',
  'teacher.hidePrevious': 'Vorherige Version ausblenden',
  'teacher.previousVersion': 'Vorherige Version',
  'notify.newQuestion': 'Neue Frage veröffentlicht - Thema {topic}',
  'notify.questionAnswered': 'Die Frage zu Thema {topic} wurde beantwortet!',
  'notify.answerEdited': 'Die Antwort zu Thema {topic} wurde aktualisiert!',
  'error.sseConnection': 'Echtzeit-Verbindungsproblem. Versuche, die Verbindung wiederherzustellen...',
  'footer.text': 'Kontrollzentrum - Q&A Dashboard v1.1.0 - Erstellt von',
};

const ja: TranslationKeys = {
  'header.title': 'Q&A ダッシュボード',
  'header.signOut': 'ログアウト',
  'header.studentPage': '生徒ページ',
  'role.teacher': '教師',
  'role.student': '生徒',
  'role.home': 'ホーム',
  'selector.title': 'インターフェースを選択',
  'selector.description': '質問を投稿するには生徒として、回答するには教師として参加してください。',
  'selector.continueStudent': '生徒として続行',
  'selector.continueTeacher': '教師として続行',
  'studentLogin.title': '生徒の識別',
  'studentLogin.description': '名前を入力して質問ボードに参加してください。',
  'studentLogin.nameLabel': '名前',
  'studentLogin.namePlaceholder': '名前を入力',
  'studentLogin.submit': '生徒として続行',
  'teacherLogin.title': '教師アクセス',
  'teacherLogin.description': 'このプロジェクトに設定されたパスワードを入力してください。名前は任意です。',
  'teacherLogin.passwordLabel': 'パスワード',
  'teacherLogin.passwordPlaceholder': '教師パスワード',
  'teacherLogin.nameLabel': '教師名',
  'teacherLogin.namePlaceholder': '任意',
  'teacherLogin.submit': 'ダッシュボードを開く',
  'teacherLogin.validating': '検証中...',
  'teacherLogin.errorInvalid': 'パスワードが無効です。設定されたパスワードを確認してください。',
  'teacherLogin.errorNetwork': '現在アクセスを検証できません。',
  'student.label': '生徒',
  'student.newQuestion': '新しい質問',
  'student.topicLabel': 'トピック番号',
  'student.topicPlaceholder': '例: 1.5',
  'student.questionLabel': 'あなたの質問',
  'student.questionPlaceholder': 'このトピックについて理解できなかった点を記述してください...',
  'student.submitButton': '質問を送信',
  'student.submitting': '送信中...',
  'student.submitError': '質問を送信できませんでした。',
  'student.changeId': '識別を変更',
  'student.questionBoard': '質問ボード',
  'student.noQuestions': 'まだ質問が投稿されていません。最初に質問してみましょう！',
  'student.teacherAnswer': '教師の回答',
  'student.waitingAnswer': '回答待ち...',
  'student.showPrevious': '以前のバージョンを表示',
  'student.hidePrevious': '以前のバージョンを非表示',
  'student.previousVersion': '以前のバージョン',
  'student.by': '投稿者',
  'teacher.dashboard': '教師ダッシュボード',
  'teacher.pendingCount': '回答待ちの質問が {count} 件あります。',
  'teacher.filterPending': '未回答',
  'teacher.filterAnswered': '回答済み',
  'teacher.filterAll': 'すべて',
  'teacher.allCaughtUp': 'すべて完了！',
  'teacher.noMatching': 'このフィルターに一致する質問はありません。',
  'teacher.topic': 'トピック',
  'teacher.studentLabel': '生徒:',
  'teacher.pending': '未回答',
  'teacher.answerLabel': '回答',
  'teacher.editButton': '編集',
  'teacher.editingAnswer': '回答を編集中',
  'teacher.editPlaceholder': '回答を編集...',
  'teacher.cancel': 'キャンセル',
  'teacher.saveChanges': '変更を保存',
  'teacher.answerPlaceholder': '回答を書く...',
  'teacher.submitAnswer': '回答を送信',
  'teacher.answerQuestion': '質問に回答',
  'teacher.answeredBy': '回答者',
  'teacher.submitError': '回答を送信できませんでした。教師アクセスが有効か確認してください。',
  'teacher.editError': '回答を更新できませんでした。教師アクセスが有効か確認してください。',
  'teacher.showPrevious': '以前のバージョンを表示',
  'teacher.hidePrevious': '以前のバージョンを非表示',
  'teacher.previousVersion': '以前のバージョン',
  'notify.newQuestion': '新しい質問が投稿されました - トピック {topic}',
  'notify.questionAnswered': 'トピック {topic} の質問が回答されました！',
  'notify.answerEdited': 'トピック {topic} の回答が更新されました！',
  'error.sseConnection': 'リアルタイム接続の問題。再接続を試みています...',
  'footer.text': 'コントロールパネル - Q&A Dashboard v1.1.0 - 作成者',
};

export const translations: Record<Locale, TranslationKeys> = { en, pt, es, de, ja };
