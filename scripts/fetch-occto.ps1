param([string]$Date='2026/09/20',[ValidateSet('01','02','03','04','05','06','07','08','09','10')][string]$Area='02',[string]$OutputDir='',[switch]$AllowEmptyCapacity)
# 旧版・比較用（2026-10-31 に scripts/fetch-occto.mjs へ置き換え。どこからも呼ばない）
# -AllowEmptyCapacity：運用容量だけ「該当データが存在しません」（OCCTO側の未公表。2026-10-09 北陸で発生）のときは止めずに、その応答を保存して実績を使えるようにする
$ErrorActionPreference='Stop'
$taskSession=New-Object Microsoft.PowerShell.Commands.WebRequestSession
$taskBase='https://occtonet3.occto.or.jp/public/dfw/RP11/OCCTO/'
$taskDir=if($OutputDir){$OutputDir}else{'data/raw/occto-'+$Date.Replace('/','-')}
New-Item -ItemType Directory -Force $taskDir | Out-Null
Invoke-WebRequest -Uri ($taskBase+'SD/LOGIN_login') -WebSession $taskSession -OutFile ('tmp/occto-'+$Area+'-login.html')
foreach($taskKind in @('actual','capacity')) {
 $taskCode=if($taskKind -eq 'actual'){'CB01S020'}else{'CB01S010'}
 Invoke-WebRequest -Uri ($taskBase+'SD/'+$taskCode+'C?fwExtention.pathInfo='+$taskCode+'C&fwExtention.prgbrh=0') -Method Post -WebSession $taskSession -Body @{'fwExtention.pathInfo'='MENU'} -OutFile ('tmp/occto-'+$Area+'-'+$taskKind+'-form.html')
 $taskParams=@{'fwExtention.pathInfo'=($taskCode+'C');'fwExtention.prgbrh'='0';'fwExtention.formId'=($taskCode+'P');'fwExtention.actionType'='reference';'fwExtention.actionSubType'='headerInput';'transitionContextKey'='DEFAULT';'tgtNngp'=$Date;'areaCdAreaSumNon'=$Area;'daPtn'='00';'table1.dispRowNum'='100';'table1.startIndex'='0'}
 if($taskKind -eq 'capacity'){$taskParams['ysuFlowDnmCd']='7';$taskParams['dispKouhyoData']='2'}
 $taskFile=Join-Path $taskDir ($taskKind+'.json')
 Invoke-WebRequest -Uri ($taskBase+'SD/'+$taskCode+'C') -Method Post -WebSession $taskSession -Headers @{'X-Requested-With'='XMLHttpRequest'} -Body $taskParams -OutFile $taskFile
 $taskData=Get-Content $taskFile -Raw -Encoding UTF8 | ConvertFrom-Json
 if($AllowEmptyCapacity -and $taskKind -eq 'capacity' -and $taskData.root.errMessage.msgId -eq 'YA000010SW'){Write-Output 'capacity: not published (YA000010SW)';@{url=($taskBase+'SD/'+$taskCode+'C');date=$Date;area=$Area;retrievedAt=[DateTime]::UtcNow.ToString('o');format='public search response: no data'} | ConvertTo-Json | Set-Content ($taskFile+'.source.json') -Encoding UTF8;continue}
 if($taskData.root.errMessage -or [int]$taskData.root.bizRoot.table.table1.table1.totalPage -gt 1 -or !$taskData.root.bizRoot.table.table1.table1.rows){throw 'Incomplete or failed OCCTO response'}
 @{url=($taskBase+'SD/'+$taskCode+'C');date=$Date;area=$Area;retrievedAt=[DateTime]::UtcNow.ToString('o');sha256=([BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash([IO.File]::ReadAllBytes((Join-Path (Get-Location) $taskFile)))).Replace('-',''));format='public search response (same table as CSV)'} | ConvertTo-Json | Set-Content ($taskFile+'.source.json') -Encoding UTF8
 Write-Output ($taskKind+': '+$taskData.root.bizRoot.table.table1.table1.rows.Count+' rows')
}
