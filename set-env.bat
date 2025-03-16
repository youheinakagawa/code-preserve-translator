@echo off
set OPENAI_API_KEY=%1
echo 環境変数OPENAI_API_KEYを設定しました: %OPENAI_API_KEY%
"C:\Program Files\Google\Chrome\Application\chrome.exe" --load-extension="%cd%\dist" --user-data-dir="%cd%\chrome-data"
