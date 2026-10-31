import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Plus, Trash2, Copy, Upload, Zap, FileDown } from 'lucide-react';
import * as liveQuizUtils from '@/lib/liveQuizUtils';
import * as quizEnhancements from '@/lib/quizEnhancements';

interface QuestionForm {
  text: string;
  options: string[];
  correctAnswer: number;
  points: number;
}

type InputState = 'normal' | 'error' | 'success';

export const CreateLiveQuiz: React.FC = () => {
  const navigate = useNavigate();

  const [quizTitle, setQuizTitle] = useState('');
  const [quizDescription, setQuizDescription] = useState('');
  const [maxParticipants, setMaxParticipants] = useState('50');
  const [questions, setQuestions] = useState<QuestionForm[]>([
    {
      text: '',
      options: ['', '', '', ''],
      correctAnswer: 0,
      points: 10,
    },
  ]);

  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [createdQuizId, setCreatedQuizId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Timing controls
  const [isTimed, setIsTimed] = useState(true);
  const [totalTimeAmount, setTotalTimeAmount] = useState('5');
  const [totalTimeUnit, setTotalTimeUnit] = useState<'seconds' | 'minutes' | 'hours'>('minutes');
  
  // New state for enhancements
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [aiQuestions, setAiQuestions] = useState('5');
  const [aiDifficulty, setAiDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [showAIModal, setShowAIModal] = useState(false);
  const [inputStates, setInputStates] = useState<Record<string, InputState>>({
    title: 'normal',
  });

  // Update question text
  const updateQuestionText = (index: number, text: string) => {
    const newQuestions = [...questions];
    newQuestions[index].text = text;
    setQuestions(newQuestions);
  };

  // Update question option
  const updateOption = (questionIndex: number, optionIndex: number, value: string) => {
    const newQuestions = [...questions];
    newQuestions[questionIndex].options[optionIndex] = value;
    setQuestions(newQuestions);
  };

  // Update correct answer
  const updateCorrectAnswer = (questionIndex: number, answerIndex: number) => {
    const newQuestions = [...questions];
    newQuestions[questionIndex].correctAnswer = answerIndex;
    setQuestions(newQuestions);
  };

  // Update points
  const updatePoints = (questionIndex: number, points: number) => {
    const newQuestions = [...questions];
    newQuestions[questionIndex].points = points;
    setQuestions(newQuestions);
  };

  // Add question
  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        text: '',
        options: ['', '', '', ''],
        correctAnswer: 0,
        points: 10,
      },
    ]);
  };

  // Delete question
  const deleteQuestion = (index: number) => {
    if (questions.length > 1) {
      setQuestions(questions.filter((_, i) => i !== index));
    }
  };

  // Handle Excel file upload
  const handleExcelUpload = async (file: File) => {
    setUploadingFile(true);
    setUploadErrors([]);
    setError(null);

    try {
      const result = await quizEnhancements.parseExcelFile(file);

      if (result.errors.length > 0) {
        setUploadErrors(result.errors);
      }

      if (result.questions.length > 0) {
        setQuestions(prev => [
          ...prev.slice(0, -1), // Remove empty first question if exists
          ...result.questions.map(q => ({
            text: q.text,
            options: q.options,
            correctAnswer: q.correctAnswer,
            points: q.points || 10,
          })),
        ]);
        
        if (result.errors.length === 0) {
          setError(null);
        }
      }
    } catch (err) {
      setUploadErrors([
        `Failed to parse Excel: ${err instanceof Error ? err.message : 'Unknown error'}`,
      ]);
    } finally {
      setUploadingFile(false);
    }
  };

  // Handle AI quiz generation
  const handleGenerateAI = async () => {
    if (!aiTopic.trim()) {
      setError('Please enter a topic');
      return;
    }

    setAiLoading(true);
    setError(null);
    setUploadErrors([]);

    try {
      const result = await quizEnhancements.generateQuizWithAI(
        aiTopic,
        parseInt(aiQuestions, 10),
        aiDifficulty
      );

      if (result.error) {
        setError(result.error);
      } else if (result.questions.length > 0) {
        setQuestions(
          result.questions.map(q => ({
            text: q.text,
            options: q.options,
            correctAnswer: q.correctAnswer,
            points: q.points || 10,
          }))
        );
        setShowAIModal(false);
        setAiTopic('');
      }
    } catch (err) {
      setError(`Failed to generate quiz: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setAiLoading(false);
    }
  };

  // Validate form
  const isFormValid = () => {
    if (!quizTitle.trim()) return false;
    return questions.every(
      q =>
        q.text.trim() &&
        q.options.every(o => o.trim()) &&
        q.points > 0
    );
  };

  // Convert time to seconds
  const getTimeInSeconds = () => {
    const amount = parseInt(totalTimeAmount, 10);
    if (totalTimeUnit === 'seconds') return amount;
    if (totalTimeUnit === 'minutes') return amount * 60;
    if (totalTimeUnit === 'hours') return amount * 3600;
    return amount * 60; // default to minutes
  };

  // Create quiz
  const handleCreateQuiz = async () => {
    if (!isFormValid()) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formattedQuestions = questions.map((q) => ({
        text: q.text,
        options: q.options,
        correctAnswer: q.correctAnswer,
        points: q.points,
      }));

      const totalTimeInSeconds = getTimeInSeconds();

      const quiz = await liveQuizUtils.createLiveQuiz(
        quizTitle,
        quizDescription,
        formattedQuestions,
        parseInt(maxParticipants, 10),
        isTimed,
        totalTimeInSeconds
      );

      setCreatedCode(quiz.invite_code);
      setCreatedQuizId(quiz.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create quiz');
    } finally {
      setLoading(false);
    }
  };

  // Copy code
  const handleCopyCode = () => {
    if (createdCode) {
      navigator.clipboard.writeText(createdCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Go to lobby
  const handleGoToLobby = async () => {
    navigate(`/live-quiz/${createdQuizId}/lobby`);
  };

  // Show success screen
  if (createdCode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 p-4">
        <div className="max-w-md mx-auto mt-20">
          <Card className="p-8 shadow-lg">
            <div className="text-center mb-6">
              <div className="text-6xl mb-4">✅</div>
              <h1 className="text-3xl font-bold text-green-600 mb-2">Quiz Created!</h1>
              <p className="text-gray-600">Your quiz is ready to share</p>
            </div>

            <div className="bg-indigo-50 border-2 border-indigo-200 rounded-lg p-6 mb-6">
              <p className="text-sm text-gray-600 font-semibold mb-2 uppercase">Invite Code</p>
              <div className="flex items-center gap-2">
                <code className="text-3xl font-bold text-indigo-600 flex-1">
                  {createdCode}
                </code>
                <Button
                  onClick={handleCopyCode}
                  variant="ghost"
                  size="lg"
                  className="flex-shrink-0"
                >
                  <Copy className="h-5 w-5 text-indigo-600" />
                </Button>
              </div>
              {copied && (
                <p className="text-green-600 font-semibold text-sm mt-2">
                  ✓ Copied!
                </p>
              )}
              <p className="text-xs text-gray-500 mt-3">
                Share this code with others so they can join your quiz
              </p>
            </div>

            <div className="space-y-3">
              <Button
                onClick={handleGoToLobby}
                className="w-full py-3 text-lg font-bold bg-green-600 hover:bg-green-700 text-white rounded-lg"
              >
                Go to Lobby
              </Button>

              <Button
                onClick={() => {
                  setCreatedCode(null);
                  setQuizTitle('');
                  setQuizDescription('');
                  setQuestions([
                    {
                      text: '',
                      options: ['', '', '', ''],
                      correctAnswer: 0,
                      points: 10,
                    },
                  ]);
                }}
                variant="outline"
                className="w-full py-3 text-lg font-semibold border-2"
              >
                Create Another Quiz
              </Button>

              <Button
                onClick={() => navigate('/live-quiz')}
                variant="ghost"
                className="w-full py-3"
              >
                Back to Quizzes
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Create Live Quiz</h1>
          <p className="text-gray-600">Build a quiz and play with others in real-time</p>
        </div>

        {/* Quiz Details */}
        <Card className="mb-8 p-8 shadow-lg bg-white">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Quiz Details</h2>

          <div className="space-y-6">
            {/* Title */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Quiz Title *
              </label>
              <input
                type="text"
                value={quizTitle}
                onChange={(e) => {
                  setQuizTitle(e.target.value);
                  setInputStates(prev => ({
                    ...prev,
                    title: e.target.value.trim() ? 'success' : 'normal',
                  }));
                }}
                placeholder="e.g., Math Quiz, History Trivia"
                className={quizEnhancements.getInputClassName(inputStates.title)}
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Description (optional)
              </label>
              <textarea
                value={quizDescription}
                onChange={(e) => setQuizDescription(e.target.value)}
                placeholder="Describe your quiz (e.g., rules, difficulty)"
                rows={3}
                className={quizEnhancements.getTextareaClassName('normal')}
              />
            </div>

            {/* Max Participants */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Max Participants
              </label>
              <input
                type="number"
                value={maxParticipants}
                onChange={(e) => setMaxParticipants(e.target.value)}
                min="1"
                max="100"
                className={quizEnhancements.getInputClassName('normal')}
              />
            </div>

            {/* Timing Settings */}
            <div className="border-t-2 border-gray-200 pt-6">
              <div className="flex items-center gap-3 mb-4">
                <input
                  type="checkbox"
                  id="isTimed"
                  checked={isTimed}
                  onChange={(e) => setIsTimed(e.target.checked)}
                  className="w-5 h-5 cursor-pointer text-indigo-600 rounded"
                />
                <label htmlFor="isTimed" className="text-sm font-semibold text-gray-900 cursor-pointer">
                  ⏱️ Enable Timed Mode
                </label>
              </div>
              
              {isTimed && (
                <div className="flex gap-4 items-end">
                  {/* Total Time Amount */}
                  <div className="flex-1">
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Quiz Duration
                    </label>
                    <input
                      type="number"
                      value={totalTimeAmount}
                      onChange={(e) => setTotalTimeAmount(e.target.value)}
                      min="1"
                      max="3600"
                      step="1"
                      className={quizEnhancements.getInputClassName('normal')}
                    />
                  </div>

                  {/* Time Unit Selector */}
                  <div className="flex-1">
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Unit
                    </label>
                    <select
                      value={totalTimeUnit}
                      onChange={(e) => setTotalTimeUnit(e.target.value as 'seconds' | 'minutes' | 'hours')}
                      className={quizEnhancements.getInputClassName('normal')}
                    >
                      <option value="seconds">Seconds</option>
                      <option value="minutes">Minutes</option>
                      <option value="hours">Hours</option>
                    </select>
                  </div>
                </div>
              )}
              
              {!isTimed && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-700">
                    ✓ No time limits - participants answer at their own pace
                  </p>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Enhanced Tools */}
        <Card className="mb-8 p-8 shadow-lg bg-gradient-to-br from-purple-50 to-indigo-50">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">📚 Quick Import</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Excel Upload */}
            <div className="p-4 bg-white rounded-lg border-2 border-blue-200 hover:border-blue-400 transition-colors">
              <label className="flex flex-col items-center cursor-pointer">
                <Upload className="h-8 w-8 text-blue-600 mb-2" />
                <span className="text-sm font-semibold text-gray-900">Upload Excel</span>
                <span className="text-xs text-gray-500 mt-1">Bulk import questions</span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      handleExcelUpload(e.target.files[0]);
                    }
                  }}
                  disabled={uploadingFile}
                  className="hidden"
                />
              </label>
            </div>

            {/* AI Generation */}
            <div
              onClick={() => setShowAIModal(true)}
              className="p-4 bg-white rounded-lg border-2 border-purple-200 hover:border-purple-400 transition-colors cursor-pointer"
            >
              <div className="flex flex-col items-center">
                <Zap className="h-8 w-8 text-purple-600 mb-2" />
                <span className="text-sm font-semibold text-gray-900">Generate with AI</span>
                <span className="text-xs text-gray-500 mt-1">Auto-create questions</span>
              </div>
            </div>

            {/* Download Template */}
            <div
              onClick={() => quizEnhancements.downloadExcelTemplate()}
              className="p-4 bg-white rounded-lg border-2 border-green-200 hover:border-green-400 transition-colors cursor-pointer"
            >
              <div className="flex flex-col items-center">
                <FileDown className="h-8 w-8 text-green-600 mb-2" />
                <span className="text-sm font-semibold text-gray-900">Download Template</span>
                <span className="text-xs text-gray-500 mt-1">Excel format</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Upload Errors */}
        {uploadErrors.length > 0 && (
          <Card className="mb-8 p-4 bg-yellow-50 border border-yellow-200">
            <h3 className="font-semibold text-yellow-900 mb-2">Import Issues:</h3>
            <ul className="space-y-1">
              {uploadErrors.map((err, idx) => (
                <li key={idx} className="text-sm text-yellow-800">
                  • {err}
                </li>
              ))}
            </ul>
          </Card>
        )}

        {/* Questions */}
        <div className="space-y-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-900">
            Questions ({questions.length})
          </h2>
          {questions.map((question, qIdx) => (
            <Card key={qIdx} className="p-8 shadow-lg bg-white border-l-4 border-indigo-500">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">
                  Question {qIdx + 1}
                </h3>
                {questions.length > 1 && (
                  <Button
                    onClick={() => deleteQuestion(qIdx)}
                    variant="ghost"
                    className="text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                )}
              </div>

              <div className="space-y-6">
                {/* Question Text */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Question Text *
                  </label>
                  <textarea
                    value={question.text}
                    onChange={(e) => updateQuestionText(qIdx, e.target.value)}
                    placeholder="Enter your question"
                    rows={2}
                    className={quizEnhancements.getTextareaClassName('normal')}
                  />
                </div>

                {/* Answer Options */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-3">
                    Answer Options *
                  </label>
                  <div className="space-y-2">
                    {question.options.map((option, oIdx) => (
                      <div key={oIdx} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`correct-${qIdx}`}
                          checked={question.correctAnswer === oIdx}
                          onChange={() => updateCorrectAnswer(qIdx, oIdx)}
                          className="w-4 h-4 cursor-pointer text-indigo-600"
                        />
                        <input
                          type="text"
                          value={option}
                          onChange={(e) => updateOption(qIdx, oIdx, e.target.value)}
                          placeholder={`Option ${oIdx + 1}`}
                          className={`flex-1 ${quizEnhancements.getInputClassName('normal')}`}
                        />
                        {question.correctAnswer === oIdx && (
                          <span className="text-xs text-green-600 font-semibold whitespace-nowrap">
                            ✓ Correct
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Points */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Points *
                  </label>
                  <input
                    type="number"
                    value={question.points}
                    onChange={(e) => updatePoints(qIdx, parseInt(e.target.value, 10))}
                    min="1"
                    max="100"
                    className={quizEnhancements.getInputClassName('normal')}
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Add Question Button */}
        <Button
          onClick={addQuestion}
          variant="outline"
          className="w-full mb-8 py-4 text-lg font-semibold border-2 border-indigo-300 text-indigo-600 hover:bg-indigo-50 flex items-center justify-center gap-2 rounded-lg"
        >
          <Plus className="h-5 w-5" />
          Add Another Question
        </Button>

        {/* Error */}
        {error && (
          <Card className="mb-8 p-4 bg-red-50 border border-red-200">
            <p className="text-red-700 font-semibold">{error}</p>
          </Card>
        )}

        {/* Create Button */}
        <div className="space-y-3">
          <Button
            onClick={handleCreateQuiz}
            disabled={!isFormValid() || loading}
            className="w-full py-4 text-lg font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating...' : `Create Quiz (${questions.length} questions)`}
          </Button>

          <Button
            onClick={() => navigate('/live-quiz')}
            variant="outline"
            className="w-full py-3 text-base font-semibold border-2"
          >
            Cancel
          </Button>
        </div>
      </div>

      {/* AI Generation Modal */}
      {showAIModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md p-8 shadow-2xl">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">🤖 Generate Quiz with AI</h2>

            <div className="space-y-4 mb-6">
              {/* Topic */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Topic *
                </label>
                <input
                  type="text"
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  placeholder="e.g., Biology, World War 2, Python Programming"
                  className={quizEnhancements.getInputClassName('normal')}
                />
              </div>

              {/* Number of Questions */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Number of Questions
                </label>
                <select
                  value={aiQuestions}
                  onChange={(e) => setAiQuestions(e.target.value)}
                  className={quizEnhancements.getSelectClassName('normal')}
                >
                  {[3, 5, 10, 15, 20].map(n => (
                    <option key={n} value={n}>
                      {n} questions
                    </option>
                  ))}
                </select>
              </div>

              {/* Difficulty */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Difficulty Level
                </label>
                <div className="flex gap-2">
                  {(['easy', 'medium', 'hard'] as const).map(level => (
                    <button
                      key={level}
                      onClick={() => setAiDifficulty(level)}
                      className={`flex-1 py-2 px-3 rounded-lg font-semibold transition-colors capitalize ${
                        aiDifficulty === level
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Button
                onClick={handleGenerateAI}
                disabled={aiLoading || !aiTopic.trim()}
                className="w-full py-3 text-lg font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:opacity-50"
              >
                {aiLoading ? 'Generating...' : 'Generate Quiz'}
              </Button>

              <Button
                onClick={() => {
                  setShowAIModal(false);
                  setAiTopic('');
                }}
                variant="outline"
                className="w-full py-3 font-semibold border-2"
              >
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
