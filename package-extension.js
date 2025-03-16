const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

// ZIPファイルの作成
const output = fs.createWriteStream(path.join(__dirname, 'code-preserve-translator.zip'));
const archive = archiver('zip', {
  zlib: { level: 9 } // 最大圧縮レベル
});

// エラーハンドリング
output.on('close', () => {
  console.log(`パッケージングが完了しました: ${archive.pointer()} バイト`);
  console.log('ZIPファイルが作成されました: code-preserve-translator.zip');
});

archive.on('error', (err) => {
  throw err;
});

// ZIPファイルにdistディレクトリの内容を追加
archive.pipe(output);
archive.directory(path.join(__dirname, 'dist'), false);

// 処理を開始
archive.finalize();
