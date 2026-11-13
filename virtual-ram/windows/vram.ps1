# vram.ps1 — gestore di RAM virtuale per Windows 10/11
#
# Equivalenti Windows di vram.sh:
#   file di paging        = swapfile   (memoria extra su disco)
#   compressione memoria  = zram       (RAM compressa, già integrata in Windows)
#   ramdisk (ImDisk)      = tmpfs      (cartella/unità che vive in RAM)
#   esegui                = tetto di RAM per un progetto (Job Object di Windows)
#   wsl                   = memoria e swap della VM di WSL2
#
# Uso:  .\vram.bat <comando> [argomenti]      oppure   .\vram.ps1 aiuto
# Compatibile con Windows PowerShell 5.1 e PowerShell 7.

$ErrorActionPreference = 'Stop'

# ---------------- utilità ----------------
function Ok($m)   { Write-Host "[OK] $m" -ForegroundColor Green }
function Info($m) { Write-Host "-> $m" -ForegroundColor Cyan }
function Warn($m) { Write-Host "[!] $m" -ForegroundColor Yellow }
function Fail($m) { Write-Host "[X] $m" -ForegroundColor Red; exit 1 }

function Test-Admin {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    (New-Object Security.Principal.WindowsPrincipal($id)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# Se serve l'amministratore, riapre lo script in una finestra elevata con gli stessi argomenti
function Require-Admin([string[]]$originalArgs) {
    if (Test-Admin) { return }
    Info "Servono i permessi di amministratore: confermo la richiesta di Windows (UAC)..."
    $exe = (Get-Process -Id $PID).Path
    $argList = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-NoExit', '-File', "`"$PSCommandPath`"") +
               ($originalArgs | ForEach-Object { "`"$_`"" })
    Start-Process -FilePath $exe -Verb RunAs -ArgumentList $argList
    exit 0
}

function To-GB([string]$v, [string]$nome) {
    $n = 0.0
    $v = "$v" -replace '(?i)\s*gb?$', ''
    if (-not [double]::TryParse($v, [Globalization.NumberStyles]::Float, [Globalization.CultureInfo]::InvariantCulture, [ref]$n) -or $n -le 0) {
        Fail "$nome non valido: '$v' (scrivi un numero di GB, es. 8 oppure 1.5)"
    }
    return $n
}

function Fmt-MB([double]$mb) {
    if ($mb -ge 1024) { return ('{0:N1} GB' -f ($mb / 1024)) }
    return ('{0:N0} MB' -f $mb)
}

function Ram-GB {
    $cs = Get-CimInstance Win32_ComputerSystem
    return [math]::Round($cs.TotalPhysicalMemory / 1GB)
}

# ---------------- stato ----------------
function Cmd-Stato {
    $os = Get-CimInstance Win32_OperatingSystem
    $cs = Get-CimInstance Win32_ComputerSystem
    $totRam  = $os.TotalVisibleMemorySize / 1KB
    $freeRam = $os.FreePhysicalMemory / 1KB
    $totVirt = $os.TotalVirtualMemorySize / 1KB
    $freeVirt = $os.FreeVirtualMemory / 1KB

    Write-Host "=== Memoria ===" -ForegroundColor White
    Write-Host ("RAM fisica:          {0} usati su {1}" -f (Fmt-MB ($totRam - $freeRam)), (Fmt-MB $totRam))
    Write-Host ("RAM + paging (max):  {0} usati su {1}" -f (Fmt-MB ($totVirt - $freeVirt)), (Fmt-MB $totVirt))
    Write-Host ""

    Write-Host "=== File di paging (RAM virtuale su disco) ===" -ForegroundColor White
    if ($cs.AutomaticManagedPagefile) { Write-Host "Gestione: AUTOMATICA (decide Windows)" }
    else { Write-Host "Gestione: MANUALE" }
    $usage = @(Get-CimInstance Win32_PageFileUsage)
    if ($usage.Count -eq 0) { Write-Host "(nessun file di paging attivo)" }
    foreach ($u in $usage) {
        Write-Host ("{0}: allocati {1}, in uso {2}, picco {3}" -f $u.Name, (Fmt-MB $u.AllocatedBaseSize), (Fmt-MB $u.CurrentUsage), (Fmt-MB $u.PeakUsage))
    }
    foreach ($s in @(Get-CimInstance Win32_PageFileSetting)) {
        if ($s.InitialSize -eq 0 -and $s.MaximumSize -eq 0) { $dim = 'gestito dal sistema' }
        else { $dim = "min $(Fmt-MB $s.InitialSize) / max $(Fmt-MB $s.MaximumSize)" }
        Write-Host ("Impostazione al prossimo riavvio: {0} -> {1}" -f $s.Name, $dim)
    }
    Write-Host ""

    Write-Host "=== Compressione memoria (RAM compressa) ===" -ForegroundColor White
    try {
        $mm = Get-MMAgent
        if ($mm.MemoryCompression) { Write-Host "ATTIVA" } else { Write-Host "DISATTIVATA" }
        $p = Get-Process -Name 'Memory Compression' -ErrorAction SilentlyContinue
        if ($p) { Write-Host ("Dati compressi in RAM ora: {0}" -f (Fmt-MB ($p.WorkingSet64 / 1MB))) }
    } catch { Write-Host "(serve PowerShell come amministratore per leggerla)" }
    Write-Host ""

    Write-Host "=== Ramdisk (ImDisk) ===" -ForegroundColor White
    if (Get-Command imdisk -ErrorAction SilentlyContinue) {
        $l = (& imdisk -l 2>$null) -join ' '
        if ($l -match '\S') { & imdisk -l } else { Write-Host "(nessuno)" }
    } else { Write-Host "(ImDisk non installato)" }
    Write-Host ""

    Write-Host "=== WSL2 (.wslconfig) ===" -ForegroundColor White
    $wslcfg = Join-Path $env:USERPROFILE '.wslconfig'
    if (Test-Path $wslcfg) { Get-Content $wslcfg | ForEach-Object { Write-Host "  $_" } }
    else { Write-Host "(nessun .wslconfig: WSL usa i valori predefiniti)" }
}

# ---------------- file di paging ----------------
function Set-Paging([double]$minGB, [double]$maxGB, [string]$unita) {
    if ($maxGB -lt $minGB) { Fail "Il massimo ($maxGB GB) non può essere più piccolo del minimo ($minGB GB)" }
    $unita = $unita.TrimEnd(':', '\').ToUpper()
    if ($unita -notmatch '^[A-Z]$') { Fail "Unità non valida: '$unita' (es. C)" }
    $drive = Get-PSDrive -Name $unita -PSProvider FileSystem -ErrorAction SilentlyContinue
    if (-not $drive) { Fail "L'unità ${unita}: non esiste" }

    $minMB = [uint32][math]::Round($minGB * 1024)
    $maxMB = [uint32][math]::Round($maxGB * 1024)
    $freeMB = [math]::Floor($drive.Free / 1MB)
    if ($maxMB -gt ($freeMB - 10240)) {
        Fail ("Spazio insufficiente su ${unita}: liberi {0}, servono {1} + 10 GB di margine" -f (Fmt-MB $freeMB), (Fmt-MB $maxMB))
    }

    $cs = Get-CimInstance Win32_ComputerSystem
    if ($cs.AutomaticManagedPagefile) {
        Set-CimInstance -InputObject $cs -Property @{ AutomaticManagedPagefile = $false }
        Info "Gestione automatica del file di paging disattivata"
    }

    $nome = "${unita}:\pagefile.sys"
    $pf = Get-CimInstance Win32_PageFileSetting | Where-Object { $_.Name -eq $nome }
    if (-not $pf) {
        $pf = New-CimInstance -ClassName Win32_PageFileSetting -Property @{ Name = $nome }
    }
    Set-CimInstance -InputObject $pf -Property @{ InitialSize = $minMB; MaximumSize = $maxMB }
    Ok ("File di paging su ${unita}: minimo {0}, massimo {1}" -f (Fmt-MB $minMB), (Fmt-MB $maxMB))
    Warn "Riavvia il PC per applicare la modifica"
}

function Cmd-Paging($a) {
    if ($a.Count -lt 2) { Fail "Uso: vram paging <minimo GB> <massimo GB> [unità]   es: vram paging 16 32 C" }
    $unita = if ($a.Count -ge 3) { $a[2] } else { $env:SystemDrive }
    Set-Paging (To-GB $a[0] 'Minimo') (To-GB $a[1] 'Massimo') $unita
}

function Cmd-PagingAutomatico {
    $cs = Get-CimInstance Win32_ComputerSystem
    Set-CimInstance -InputObject $cs -Property @{ AutomaticManagedPagefile = $true }
    Ok "File di paging di nuovo gestito automaticamente da Windows"
    Warn "Riavvia il PC per applicare la modifica"
}

# ---------------- compressione memoria ----------------
function Cmd-Compressione($a) {
    $v = if ($a.Count -ge 1) { "$($a[0])".ToLower() } else { '' }
    switch ($v) {
        { $_ -in 'on', 'si', 'sì', 'attiva' } {
            $svc = Get-Service SysMain -ErrorAction SilentlyContinue
            if ($svc -and $svc.StartType -eq 'Disabled') {
                Set-Service SysMain -StartupType Automatic
                Info "Servizio SysMain riabilitato (serve alla compressione)"
            }
            if ($svc -and $svc.Status -ne 'Running') { Start-Service SysMain -ErrorAction SilentlyContinue }
            Enable-MMAgent -MemoryCompression
            Ok "Compressione memoria attiva (effetto completo dopo il riavvio)"
        }
        { $_ -in 'off', 'no', 'disattiva' } {
            Disable-MMAgent -MemoryCompression
            Ok "Compressione memoria disattivata (effetto completo dopo il riavvio)"
        }
        default { Fail "Uso: vram compressione on|off" }
    }
}

# ---------------- ramdisk (ImDisk) ----------------
function Need-ImDisk {
    if (-not (Get-Command imdisk -ErrorAction SilentlyContinue)) {
        Warn "Windows non ha un ramdisk integrato: serve ImDisk Toolkit (gratuito, open source)."
        Write-Host "  Installalo con:  winget install ImDisk.Toolkit"
        Write-Host "  poi chiudi e riapri il terminale e ripeti il comando."
        exit 1
    }
}

function Cmd-Ramdisk($a) {
    if ($a.Count -lt 2) { Fail "Uso: vram ramdisk <lettera> <GB>   es: vram ramdisk R 4" }
    Need-ImDisk
    $l = "$($a[0])".TrimEnd(':', '\').ToUpper()
    if ($l -notmatch '^[A-Z]$') { Fail "Lettera non valida: '$l'" }
    if (Get-PSDrive -Name $l -ErrorAction SilentlyContinue) { Fail "La lettera ${l}: è già in uso" }
    $gb = To-GB $a[1] 'Dimensione'
    $mb = [int][math]::Round($gb * 1024)
    & imdisk -a -s "${mb}M" -m "${l}:" -p "/fs:ntfs /q /y /v:RAMDISK"
    if ($LASTEXITCODE -ne 0) { Fail "ImDisk non è riuscito a creare il ramdisk" }
    Ok "Ramdisk ${l}: da $(Fmt-MB $mb) pronto"
    Warn "Il contenuto sparisce allo spegnimento: usalo per build e cache, non per i sorgenti"
}

function Cmd-RamdiskRimuovi($a) {
    if ($a.Count -lt 1) { Fail "Uso: vram ramdisk-rimuovi <lettera>" }
    Need-ImDisk
    $l = "$($a[0])".TrimEnd(':', '\').ToUpper()
    & imdisk -D -m "${l}:"
    if ($LASTEXITCODE -ne 0) { Fail "Impossibile rimuovere ${l}: (chiudi i programmi che lo usano)" }
    Ok "Ramdisk ${l}: rimosso"
}

# ---------------- WSL2 ----------------
function Cmd-Wsl($a) {
    if ($a.Count -lt 2) { Fail "Uso: vram wsl <RAM GB> <swap GB>   es: vram wsl 8 16" }
    $mem = To-GB $a[0] 'RAM'
    $swp = To-GB $a[1] 'Swap'
    $ramPc = Ram-GB
    if ($mem -gt $ramPc) { Warn "Hai chiesto $mem GB ma il PC ne ha $ramPc: WSL ne userà al massimo quanti ce ne sono" }

    $cfg = Join-Path $env:USERPROFILE '.wslconfig'
    $lines = New-Object System.Collections.Generic.List[string]
    if (Test-Path $cfg) {
        Copy-Item $cfg "$cfg.bak" -Force
        Get-Content $cfg | ForEach-Object { $lines.Add($_) }
    }
    $want = [ordered]@{ memory = "$($mem)GB"; swap = "$($swp)GB" }

    # trova la sezione [wsl2]
    $start = -1
    for ($i = 0; $i -lt $lines.Count; $i++) { if ($lines[$i].Trim() -ieq '[wsl2]') { $start = $i; break } }
    if ($start -lt 0) {
        if ($lines.Count -gt 0) { $lines.Add('') }
        $lines.Add('[wsl2]'); $start = $lines.Count - 1
    }
    $end = $lines.Count
    for ($i = $start + 1; $i -lt $lines.Count; $i++) { if ($lines[$i].Trim() -match '^\[.+\]$') { $end = $i; break } }

    foreach ($k in @($want.Keys)) {
        $found = $false
        for ($i = $start + 1; $i -lt $end; $i++) {
            if ($lines[$i] -match "^\s*$k\s*=") { $lines[$i] = "$k=$($want[$k])"; $found = $true; break }
        }
        if (-not $found) { $lines.Insert($end, "$k=$($want[$k])"); $end++ }
    }
    # UTF-8 senza BOM: WSL legge male i file con BOM
    [IO.File]::WriteAllLines($cfg, $lines, (New-Object Text.UTF8Encoding($false)))
    Ok "WSL2: RAM $($want.memory), swap $($want.swap) -> $cfg"
    Info "Applica con:  wsl --shutdown   (poi riapri WSL)"
    Info "Dentro WSL puoi usare anche ../vram.sh (zram, ramdisk, esegui)"
}

# ---------------- esegui con tetto di RAM ----------------
$JobCode = @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;

public static class VramJob {
    [StructLayout(LayoutKind.Sequential)]
    struct BASIC_LIMIT {
        public long PerProcessUserTimeLimit;
        public long PerJobUserTimeLimit;
        public uint LimitFlags;
        public UIntPtr MinimumWorkingSetSize;
        public UIntPtr MaximumWorkingSetSize;
        public uint ActiveProcessLimit;
        public UIntPtr Affinity;
        public uint PriorityClass;
        public uint SchedulingClass;
    }

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    static extern IntPtr CreateJobObject(IntPtr attributes, string name);
    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool SetInformationJobObject(IntPtr job, int infoClass, ref BASIC_LIMIT info, uint length);
    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
    [DllImport("kernel32.dll")]
    static extern IntPtr GetCurrentProcess();

    // Mette il processo corrente (e tutti i figli che creerà) in un Job con un tetto
    // al working set: oltre il tetto Windows sposta le pagine nel file di paging
    // invece di far fallire le allocazioni.
    public static IntPtr LimitCurrentProcess(ulong maxBytes) {
        IntPtr job = CreateJobObject(IntPtr.Zero, null);
        if (job == IntPtr.Zero) throw new Win32Exception();
        BASIC_LIMIT b = new BASIC_LIMIT();
        b.LimitFlags = 0x1; // JOB_OBJECT_LIMIT_WORKINGSET
        b.MinimumWorkingSetSize = new UIntPtr(Math.Min(maxBytes / 4, 64UL * 1024 * 1024));
        b.MaximumWorkingSetSize = new UIntPtr(maxBytes);
        if (!SetInformationJobObject(job, 2, ref b, (uint)Marshal.SizeOf(typeof(BASIC_LIMIT))))
            throw new Win32Exception();
        if (!AssignProcessToJobObject(job, GetCurrentProcess()))
            throw new Win32Exception();
        return job;
    }
}
'@

function Cmd-Esegui($a) {
    if ($a.Count -lt 2) { Fail 'Uso: vram esegui <RAM GB> "<comando>"   es: vram esegui 4 "gradlew assembleDebug"' }
    $gb = To-GB $a[0] 'RAM'
    $comando = ($a[1..($a.Count - 1)]) -join ' '
    $bytes = [uint64]($gb * 1GB)
    Info "Avvio con al massimo $gb GB di RAM fisica per processo: $comando"

    # Un PowerShell figlio entra nel Job e lancia il comando: così il terminale
    # da cui parti resta libero e i processi creati dal comando ereditano il tetto.
    $b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($comando))
    $exe = (Get-Process -Id $PID).Path
    $p = Start-Process -FilePath $exe -NoNewWindow -Wait -PassThru -WorkingDirectory (Get-Location).Path `
        -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"", '_figlio', "$bytes", $b64)
    if ($p.ExitCode -eq 0) { Ok "Comando terminato" } else { Warn "Il comando è terminato con codice $($p.ExitCode)" }
    exit $p.ExitCode
}

function Cmd-Figlio($a) {
    $bytes = [uint64]$a[0]
    $comando = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($a[1]))
    try {
        Add-Type -TypeDefinition $JobCode
        [void][VramJob]::LimitCurrentProcess($bytes)
    } catch {
        Warn "Tetto di RAM non applicabile ($($_.Exception.Message)): eseguo senza limite, il file di paging resta attivo"
    }
    & cmd.exe /d /c $comando
    exit $LASTEXITCODE
}

# ---------------- profilo automatico ----------------
function Cmd-Auto {
    $ram = Ram-GB
    $unita = $env:SystemDrive.TrimEnd(':')
    $free = [math]::Floor((Get-PSDrive -Name $unita).Free / 1GB)
    $min = $ram
    $max = [math]::Min($ram * 2, 32)
    if ($max -gt ($free - 10)) { $max = [math]::Max($free - 10, 0) }
    if ($min -gt $max) { $min = $max }
    Info "RAM fisica: $ram GB — spazio libero su ${unita}: $free GB"
    if ($max -lt 2) {
        Warn "Spazio su disco troppo poco per un file di paging utile: libera spazio e riprova"
    } else {
        Info "Profilo: file di paging $min-$max GB su ${unita}: + compressione memoria"
        Set-Paging $min $max $unita
    }
    Cmd-Compressione @('on')
    Write-Host ""
    Warn "Riavvia il PC: dopo il riavvio controlla con  vram stato"
}

function Cmd-SpegniTutto {
    Cmd-PagingAutomatico
    Ok "Impostazioni di Windows ripristinate (la compressione resta attiva: è il valore predefinito di Windows)"
}

function Cmd-Aiuto {
@'
vram — RAM virtuale per i tuoi progetti su Windows

  stato                          RAM, file di paging, compressione, ramdisk, WSL
  auto                    [adm]  configurazione consigliata: paging RAM..2xRAM + compressione
  spegni-tutto            [adm]  torna al file di paging automatico di Windows

  paging <min GB> <max GB> [unità]   [adm]  imposta il file di paging (es. paging 16 32 C)
  paging-automatico                  [adm]  lascia decidere a Windows
  compressione on|off                [adm]  RAM compressa (come zram su Linux)

  ramdisk <lettera> <GB>         [adm]  crea un'unità in RAM (serve ImDisk Toolkit)
  ramdisk-rimuovi <lettera>      [adm]  la rimuove

  wsl <RAM GB> <swap GB>                memoria e swap di WSL2 (.wslconfig)
  esegui <GB> "<comando>"               lancia un comando con un tetto di RAM fisica:
                                        oltre il tetto usa il file di paging

  [adm] = chiede i permessi di amministratore in automatico

Esempi:
  .\vram.bat auto
  .\vram.bat ramdisk R 4
  .\vram.bat wsl 8 16
  .\vram.bat esegui 4 "gradlew assembleDebug"
'@ | Write-Host
}

# ---------------- main ----------------
$comando = if ($args.Count -ge 1) { "$($args[0])".ToLower() } else { 'aiuto' }
$resto = @()
if ($args.Count -ge 2) { $resto = @($args[1..($args.Count - 1)]) }

$adminCmds = 'auto', 'spegni-tutto', 'paging', 'paging-automatico', 'compressione', 'ramdisk', 'ramdisk-rimuovi'
if ($adminCmds -contains $comando) { Require-Admin ([string[]]$args) }

switch ($comando) {
    { $_ -in 'stato', 'status' }   { Cmd-Stato }
    'auto'                         { Cmd-Auto }
    'spegni-tutto'                 { Cmd-SpegniTutto }
    'paging'                       { Cmd-Paging $resto }
    'paging-automatico'            { Cmd-PagingAutomatico }
    'compressione'                 { Cmd-Compressione $resto }
    'ramdisk'                      { Cmd-Ramdisk $resto }
    'ramdisk-rimuovi'              { Cmd-RamdiskRimuovi $resto }
    'wsl'                          { Cmd-Wsl $resto }
    { $_ -in 'esegui', 'run' }     { Cmd-Esegui $resto }
    '_figlio'                      { Cmd-Figlio $resto }
    { $_ -in 'aiuto', 'help', '-h', '--help', '/?' } { Cmd-Aiuto }
    default                        { Fail "Comando sconosciuto: $comando (prova: vram aiuto)" }
}
