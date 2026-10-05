$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Set-Location -LiteralPath $projectRoot
$envFile = Join-Path $projectRoot '.env.local'
$utf8 = New-Object System.Text.UTF8Encoding($false)
Write-Host '请粘贴百炼 API Key（输入隐藏；按 Enter 确认）。' -ForegroundColor Cyan
Write-Host '密钥只保存到本项目 .env.local，不会显示在日志或发送到聊天。'
$protectedKey = Read-Host 'DASHSCOPE_API_KEY' -AsSecureString
$keyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($protectedKey)
try {
  $apiKeyValue = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($keyPointer)
  if ($apiKeyValue -notmatch '^\S{8,512}$') { throw 'Key 格式不正确，请重新运行脚本。' }
  $existingLines = if (Test-Path -LiteralPath $envFile) { [IO.File]::ReadAllLines($envFile) } else { @() }
  $preservedLines = @($existingLines | Where-Object { $_ -notmatch '^\s*DASHSCOPE_API_KEY\s*=' })
  [IO.File]::WriteAllLines($envFile, @($preservedLines + "DASHSCOPE_API_KEY=$apiKeyValue"), $utf8)
  $env:DASHSCOPE_API_KEY = $apiKeyValue
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($keyPointer)
  $apiKeyValue = $null
  $protectedKey.Dispose()
}
& node scripts/check-bailian.mjs
if ($LASTEXITCODE -ne 0) { throw '密钥已保存在本地，但接口尚未验证通过。修正配置后再运行。' }
$backendConnection = Get-NetTCPConnection -LocalPort 8788 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($backendConnection) {
  $serverProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $($backendConnection.OwningProcess)"
  if ($serverProcess.CommandLine -notmatch 'node(?:\.exe)?"?\s+server/index\.mjs\s*$') { throw '8788 端口由其他程序占用，请先处理端口冲突。' }
  Stop-Process -Id $backendConnection.OwningProcess
}
$nodePath = (Get-Command node).Source
$logDir = Join-Path $projectRoot 'output'
[IO.Directory]::CreateDirectory($logDir) | Out-Null
Start-Process -FilePath $nodePath -ArgumentList 'server/index.mjs' -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDir 'server-life.log') -RedirectStandardError (Join-Path $logDir 'server-life-error.log')
$frontendConnection = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $frontendConnection) {
  Start-Process -FilePath $nodePath -ArgumentList 'node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173 --strictPort' -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDir 'frontend.log') -RedirectStandardError (Join-Path $logDir 'frontend-error.log')
}
$ready = $false
for ($attempt = 0; $attempt -lt 40; $attempt++) {
  try { $health = Invoke-RestMethod 'http://127.0.0.1:8788/api/health' -TimeoutSec 2; if ($health.llm.configured) { $ready = $true; break } } catch {}
  Start-Sleep -Milliseconds 250
}
if (-not $ready) { throw '服务未就绪，请查看 output/server-life-error.log。' }
Write-Host '游戏已启动，百炼已启用。http://127.0.0.1:5173/' -ForegroundColor Green
Start-Process 'http://127.0.0.1:5173/'
