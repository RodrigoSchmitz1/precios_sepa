# Instala la ingesta de SEPA en esta maquina y la programa en el Programador de
# tareas. Pensado para correrlo una vez en cada PC que haga la ingesta.
#
# POR QUE HAY DOS MAQUINAS (2026-09-24). El portal de SEPA solo acepta
# conexiones domesticas, asi que la ingesta corre en casa. Con una sola PC, el
# dia que estaba apagada no habia datos. Ahora hay dos: la de escritorio, que
# queda siempre prendida, a las 07:00, y la notebook de respaldo a las 10:00.
# Correr dos veces es seguro: ingesta_backfill.py calcula que fechas faltan en
# BigQuery y, si no falta ninguna, termina sin cargar nada. Las dos horas de
# diferencia importan: la ingesta tarda de 6 a 30 minutos, y dos maquinas
# cargando la MISMA fecha a la vez podrian mezclar la tabla intermedia de
# comercios y sucursales.
#
# USO (desde una consola de PowerShell, en la carpeta orquestacion\scripts):
#   .\instalar_ingesta.ps1 -Hora 07:00      # la PC principal
#   .\instalar_ingesta.ps1 -Hora 10:00      # la de respaldo
#
# Antes hay que copiar credenciales.json a esta carpeta A MANO (pendrive, disco
# compartido): es la clave de la service account y nunca va por git.
#
# La tarea queda como "Ejecutar tanto si el usuario inicio sesion como si no",
# sin guardar la contrasena (S4U). Asi corre aunque Windows Update haya
# reiniciado la PC de noche y nadie haya entrado a su usuario. S4U alcanza: la
# ingesta solo baja archivos de internet y lee archivos de esta PC.

param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern("^\d{2}:\d{2}$")]
    [string]$Hora,
    [string]$NombreTarea = "Ingesta SEPA"
)

$ErrorActionPreference = "Stop"
$raiz = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $raiz

Write-Host "1/4 Credenciales"
if (-not (Test-Path (Join-Path $raiz "credenciales.json"))) {
    throw "Falta credenciales.json en $raiz. Copialo a mano desde la otra PC (no va por git) y volve a correr este script."
}

Write-Host "2/4 Entorno de Python"
$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) { throw "No encuentro Python. Instala Python 3.12 o superior (python.org) y volve a correr." }
if (-not (Test-Path (Join-Path $raiz "venv\Scripts\python.exe"))) {
    & python -m venv (Join-Path $raiz "venv")
}
& (Join-Path $raiz "venv\Scripts\python.exe") -m pip install --quiet --upgrade pip
& (Join-Path $raiz "venv\Scripts\python.exe") -m pip install --quiet -r (Join-Path $raiz "..\requirements.txt")

Write-Host "3/4 Prueba: que fechas faltan (no descarga ni carga nada)"
& (Join-Path $raiz "venv\Scripts\python.exe") (Join-Path $raiz "ingesta_backfill.py") --simular
if ($LASTEXITCODE -ne 0) { throw "La prueba contra BigQuery fallo: revisa credenciales.json y la conexion." }

Write-Host "4/4 Tarea programada '$NombreTarea' todos los dias a las $Hora (con reintentos cada 2 horas)"
$script = Join-Path $raiz "ingesta_local.ps1"
$accion = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script`""
$disparador = New-ScheduledTaskTrigger -Daily -At $Hora
# REINTENTOS: cada 2 horas durante 10 horas despues de la hora elegida. El
# 2026-09-26 el portal de SEPA no respondio a la hora de la ingesta y, con una
# sola corrida por dia, ese dia se perdia hasta el siguiente. Reintentar es
# gratis: si no falta ninguna fecha, ingesta_backfill.py lo sabe leyendo la
# lista de particiones (metadata, sin cuota) y termina en segundos. Tambien
# levanta el dia que SEPA publica tarde. Si una corrida sigue en curso cuando
# toca la siguiente, el Programador de tareas no arranca otra.
# (PowerShell 5.1 no deja pedir repeticion en un disparador diario: se copia la
# de uno de una sola vez, que es la forma documentada de hacerlo.)
$disparador.Repetition = (New-ScheduledTaskTrigger -Once -At $Hora `
    -RepetitionInterval (New-TimeSpan -Hours 2) -RepetitionDuration (New-TimeSpan -Hours 10)).Repetition
# StartWhenAvailable: si a esa hora estaba apagada, corre apenas se prenda.
# WakeToRun: si estaba suspendida, la despierta (con los temporizadores de
# reactivacion permitidos en el plan de energia, que en Windows vienen
# habilitados con la PC enchufada).
$opciones = New-ScheduledTaskSettingsSet -StartWhenAvailable -WakeToRun `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 3)
$usuario = "$env:USERDOMAIN\$env:USERNAME"
$principal = New-ScheduledTaskPrincipal -UserId $usuario -LogonType S4U -RunLevel Limited
Register-ScheduledTask -TaskName $NombreTarea -Action $accion -Trigger $disparador `
    -Settings $opciones -Principal $principal -Force | Out-Null

Write-Host ""
Write-Host "Listo. Para probarla ahora:  schtasks /run /tn `"$NombreTarea`""
Write-Host "Para ver como le fue:        Get-Content $raiz\logs\ingesta_$(Get-Date -Format 'yyyy-MM-dd').log"

