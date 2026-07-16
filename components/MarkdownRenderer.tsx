import React from 'react';

interface Props {
  content: string;
  isDark?: boolean;
}

export const MarkdownRenderer: React.FC<Props> = ({ content, isDark = false }) => {
  if (!content) return null;
  const lines = content.split('\n');

  const renderTextWithBold = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const style = isDark 
          ? "font-bold text-white bg-white/20 px-1 rounded"
          : "font-bold text-indigo-900 bg-indigo-50 px-1 rounded";
        return <strong key={index} className={style}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  const containerClass = isDark ? "text-white" : "text-slate-700";
  const h3Class = isDark 
    ? "text-xl font-bold text-white mt-6 mb-2 border-l-4 border-white/50 pl-3" 
    : "text-xl font-bold text-slate-800 mt-6 mb-2 border-l-4 border-blue-500 pl-3";
  const h2Class = isDark
    ? "text-2xl font-extrabold text-white mt-8 mb-4 pb-2 border-b border-white/30"
    : "text-2xl font-extrabold text-slate-900 mt-8 mb-4 pb-2 border-b border-slate-200";
  const bulletClass = isDark ? "text-white/80" : "text-blue-500";

  return (
    <div className={`space-y-4 leading-relaxed ${containerClass}`}>
      {lines.map((line, index) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('### ')) {
          return <h3 key={index} className={h3Class}>{trimmed.replace('### ', '')}</h3>;
        }
        if (trimmed.startsWith('## ')) {
          return <h2 key={index} className={h2Class}>{trimmed.replace('## ', '')}</h2>;
        }
        if (trimmed.startsWith('- ')) {
          return (
            <div key={index} className="flex gap-2 ml-1 mb-2">
              <span className={`${bulletClass} font-bold`}>•</span>
              <span className="flex-1">{renderTextWithBold(trimmed.replace('- ', ''))}</span>
            </div>
          );
        }
        if (trimmed === '') return <div key={index} className="h-2" />;
        return <p key={index}>{renderTextWithBold(line)}</p>;
      })}
    </div>
  );
};