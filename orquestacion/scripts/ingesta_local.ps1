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
# Para instalarla en una PC nueva y registrar la tarea: instalar_ingesta.ps1
# (crea el entorno, prueba la conexion y programa la tarea). Desde el
# 2026-09-24 corre en dos maquinas: la de escritorio a las 07:00 y la notebook
# de respaldo a las 10:00; la segunda no hace nada si la primera ya cargo.
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
# Sin esto el log sale desordenado y se lee mal justo cuando mas importa. Al
# mandar la salida a un pipe, Python pasa a buffer de bloque: los prints del
# script padre quedan retenidos hasta el final, mientras descargar_sepa.py y
# cargar_datos.py (procesos hijos, que escriben y terminan) salen enseguida. El
# resultado es un log donde la descarga de una fecha aparece ANTES del resumen
# que decidio bajarla. El log del 2026-09-22 se leia asi y hubo que reconstruir
# el orden real a mano para entender que habia pasado.
#
# Va como variable de entorno y no como -u porque los hijos se lanzan con
# sys.executable, que no hereda los flags de linea de comandos; el entorno si.
$env:PYTHONUNBUFFERED = "1"

& "$raiz\venv\Scripts\python.exe" "$raiz\ingesta_backfill.py" 2>&1 |
    ForEach-Object {
        Write-Output $_
        Add-Content -Path $log -Value $_ -Encoding utf8
    }

$codigo = $LASTEXITCODE
"=== Fin (exit $codigo) ===" | Add-Content -Path $log -Encoding utf8
exit $codigo
