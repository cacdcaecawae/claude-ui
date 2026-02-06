'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import CodeBlock from './CodeBlock';
import type { Components } from 'react-markdown';

interface MarkdownRendererProps {
  content: string;
}

const components: Components = {
  code({ className, children, ...props }) {
    const isInline = !className && !String(children).includes('\n');
    return (
      <CodeBlock className={className} inline={isInline}>
        {children}
      </CodeBlock>
    );
  },
  a({ href, children, ...props }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
        {...props}
      >
        {children}
      </a>
    );
  },
  table({ children, ...props }) {
    return (
      <div className="overflow-x-auto my-3">
        <table className="min-w-full border-collapse border border-zinc-700" {...props}>
          {children}
        </table>
      </div>
    );
  },
  th({ children, ...props }) {
    return (
      <th className="border border-zinc-700 px-3 py-2 bg-zinc-800 text-left text-sm font-semibold" {...props}>
        {children}
      </th>
    );
  },
  td({ children, ...props }) {
    return (
      <td className="border border-zinc-700 px-3 py-2 text-sm" {...props}>
        {children}
      </td>
    );
  },
  blockquote({ children, ...props }) {
    return (
      <blockquote className="border-l-4 border-zinc-600 pl-4 my-3 text-zinc-400 italic" {...props}>
        {children}
      </blockquote>
    );
  },
  ul({ children, ...props }) {
    return (
      <ul className="list-disc list-inside my-2 space-y-1" {...props}>
        {children}
      </ul>
    );
  },
  ol({ children, ...props }) {
    return (
      <ol className="list-decimal list-inside my-2 space-y-1" {...props}>
        {children}
      </ol>
    );
  },
  hr(props) {
    return <hr className="my-4 border-zinc-700" {...props} />;
  },
  h1({ children, ...props }) {
    return <h1 className="text-xl font-bold mt-4 mb-2" {...props}>{children}</h1>;
  },
  h2({ children, ...props }) {
    return <h2 className="text-lg font-bold mt-4 mb-2" {...props}>{children}</h2>;
  },
  h3({ children, ...props }) {
    return <h3 className="text-base font-bold mt-3 mb-1" {...props}>{children}</h3>;
  },
  p({ children, ...props }) {
    return <p className="my-2 leading-relaxed" {...props}>{children}</p>;
  },
};

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="markdown-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
