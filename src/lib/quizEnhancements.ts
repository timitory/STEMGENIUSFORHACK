/**
 * Quiz Enhancement Utilities
 * - Excel file parsing for bulk question import
 * - AI-powered quiz generation
 * - Input styling utilities
 */

import { supabase } from '@/integrations/supabase/client';

// ============================================
// TYPES
// ============================================

export interface QuestionData {
  text: string;
  options: string[];
  correctAnswer: number;
  points?: number;
}

export interface ExcelParseResult {
  questions: QuestionData[];
  errors: string[];
}

// ============================================
// EXCEL PARSING
// ============================================

/**
 * Parse Excel file for questions
 * Expected format:
 * Column A: Question Text
 * Column B: Option A
 * Column C: Option B
 * Column D: Option C
 * Column E: Option D
 * Column F: Correct Answer (1-4)
 * Column G: Points (optional, defaults to 10)
 */
export const parseExcelFile = async (file: File): Promise<ExcelParseResult> => {
  const errors: string[] = [];
  const questions: QuestionData[] = [];

  try {
    // Dynamically import xlsx to avoid bundling issues
    const XLSX = await import('xlsx');

    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[];

    if (!rows || rows.length === 0) {
      errors.push('Excel file is empty');
      return { questions, errors };
    }

    // Skip header row if exists
    const startRow = rows[0]?.[0]?.toLowerCase() === 'question' ? 1 : 0;

    rows.slice(startRow).forEach((row: any[], index: number) => {
      const rowNum = startRow + index + 1;

      try {
        // Validate row has required columns
        if (!row[0] || row.length < 6) {
          errors.push(`Row ${rowNum}: Missing required columns (Question, 4 Options, Correct Answer)`);
          return;
        }

        const questionText = String(row[0]).trim();
        const optionA = String(row[1] || '').trim();
        const optionB = String(row[2] || '').trim();
        const optionC = String(row[3] || '').trim();
        const optionD = String(row[4] || '').trim();
        const correctAnswerStr = String(row[5] || '').trim();
        const pointsStr = String(row[6] || '10').trim();

        // Validate question text
        if (!questionText) {
          errors.push(`Row ${rowNum}: Question text is required`);
          return;
        }

        // Validate all options are filled
        if (!optionA || !optionB || !optionC || !optionD) {
          errors.push(`Row ${rowNum}: All 4 options must be filled`);
          return;
        }

        // Validate correct answer
        const correctAnswer = parseInt(correctAnswerStr, 10);
        if (isNaN(correctAnswer) || correctAnswer < 1 || correctAnswer > 4) {
          errors.push(`Row ${rowNum}: Correct Answer must be 1, 2, 3, or 4`);
          return;
        }

        // Validate points
        const points = parseInt(pointsStr, 10);
        if (isNaN(points) || points <= 0) {
          errors.push(`Row ${rowNum}: Points must be a positive number`);
          return;
        }

        questions.push({
          text: questionText,
          options: [optionA, optionB, optionC, optionD],
          correctAnswer: correctAnswer - 1, // Convert to 0-based index
          points,
        });
      } catch (err) {
        errors.push(`Row ${rowNum}: ${err instanceof Error ? err.message : 'Invalid row format'}`);
      }
    });

    if (questions.length === 0 && errors.length === 0) {
      errors.push('No valid questions found in Excel file');
    }

    return { questions, errors };
  } catch (err) {
    errors.push(`Failed to parse Excel file: ${err instanceof Error ? err.message : 'Unknown error'}`);
    return { questions, errors };
  }
};

// ============================================
// AI QUIZ GENERATION
// ============================================

/**
 * Generate quiz questions using AI
 * Uses Supabase's edge functions to call Claude API
 */
export const generateQuizWithAI = async (
  topic: string,
  numberOfQuestions: number,
  difficulty: 'easy' | 'medium' | 'hard',
  quizType: string = 'multiple-choice'
): Promise<{ questions: QuestionData[]; error?: string }> => {
  try {
    console.log('🤖 Starting AI quiz generation:', { topic, numberOfQuestions, difficulty });
    
    const { data, error } = await supabase.functions.invoke('generate-quiz', {
      body: {
        topic,
        numberOfQuestions,
        difficulty,
        quizType,
      },
    });

    if (error) {
      console.error('❌ AI Generation API error:', error);
      throw new Error(error.message || 'Failed to generate quiz');
    }

    console.log('✅ AI API response received:', data);

    // Validate response format
    if (!data?.questions || !Array.isArray(data.questions)) {
      console.error('❌ Invalid response format:', data);
      throw new Error('Invalid response format from AI');
    }

    // Ensure all questions have required fields
    // Handle both "text" and "question" field names from different API responses
    const validatedQuestions = data.questions.map((q: any) => {
      const questionObj = {
        text: q.text || q.question || '',
        options: Array.isArray(q.options) ? q.options : [],
        correctAnswer: typeof q.correctAnswer === 'number' ? q.correctAnswer : 0,
        points: q.points || 10,
      };
      console.log('Question:', questionObj);
      return questionObj;
    });

    console.log('✅ Generated questions:', validatedQuestions);
    return { questions: validatedQuestions };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to generate quiz with AI';
    console.error('❌ AI Generation Error:', errorMessage);
    return { questions: [], error: errorMessage };
  }
};

// ============================================
// EXCEL TEMPLATE DOWNLOAD
// ============================================

/**
 * Generate and download an Excel template for bulk question upload
 */
export const downloadExcelTemplate = () => {
  try {
    // Create CSV data (as fallback if xlsx not available)
    const csvContent = [
      ['Question', 'Option A', 'Option B', 'Option C', 'Option D', 'Correct Answer (1-4)', 'Points'],
      ['What is 2+2?', '3', '4', '5', '6', '2', '10'],
      ['What is the capital of France?', 'London', 'Berlin', 'Paris', 'Madrid', '3', '10'],
      ['Who wrote Romeo and Juliet?', 'Mark Twain', 'William Shakespeare', 'Jane Austen', 'Charles Dickens', '2', '10'],
    ]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'quiz-questions-template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Failed to download template:', err);
    throw err;
  }
};

// ============================================
// STYLING UTILITIES
// ============================================

/**
 * Input field styling utilities
 */
export const inputStyles = {
  base: 'w-full px-4 py-3 rounded-lg transition-all duration-200',
  background:
    'bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800',
  border: 'border-2 border-slate-200 dark:border-slate-700',
  focus: 'focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200',
  text: 'text-gray-900 dark:text-white',
  placeholder: 'placeholder-gray-500 dark:placeholder-gray-400',
  error: 'border-red-500 focus:border-red-500 focus:ring-red-200',
  success: 'border-green-500 focus:border-green-500 focus:ring-green-200',
};

export const getInputClassName = (
  state: 'normal' | 'error' | 'success' = 'normal'
): string => {
  const states = {
    normal: `${inputStyles.base} ${inputStyles.background} ${inputStyles.border} ${inputStyles.focus} ${inputStyles.text} ${inputStyles.placeholder}`,
    error: `${inputStyles.base} ${inputStyles.background} ${inputStyles.error} ${inputStyles.focus} ${inputStyles.text} ${inputStyles.placeholder}`,
    success: `${inputStyles.base} ${inputStyles.background} ${inputStyles.success} ${inputStyles.focus} ${inputStyles.text} ${inputStyles.placeholder}`,
  };
  return states[state];
};

/**
 * Textarea styling
 */
export const getTextareaClassName = (
  state: 'normal' | 'error' | 'success' = 'normal'
): string => {
  const base = `${getInputClassName(state)} resize-none min-h-24`;
  return base;
};

/**
 * Select/dropdown styling
 */
export const getSelectClassName = (
  state: 'normal' | 'error' | 'success' = 'normal'
): string => {
  const base = `${getInputClassName(state)} appearance-none cursor-pointer pr-8`;
  return base;
};

// ============================================
// VALIDATION UTILITIES
// ============================================

/**
 * Validate question data
 */
export const validateQuestion = (question: QuestionData): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!question.text || !question.text.trim()) {
    errors.push('Question text is required');
  }

  if (!question.options || question.options.length !== 4) {
    errors.push('Question must have exactly 4 options');
  }

  if (question.options.some(opt => !opt || !opt.trim())) {
    errors.push('All options must be filled');
  }

  if (typeof question.correctAnswer !== 'number' || question.correctAnswer < 0 || question.correctAnswer > 3) {
    errors.push('Correct answer must be between 0 and 3');
  }

  if (!question.points || question.points <= 0) {
    errors.push('Points must be greater than 0');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Format errors for display
 */
export const formatErrorsForDisplay = (errors: string[]): string => {
  if (errors.length === 0) return '';
  if (errors.length === 1) return errors[0];
  return `${errors.length} errors: ${errors.slice(0, 3).join('; ')}${errors.length > 3 ? '...' : ''}`;
};
