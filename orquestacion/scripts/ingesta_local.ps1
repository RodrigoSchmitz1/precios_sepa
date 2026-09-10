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
#   schtasks /create /tn "Ingesta SEPA" /sc daily /st 07:00 /tr "powershell -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File C:\Users\rschmitz\Desktop\precios_sepa\orquestacion\scripts\ingesta_local.ps1"
#
# -WindowStyle Hidden no es cosmetico. La tarea corre en la sesion del usuario y
# antes abria una consola visible al iniciar sesion: el 2026-09-10 esa ventana se
# cerro a los pocos segundos y la ingesta murio con 0xC000013A sin cargar nada.
# Se probo conhost --headless, que tambien oculta, pero devuelve siempre 0 y el
# Programador de tareas dejaria de mostrar las fallas.
#
# Para probarla a mano:  schtasks /run /tn "Ingesta SEPA"
# Para ver como le fue:  schtasks /query /tn "Ingesta SEPA" /v /fo list

$raiz = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $raiz

$carpetaLog = Join-Path $raiz "logs"
if (-not (Test-Path $carpetaLog)) { New-Item -ItemType Directory -Path $carpetaLog | Out-Null }
$log = Join-Path $carpetaLog ("ingesta_" + (Get-Date -Format "yyyy-MM-dd") + ".log")

"=== Corrida $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ===" | Add-Content -Path $log -Encoding utf8

# No se usa Tee-Object: en Windows PowerShell 5.1 escribe UTF-16 y el archivo
# quedaba con la cabecera en UTF-8 y el cuerpo en UTF-16, ilegible con cualquier
# herramienta que no adivine el encoding. Este ForEach hace lo mismo (muestra en
# consola y agrega al log) forzando UTF-8 en las dos puntas.
& "$raiz\venv\Scripts\python.exe" "$raiz\ingesta_backfill.py" 2>&1 |
    ForEach-Object {
        Write-Output $_
        Add-Content -Path $log -Value $_ -Encoding utf8
    }

$codigo = $LASTEXITCODE
"=== Fin (exit $codigo) ===" | Add-Content -Path $log -Encoding utf8
exit $codigo
