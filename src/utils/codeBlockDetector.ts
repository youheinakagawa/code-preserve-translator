import { CodeBlockInfo } from '@/types';
import { generateUniqueId, getElementSelector, isCodeBlock } from './helpers';

/**
 * コードブロック検出クラス
 */
export class CodeBlockDetector {
  /**
   * ページ内のコードブロックを検出する
   * @returns 検出されたコードブロック情報の配列
   */
  detectCodeBlocks(): CodeBlockInfo[] {
    const codeBlocks: CodeBlockInfo[] = [];
    
    // 一般的なコードブロック要素のセレクタ
    const codeSelectors = [
      'pre code',
      'pre.code',
      'pre.prettyprint',
      'pre.highlight',
      'div.highlight pre',
      'div.code pre',
      'div.sourceCode pre',
      '.codeBlock',
      '.code-block',
      '.hljs',
      '.CodeMirror',
      '.prism-code',
      'code.language-*',
      'code.lang-*'
    ];
    
    // セレクタに一致する要素を検索
    const codeElements = document.querySelectorAll(codeSelectors.join(', '));
    
    codeElements.forEach((element) => {
      const content = element.textContent || '';
      
      // 空のコードブロックはスキップ
      if (!content.trim()) {
        return;
      }
      
      // 言語の検出を試みる
      let language: string | undefined;
      
      // クラス名から言語を検出
      const classNames = Array.from(element.classList);
      for (const className of classNames) {
        if (className.startsWith('language-')) {
          language = className.replace('language-', '');
          break;
        } else if (className.startsWith('lang-')) {
          language = className.replace('lang-', '');
          break;
        }
      }
      
      // 親要素のクラス名から言語を検出
      if (!language && element.parentElement) {
        const parentClassNames = Array.from(element.parentElement.classList);
        for (const className of parentClassNames) {
          if (className.startsWith('language-')) {
            language = className.replace('language-', '');
            break;
          } else if (className.startsWith('lang-')) {
            language = className.replace('lang-', '');
            break;
          }
        }
      }
      
      codeBlocks.push({
        id: generateUniqueId(),
        content,
        language,
        position: {
          parentSelector: getElementSelector(element.parentElement || document.body),
          index: Array.from(element.parentElement?.children || []).indexOf(element as Element)
        }
      });
    });
    
    // コードブロックとして明示的にマークされていない潜在的なコードブロックを検出
    const textElements = document.querySelectorAll('p, div, section, article');
    
    textElements.forEach((element) => {
      // すでに検出されたコードブロック内の要素はスキップ
      if (codeElements.length > 0 && Array.from(codeElements).some(codeEl => 
        codeEl.contains(element) || element.contains(codeEl)
      )) {
        return;
      }
      
      const content = element.textContent || '';
      
      // 短すぎるテキストはスキップ
      if (content.length < 50) {
        return;
      }
      
      // コードブロックの特徴を持つテキストを検出
      if (isCodeBlock(content)) {
        codeBlocks.push({
          id: generateUniqueId(),
          content,
          position: {
            parentSelector: getElementSelector(element.parentElement || document.body),
            index: Array.from(element.parentElement?.children || []).indexOf(element as Element)
          }
        });
      }
    });
    
    return codeBlocks;
  }

  /**
   * コードブロックの言語を検出する
   * @param code コードブロックの内容
   * @returns 検出された言語、または検出できない場合はundefined
   */
  detectLanguage(code: string): string | undefined {
    // 言語の特徴的なパターン
    const languagePatterns: Record<string, RegExp[]> = {
      javascript: [
        /^(const|let|var|function|class|import|export)\s+\w+/m,
        /\b(document|window|console)\.\w+\(/m,
        /\b(setTimeout|setInterval|Promise|async|await)\b/m
      ],
      typescript: [
        /^(interface|type|enum)\s+\w+/m,
        /:\s*(string|number|boolean|any|void|never)\b/m,
        /<[A-Z]\w+>/m
      ],
      python: [
        /^(def|class|import|from|if __name__)/m,
        /\b(self|None|True|False)\b/m,
        /\s{4}def\s+\w+\(/m
      ],
      java: [
        /^(public|private|protected)\s+(class|interface|enum)/m,
        /\b(extends|implements|@Override)\b/m,
        /System\.out\.println\(/m
      ],
      csharp: [
        /^(using\s+[\w.]+;|namespace\s+[\w.]+)/m,
        /\b(public|private|protected)\s+(class|interface|enum|struct)\b/m,
        /Console\.WriteLine\(/m
      ],
      php: [
        /^(<\?php|\?>)/m,
        /\$(this|_GET|_POST|_SESSION|_COOKIE)/m,
        /\b(echo|print|require|include)\b/m
      ],
      html: [
        /^<!DOCTYPE\s+html>/i,
        /<html[^>]*>/i,
        /<(head|body|div|span|p|a|img|script|link|meta)[^>]*>/m
      ],
      css: [
        /^(\.|#|\*)[^{]+\{/m,
        /\b(margin|padding|border|color|background|font|display)\s*:/m,
        /@media\s+/m
      ],
      ruby: [
        /^(def|class|module|require|include)\b/m,
        /\b(attr_accessor|attr_reader|attr_writer)\b/m,
        /\bdo\s+\|\w+\|\s+/m
      ],
      go: [
        /^(package|import|func|type|struct)\b/m,
        /\b(fmt|go|chan|defer|goroutine)\b/m,
        /\b(nil|make|new|map|slice)\b/m
      ],
      rust: [
        /^(fn|struct|enum|impl|trait|let|mut|pub)\b/m,
        /\b(Option|Result|Some|None|Ok|Err)\b/m,
        /\b(match|if let|while let)\b/m
      ],
      swift: [
        /^(import|class|struct|enum|protocol|extension)\b/m,
        /\b(var|let|func|guard|if let|optional)\b/m,
        /\b(UIViewController|UIView|SwiftUI)\b/m
      ],
      kotlin: [
        /^(fun|class|interface|object|val|var|package|import)\b/m,
        /\b(override|lateinit|companion|suspend)\b/m,
        /\b(null|Unit|Any|String|Int|Boolean)\b/m
      ]
    };

    // 各言語のパターンに対するマッチ数をカウント
    const scores: Record<string, number> = {};
    
    for (const [language, patterns] of Object.entries(languagePatterns)) {
      scores[language] = patterns.filter(pattern => pattern.test(code)).length;
    }
    
    // 最高スコアの言語を取得
    const maxScore = Math.max(...Object.values(scores));
    
    // スコアが低すぎる場合は言語を特定できないと判断
    if (maxScore < 2) {
      return undefined;
    }
    
    // 最高スコアの言語を返す
    for (const [language, score] of Object.entries(scores)) {
      if (score === maxScore) {
        return language;
      }
    }
    
    return undefined;
  }

  /**
   * コードブロックにマーカーを追加する
   * @param codeBlocks コードブロック情報の配列
   */
  markCodeBlocks(codeBlocks: CodeBlockInfo[]): void {
    codeBlocks.forEach(block => {
      try {
        const parent = document.querySelector(block.position.parentSelector);
        if (!parent) return;
        
        const children = Array.from(parent.children);
        const element = children[block.position.index];
        
        if (element) {
          // データ属性を追加してコードブロックとしてマーク
          element.setAttribute('data-code-block-id', block.id);
          element.setAttribute('data-code-block', 'true');
          
          if (block.language) {
            element.setAttribute('data-code-language', block.language);
          }
        }
      } catch (error) {
        console.error('コードブロックのマーキングに失敗しました:', error);
      }
    });
  }
}

// シングルトンインスタンスをエクスポート
export const codeBlockDetector = new CodeBlockDetector();
