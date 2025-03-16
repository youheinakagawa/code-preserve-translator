import { TranslationResult } from '@/types';

/**
 * 一意のIDを生成する
 * @returns 一意のID文字列
 */
export function generateUniqueId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

/**
 * 要素のセレクタパスを取得する
 * @param element DOM要素
 * @returns セレクタパス
 */
export function getElementSelector(element: Element): string {
  if (!element || element === document.body) {
    return 'body';
  }

  let path = '';
  let current = element;

  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();
    
    if (current.id) {
      selector += `#${current.id}`;
      return path ? `${selector} > ${path}` : selector;
    } else if (current.className) {
      const classes = Array.from(current.classList).join('.');
      if (classes) {
        selector += `.${classes}`;
      }
    }

    const siblings = Array.from(current.parentElement?.children || [])
      .filter(sibling => sibling.tagName === current.tagName);
    
    if (siblings.length > 1) {
      const index = siblings.indexOf(current) + 1;
      selector += `:nth-of-type(${index})`;
    }

    path = path ? `${selector} > ${path}` : selector;
    current = current.parentElement as Element;
  }

  return path;
}

/**
 * テキストがコードブロックかどうかを判定する
 * @param text 判定するテキスト
 * @returns コードブロックの場合はtrue
 */
export function isCodeBlock(text: string): boolean {
  // コードブロックの特徴を検出するヒューリスティック
  const codePatterns = [
    /^(const|let|var|function|class|import|export)\s+\w+/m, // JavaScript/TypeScript
    /^(def|class|import|from|if __name__)/m, // Python
    /^(public|private|protected|class|interface|enum)/m, // Java/C#
    /^(#include|int\s+main|void\s+main)/m, // C/C++
    /^(<\?php|namespace|use\s+[\w\\]+;)/m, // PHP
    /^(package\s+[\w.]+;|import\s+[\w.]+;)/m, // Java
    /^(<!DOCTYPE|<html|<head|<body|<script|<style)/m, // HTML/XML
    /^(@media|body\s*{|\.[\w-]+\s*{|#[\w-]+\s*{)/m, // CSS
  ];

  // コードの特徴的なパターンをチェック
  const hasCodePattern = codePatterns.some(pattern => pattern.test(text));
  
  // 行の大部分が特殊文字を含むかチェック
  const lines = text.split('\n');
  const specialCharRatio = lines.filter(line => 
    /[{}[\]()<>:;=+\-*/%&|^!~]/.test(line)
  ).length / lines.length;
  
  // インデントの一貫性をチェック
  const indentPattern = /^(\s+)\S/;
  const indents = lines
    .map(line => {
      const match = indentPattern.exec(line);
      return match ? match[1].length : 0;
    })
    .filter(indent => indent > 0);
  
  const hasConsistentIndent = indents.length > 0 && 
    new Set(indents).size < indents.length / 2;

  return hasCodePattern || (specialCharRatio > 0.3 && hasConsistentIndent);
}

/**
 * キャッシュが有効かどうかを確認する
 * @param result 翻訳結果
 * @param expirationMinutes キャッシュの有効期限（分）
 * @returns キャッシュが有効な場合はtrue
 */
export function isCacheValid(
  result: TranslationResult | undefined,
  expirationMinutes: number
): boolean {
  if (!result) return false;
  
  const now = Date.now();
  const expirationMs = expirationMinutes * 60 * 1000;
  return now - result.timestamp < expirationMs;
}

/**
 * テキストを適切なサイズのチャンクに分割する
 * @param text 分割するテキスト
 * @param maxChunkSize 最大チャンクサイズ
 * @returns テキストチャンクの配列
 */
export function splitTextIntoChunks(text: string, maxChunkSize: number = 4000): string[] {
  if (text.length <= maxChunkSize) {
    return [text];
  }

  const chunks: string[] = [];
  let currentChunk = '';
  
  // 段落または文で分割
  const paragraphs = text.split(/\n\s*\n/);
  
  for (const paragraph of paragraphs) {
    // 段落が最大サイズを超える場合は文で分割
    if (paragraph.length > maxChunkSize) {
      const sentences = paragraph.split(/(?<=[.!?])\s+/);
      
      for (const sentence of sentences) {
        // 文が最大サイズを超える場合はさらに分割
        if (sentence.length > maxChunkSize) {
          let remainingSentence = sentence;
          while (remainingSentence.length > 0) {
            const chunk = remainingSentence.substring(0, maxChunkSize);
            chunks.push(chunk);
            remainingSentence = remainingSentence.substring(maxChunkSize);
          }
        } else if (currentChunk.length + sentence.length > maxChunkSize) {
          chunks.push(currentChunk);
          currentChunk = sentence;
        } else {
          currentChunk += (currentChunk ? ' ' : '') + sentence;
        }
      }
    } else if (currentChunk.length + paragraph.length > maxChunkSize) {
      chunks.push(currentChunk);
      currentChunk = paragraph;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}
