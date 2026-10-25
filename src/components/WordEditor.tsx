import React, { useRef, useEffect, useState } from 'react';
import { 
  Bold, 
  Italic, 
  Underline, 
  Strikethrough, 
  Heading1, 
  Heading2, 
  List, 
  ListOrdered, 
  Quote, 
  Code, 
  Undo, 
  Redo, 
  Eraser, 
  Eye, 
  Edit3
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface WordEditorProps {
  value: string;
  onChange: (htmlContent: string) => void;
  label?: string;
  placeholder?: string;
  minHeight?: string;
}

export function WordEditor({ 
  value, 
  onChange, 
  label,
  placeholder,
  minHeight = '180px' 
}: WordEditorProps) {
  const { language, t, dir } = useLanguage();
  const defaultPlaceholder = language === 'ar' 
    ? 'أدخل الوصف التفصيلي للبلاغ، رسائل الخطأ، أو تعليمات الطلب...'
    : 'Type detailed ticket description, error messages, or request instructions...';

  const actualPlaceholder = placeholder || defaultPlaceholder;
  const editorRef = useRef<HTMLDivElement>(null);
  const [isPreview, setIsPreview] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);

  // Sync initial or external value if editor is empty
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      // only update if truly different to avoid cursor jumps
      if (document.activeElement !== editorRef.current) {
        editorRef.current.innerHTML = value || '';
        updateStats(value || '');
      }
    }
  }, [value]);

  const updateStats = (textHtml: string) => {
    const textOnly = textHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    setCharCount(textOnly.length);
    setWordCount(textOnly ? textOnly.split(' ').filter(Boolean).length : 0);
  };

  const handleInput = () => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      onChange(html);
      updateStats(html);
    }
  };

  const executeCommand = (command: string, value: string | undefined = undefined) => {
    if (isPreview) return;
    if (editorRef.current) {
      editorRef.current.focus();
    }
    document.execCommand(command, false, value);
    handleInput();
  };

  const insertHeading = (level: 'h1' | 'h2' | 'p') => {
    executeCommand('formatBlock', level);
  };

  const clearFormatting = () => {
    executeCommand('removeFormat');
  };

  return (
    <div dir={dir} className="border border-slate-300 rounded-xl overflow-hidden bg-white shadow-xs focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition">
      
      {/* Editor Toolbar - Word Style */}
      <div className="bg-slate-50 border-b border-slate-200 px-3 py-1.5 flex flex-wrap items-center gap-1 text-slate-700 select-none">
        
        {/* Undo / Redo */}
        <div className="flex items-center space-x-0.5 border-r border-slate-300 pr-1.5 mr-1">
          <button
            type="button"
            onClick={() => executeCommand('undo')}
            className="p-1.5 rounded hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition"
            title={language === 'ar' ? 'تراجع (Ctrl+Z)' : 'Undo (Ctrl+Z)'}
          >
            <Undo className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => executeCommand('redo')}
            className="p-1.5 rounded hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition"
            title={language === 'ar' ? 'إعادة (Ctrl+Y)' : 'Redo (Ctrl+Y)'}
          >
            <Redo className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Headings / Block */}
        <div className="flex items-center space-x-0.5 border-r border-slate-300 pr-1.5 mr-1">
          <button
            type="button"
            onClick={() => insertHeading('h1')}
            className="px-1.5 py-1 rounded text-xs font-bold hover:bg-slate-200 text-slate-700 transition"
            title={language === 'ar' ? 'عنوان رئيسي H1' : 'Heading 1'}
          >
            H1
          </button>
          <button
            type="button"
            onClick={() => insertHeading('h2')}
            className="px-1.5 py-1 rounded text-xs font-bold hover:bg-slate-200 text-slate-700 transition"
            title={language === 'ar' ? 'عنوان فرعي H2' : 'Heading 2'}
          >
            H2
          </button>
          <button
            type="button"
            onClick={() => insertHeading('p')}
            className="px-1.5 py-1 rounded text-xs font-medium hover:bg-slate-200 text-slate-700 transition"
            title={language === 'ar' ? 'نص عادي (فقرة)' : 'Normal text / Paragraph'}
          >
            ¶
          </button>
        </div>

        {/* Text Style: Bold, Italic, Underline, Strikethrough */}
        <div className="flex items-center space-x-0.5 border-r border-slate-300 pr-1.5 mr-1">
          <button
            type="button"
            onClick={() => executeCommand('bold')}
            className="p-1.5 rounded hover:bg-slate-200 text-slate-700 hover:text-slate-900 transition"
            title={language === 'ar' ? 'خط عريض (Ctrl+B)' : 'Bold (Ctrl+B)'}
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => executeCommand('italic')}
            className="p-1.5 rounded hover:bg-slate-200 text-slate-700 hover:text-slate-900 transition"
            title={language === 'ar' ? 'خط مائل (Ctrl+I)' : 'Italic (Ctrl+I)'}
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => executeCommand('underline')}
            className="p-1.5 rounded hover:bg-slate-200 text-slate-700 hover:text-slate-900 transition"
            title={language === 'ar' ? 'تسطير (Ctrl+U)' : 'Underline (Ctrl+U)'}
          >
            <Underline className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => executeCommand('strikeThrough')}
            className="p-1.5 rounded hover:bg-slate-200 text-slate-700 hover:text-slate-900 transition"
            title={language === 'ar' ? 'شطب النص' : 'Strikethrough'}
          >
            <Strikethrough className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Lists & Quotes */}
        <div className="flex items-center space-x-0.5 border-r border-slate-300 pr-1.5 mr-1">
          <button
            type="button"
            onClick={() => executeCommand('insertUnorderedList')}
            className="p-1.5 rounded hover:bg-slate-200 text-slate-700 hover:text-slate-900 transition"
            title={language === 'ar' ? 'قائمة نقطية' : 'Bullet List'}
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => executeCommand('insertOrderedList')}
            className="p-1.5 rounded hover:bg-slate-200 text-slate-700 hover:text-slate-900 transition"
            title={language === 'ar' ? 'قائمة مرقمة' : 'Numbered List'}
          >
            <ListOrdered className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => executeCommand('formatBlock', 'blockquote')}
            className="p-1.5 rounded hover:bg-slate-200 text-slate-700 hover:text-slate-900 transition"
            title={language === 'ar' ? 'اقتباس' : 'Quote / Callout'}
          >
            <Quote className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => executeCommand('formatBlock', 'pre')}
            className="p-1.5 rounded hover:bg-slate-200 text-slate-700 hover:text-slate-900 transition"
            title={language === 'ar' ? 'كتلة برمجية' : 'Code Block'}
          >
            <Code className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Clear & View toggle */}
        <div className="flex items-center space-x-1 ml-auto">
          <button
            type="button"
            onClick={clearFormatting}
            className="p-1.5 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition"
            title={language === 'ar' ? 'مسح التنسيقات' : 'Clear Formatting'}
          >
            <Eraser className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setIsPreview(!isPreview)}
            className={`flex items-center space-x-1 px-2 py-1 rounded text-xs font-semibold transition ${
              isPreview 
                ? 'bg-blue-100 text-blue-800 border border-blue-300' 
                : 'hover:bg-slate-200 text-slate-600'
            }`}
            title={language === 'ar' ? 'معاينة النتيجة المنسقة' : 'Toggle Live Render Preview'}
          >
            {isPreview ? <Edit3 className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            <span className="hidden sm:inline">
              {isPreview ? (language === 'ar' ? 'تحرير' : 'Edit') : (language === 'ar' ? 'معاينة' : 'Preview')}
            </span>
          </button>
        </div>
      </div>

      {/* Editor Content Area */}
      <div className="relative">
        {isPreview ? (
          <div 
            className="p-3.5 text-sm text-slate-800 bg-slate-50/50 overflow-y-auto leading-relaxed prose prose-sm max-w-none min-h-[160px]"
            style={{ minHeight }}
            dangerouslySetInnerHTML={{ __html: value || `<em class="text-slate-400">${language === 'ar' ? 'لا يوجد محتوى مكتوب' : 'Empty description'}</em>` }}
          />
        ) : (
          <div
            ref={editorRef}
            contentEditable
            onInput={handleInput}
            onBlur={handleInput}
            data-placeholder={actualPlaceholder}
            className="p-3.5 text-sm text-slate-800 outline-none overflow-y-auto leading-relaxed focus:bg-white transition min-h-[160px] empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400 empty:before:pointer-events-none [&_h1]:text-lg [&_h1]:font-bold [&_h1]:mb-1 [&_h2]:text-base [&_h2]:font-bold [&_h2]:mb-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:border-l-4 [&_blockquote]:border-blue-400 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-slate-600 [&_pre]:bg-slate-100 [&_pre]:p-2 [&_pre]:rounded [&_pre]:font-mono [&_pre]:text-xs"
            style={{ minHeight }}
          />
        )}
      </div>

      {/* Status Bar: Word / Char Count */}
      <div className="bg-slate-50/90 border-t border-slate-200 px-3 py-1 flex items-center justify-between text-[11px] text-slate-500 font-mono">
        <div className="flex items-center space-x-3">
          <span>{language === 'ar' ? 'الكلمات:' : 'Words:'} <strong>{wordCount}</strong></span>
          <span>{language === 'ar' ? 'الحروف:' : 'Characters:'} <strong>{charCount}</strong></span>
        </div>
        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-sans">
          {language === 'ar' ? 'محرر وورد متقدم' : 'Rich Word Editor'}
        </span>
      </div>

    </div>
  );
}
