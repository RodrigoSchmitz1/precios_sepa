# Ingesta diaria de SEPA, para correr desde el Programador de tareas de Windows.
#
# Este paso corre local y no en la nube porque el portal de SEPA responde 403 a
# los rangos de IP de GitHub Actions y de Google (verificado el 2026-09-06).
# La conexion de casa es la unica que el portal acepta, asi que la descarga y la
# carga del crudo viven aca; la transformacion (dbt) corre en GitHub Actions.
#
# Es auto-reparable: si un dia la maquina esta apagada, la corrida siguiente
# detecta la fecha faltante y la recupera sola, mientras siga dentro de la
# ventana que retiene el crudo.
#
# Para registrar la tarea (una sola vez, desde una consola como administrador):
#
#   schtasks /create /tn "Ingesta SEPA" /sc daily /st 07:00 /tr "powershell -NoProfile -ExecutionPolicy Bypass -File C:\Users\rschmitz\Desktop\precios_sepa\orquestacion\scripts\ingesta_local.ps1"
#
# Para probarla a mano:  schtasks /run /tn "Ingesta SEPA"
# Para ver como le fue:  schtasks /query /tn "Ingesta SEPA" /v /fo list

$raiz = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $raiz

$carpetaLog = Join-Path $raiz "logs"
if (-not (Test-Path $carpetaLog)) { New-Item -ItemType Directory -Path $carpetaLog | Out-Null }
$log = Join-Path $carpetaLog ("ingesta_" + (Get-Date -Format "yyyy-MM-dd") + ".log")

"=== Corrida $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ===" | Add-Content -Path $log -Encoding utf8

& "$raiz\venv\Scripts\python.exe" "$raiz\ingesta_backfill.py" 2>&1 |
    Tee-Object -FilePath $log -Append

$codigo = $LASTEXITCODE
"=== Fin (exit $codigo) ===" | Add-Content -Path $log -Encoding utf8
exit $codigo
