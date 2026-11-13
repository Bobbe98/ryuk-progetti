#!/usr/bin/env bash
# vram.sh — gestore di RAM virtuale per Linux
#
# Tre modi per avere "più RAM" per un progetto:
#   1. swapfile  : un file su disco usato come memoria extra (lento ma capiente)
#   2. zram      : RAM compressa in memoria (veloce, ~2-3x di spazio effettivo)
#   3. ramdisk   : una cartella che vive in RAM (tmpfs) per build/cache velocissime
# In più: "esegui" lancia un comando con un limite di memoria, così il progetto
# usa la RAM virtuale invece di bloccare tutto il sistema.
#
# Uso: sudo ./vram.sh <comando> [argomenti]   —   ./vram.sh aiuto

set -euo pipefail

SWAPFILE_DEFAULT="/swapfile-vram"
ZRAM_PRIORITY=100      # zram viene usata prima dello swap su disco
SWAPFILE_PRIORITY=10

# ---------- utilità ----------
c_ok()   { printf '\033[32m✔ %s\033[0m\n' "$*"; }
c_info() { printf '\033[36m➜ %s\033[0m\n' "$*"; }
c_warn() { printf '\033[33m⚠ %s\033[0m\n' "$*" >&2; }
die()    { printf '\033[31m✘ %s\033[0m\n' "$*" >&2; exit 1; }

need_root() {
  [[ $EUID -eq 0 ]] || die "Questo comando richiede i privilegi di root: usa 'sudo $0 $*'"
}

# Converte 512M / 4G / 1T / 1024 (MiB) in byte
to_bytes() {
  local v="${1^^}" n unit
  [[ $v =~ ^([0-9]+)([KMGT]?)I?B?$ ]] || die "Dimensione non valida: '$1' (esempi: 512M, 4G)"
  n="${BASH_REMATCH[1]}"; unit="${BASH_REMATCH[2]:-M}"
  case "$unit" in
    K) echo $((n * 1024)) ;;
    M) echo $((n * 1024 ** 2)) ;;
    G) echo $((n * 1024 ** 3)) ;;
    T) echo $((n * 1024 ** 4)) ;;
  esac
}

human() { numfmt --to=iec-i --suffix=B "$1" 2>/dev/null || echo "$1 B"; }

mem_total_bytes() { awk '/^MemTotal:/ {print $2 * 1024}' /proc/meminfo; }

free_disk_bytes() { df -B1 --output=avail "$(dirname "$1")" | tail -1 | tr -d ' '; }

# ---------- stato ----------
cmd_stato() {
  echo "=== Memoria ==="
  free -h
  echo
  echo "=== Aree di swap attive ==="
  if [[ $(wc -l < /proc/swaps) -gt 1 ]]; then cat /proc/swaps; else echo "(nessuna)"; fi
  echo
  echo "=== zram ==="
  if command -v zramctl >/dev/null && [[ -n $(zramctl --noheadings 2>/dev/null) ]]; then
    zramctl
  else
    echo "(nessun dispositivo zram)"
  fi
  echo
  echo "=== Ramdisk (tmpfs creati da vram) ==="
  findmnt -S vram-ramdisk -o TARGET,SIZE,USED,AVAIL 2>/dev/null || echo "(nessuno)"
  echo
  echo "swappiness = $(cat /proc/sys/vm/swappiness)   (0 = evita swap, 100 = usa swap volentieri)"
}

# ---------- swapfile ----------
cmd_swap_crea() {
  need_root swap-crea
  local size="${1:-}" file="${2:-$SWAPFILE_DEFAULT}" persist="${3:-}"
  [[ -n $size ]] || die "Uso: vram.sh swap-crea <dimensione> [file] [--persistente]"
  [[ $file == --persistente ]] && { persist="--persistente"; file="$SWAPFILE_DEFAULT"; }
  local bytes; bytes=$(to_bytes "$size")
  local mib=$((bytes / 1024 / 1024))

  if grep -q "^$file " /proc/swaps; then die "$file è già attivo come swap"; fi
  [[ -e $file ]] && die "$file esiste già: rimuovilo con 'vram.sh swap-rimuovi $file'"

  local avail; avail=$(free_disk_bytes "$file")
  (( avail > bytes + 1024 ** 3 )) || die "Spazio disco insufficiente: servono $(human "$bytes") + 1GiB di margine, liberi $(human "$avail")"

  c_info "Creo lo swapfile $file da $(human "$bytes")…"
  # fallocate è istantaneo ma non è supportato da tutti i filesystem (es. btrfs vecchi, zfs)
  if ! fallocate -l "$bytes" "$file" 2>/dev/null; then
    c_warn "fallocate non supportato, uso dd (più lento)…"
    dd if=/dev/zero of="$file" bs=1M count="$mib" status=progress
  fi
  chmod 600 "$file"
  mkswap "$file" >/dev/null
  if ! swapon -p "$SWAPFILE_PRIORITY" "$file"; then
    rm -f "$file"
    die "swapon fallito: il kernel/contenitore non permette lo swap su questo filesystem"
  fi
  c_ok "Swapfile attivo: $(human "$bytes") in $file"

  if [[ $persist == --persistente ]]; then
    if ! grep -q "^$file " /etc/fstab; then
      echo "$file none swap sw,pri=$SWAPFILE_PRIORITY 0 0  # vram" >> /etc/fstab
      c_ok "Aggiunto a /etc/fstab: sarà attivo anche dopo il riavvio"
    fi
  else
    c_info "Non persistente: dopo il riavvio sparisce (aggiungi --persistente per mantenerlo)"
  fi
}

cmd_swap_rimuovi() {
  need_root swap-rimuovi
  local file="${1:-$SWAPFILE_DEFAULT}"
  if grep -q "^$file " /proc/swaps; then
    c_info "Disattivo $file (le pagine tornano in RAM, può richiedere un po')…"
    swapoff "$file"
  fi
  [[ -f $file ]] && rm -f "$file"
  if grep -q "^$file " /etc/fstab 2>/dev/null; then
    sed -i "\|^$file |d" /etc/fstab
    c_ok "Rimosso da /etc/fstab"
  fi
  c_ok "Swapfile $file rimosso"
}

# ---------- zram ----------
cmd_zram_attiva() {
  need_root zram-attiva
  local size="${1:-}" algo="${2:-zstd}"
  if [[ -z $size ]]; then
    # default: metà della RAM fisica
    size="$(( $(mem_total_bytes) / 2 / 1024 / 1024 ))M"
  fi
  local bytes; bytes=$(to_bytes "$size")
  command -v zramctl >/dev/null || die "zramctl non trovato (installa util-linux)"
  modprobe zram 2>/dev/null || [[ -e /sys/class/zram-control ]] || die "Modulo zram non disponibile in questo kernel"

  # zstd non sempre presente: ripiega su lz4 / lzo-rle
  local dev
  dev=$(zramctl --find --size "$bytes" --algorithm "$algo" 2>/dev/null) \
    || dev=$(zramctl --find --size "$bytes" --algorithm lz4 2>/dev/null) \
    || dev=$(zramctl --find --size "$bytes") \
    || die "Impossibile creare un dispositivo zram"
  mkswap "$dev" >/dev/null
  swapon -p "$ZRAM_PRIORITY" "$dev" || { zramctl --reset "$dev"; die "swapon su $dev fallito"; }
  c_ok "zram attiva su $dev: $(human "$bytes") di RAM compressa (algoritmo: $(zramctl -n -o ALGORITHM "$dev"))"
}

cmd_zram_disattiva() {
  need_root zram-disattiva
  local found=0
  for dev in $(awk '/^\/dev\/zram/ {print $1}' /proc/swaps); do
    swapoff "$dev"; zramctl --reset "$dev"; c_ok "Disattivato $dev"; found=1
  done
  (( found )) || c_info "Nessun dispositivo zram attivo"
}

# ---------- ramdisk ----------
cmd_ramdisk() {
  need_root ramdisk
  local dir="${1:-}" size="${2:-1G}"
  [[ -n $dir ]] || die "Uso: vram.sh ramdisk <cartella> [dimensione]"
  to_bytes "$size" >/dev/null
  mkdir -p "$dir"
  mountpoint -q "$dir" && die "$dir è già un punto di mount"
  mount -t tmpfs -o "size=${size},mode=1777" vram-ramdisk "$dir"
  c_ok "Ramdisk da $size montato in $dir"
  c_warn "Il contenuto sparisce allo smontaggio o al riavvio: usalo per build/cache, non per i sorgenti"
}

cmd_ramdisk_smonta() {
  need_root ramdisk-smonta
  local dir="${1:-}"
  [[ -n $dir ]] || die "Uso: vram.sh ramdisk-smonta <cartella>"
  umount "$dir"
  c_ok "Ramdisk $dir smontato"
}

# ---------- swappiness ----------
cmd_swappiness() {
  local v="${1:-}"
  if [[ -z $v ]]; then cat /proc/sys/vm/swappiness; return; fi
  need_root swappiness
  [[ $v =~ ^[0-9]+$ ]] && (( v <= 200 )) || die "Valore tra 0 e 200"
  sysctl -q -w vm.swappiness="$v"
  c_ok "swappiness = $v"
}

# ---------- esegui con limite di memoria ----------
# vram.sh esegui <limite RAM> [limite swap] -- comando...
cmd_esegui() {
  local mem="${1:-}"; shift || true
  local swap=""
  if [[ ${1:-} != -- && -n ${1:-} ]]; then swap="$1"; shift; fi
  [[ ${1:-} == -- ]] && shift
  [[ -n $mem && $# -gt 0 ]] || die "Uso: vram.sh esegui <limite RAM> [limite swap] -- comando…"
  to_bytes "$mem" >/dev/null
  [[ -z $swap ]] || to_bytes "$swap" >/dev/null

  c_info "Avvio con RAM massima $mem${swap:+ e swap massimo $swap}: $*"

  # 1) systemd-run (metodo pulito, cgroup v2 gestito da systemd)
  if command -v systemd-run >/dev/null && [[ -d /run/systemd/system ]]; then
    local props=(-p "MemoryMax=$mem")
    [[ -n $swap ]] && props+=(-p "MemorySwapMax=$swap")
    if [[ $EUID -eq 0 ]]; then
      exec systemd-run --scope --quiet "${props[@]}" -- "$@"
    else
      exec systemd-run --user --scope --quiet "${props[@]}" -- "$@"
    fi
  fi

  # 2) cgroup v2 manuale (container, WSL2, sistemi senza systemd)
  local cg=/sys/fs/cgroup
  if [[ $EUID -eq 0 && -f $cg/cgroup.controllers ]] && grep -qw memory "$cg/cgroup.controllers"; then
    echo +memory > "$cg/cgroup.subtree_control" 2>/dev/null || true
    local grp="$cg/vram-$$"
    if mkdir "$grp" 2>/dev/null && echo "$(to_bytes "$mem")" > "$grp/memory.max" 2>/dev/null; then
      [[ -n $swap ]] && { echo "$(to_bytes "$swap")" > "$grp/memory.swap.max" 2>/dev/null || true; }
      echo $$ > "$grp/cgroup.procs"
      exec "$@"
    fi
    rmdir "$grp" 2>/dev/null || true
  fi

  # 3) cgroup v1 (sistemi più vecchi, alcuni container)
  local v1=$cg/memory
  if [[ $EUID -eq 0 && -f $v1/memory.limit_in_bytes ]]; then
    local grp="$v1/vram-$$"
    if mkdir "$grp" 2>/dev/null && echo "$(to_bytes "$mem")" > "$grp/memory.limit_in_bytes" 2>/dev/null; then
      if [[ -n $swap && -f $grp/memory.memsw.limit_in_bytes ]]; then
        # in v1 il limite memsw è RAM + swap insieme
        echo $(( $(to_bytes "$mem") + $(to_bytes "$swap") )) > "$grp/memory.memsw.limit_in_bytes" 2>/dev/null || true
      fi
      echo $$ > "$grp/cgroup.procs"
      exec "$@"
    fi
    rmdir "$grp" 2>/dev/null || true
  fi

  # 4) nessun cgroup: 'ulimit -v' farebbe crashare il programma invece di farlo
  #    andare in swap, quindi si esegue senza tetto (lo swap resta comunque attivo).
  c_warn "cgroup non disponibili: eseguo senza tetto di RAM (lo swap/zram attivi restano utilizzabili)"
  exec "$@"
}

# ---------- profilo automatico ----------
cmd_auto() {
  need_root auto
  local ram; ram=$(mem_total_bytes)
  local zram_mib=$(( ram / 2 / 1024 / 1024 ))
  local swap_mib=$(( ram / 1024 / 1024 ))
  (( swap_mib > 16384 )) && swap_mib=16384
  c_info "RAM fisica: $(human "$ram")"
  c_info "Profilo: zram ${zram_mib}M (veloce) + swapfile ${swap_mib}M (riserva su disco)"
  cmd_zram_attiva "${zram_mib}M" || c_warn "zram non disponibile, continuo solo con lo swapfile"
  if ! grep -q "^$SWAPFILE_DEFAULT " /proc/swaps; then
    cmd_swap_crea "${swap_mib}M" "$SWAPFILE_DEFAULT" || c_warn "swapfile non creato"
  fi
  # Con zram conviene una swappiness alta: comprimere in RAM costa poco
  cmd_swappiness 100
  echo; cmd_stato
}

cmd_spegni_tutto() {
  need_root spegni-tutto
  cmd_zram_disattiva
  grep -q "^$SWAPFILE_DEFAULT " /proc/swaps || [[ -f $SWAPFILE_DEFAULT ]] && cmd_swap_rimuovi "$SWAPFILE_DEFAULT"
  sysctl -q -w vm.swappiness=60
  c_ok "RAM virtuale disattivata, swappiness riportata a 60"
}

cmd_aiuto() {
  cat <<'EOF'
vram.sh — RAM virtuale per i tuoi progetti

  stato                                   mostra RAM, swap, zram e ramdisk
  auto                                    configurazione consigliata in un colpo (zram + swapfile)
  spegni-tutto                            annulla 'auto'

  swap-crea <dim> [file] [--persistente]  crea e attiva uno swapfile (es. 8G)
  swap-rimuovi [file]                     disattiva e cancella lo swapfile

  zram-attiva [dim] [algoritmo]           RAM compressa (default: metà RAM, zstd)
  zram-disattiva                          spegne tutti i dispositivi zram

  ramdisk <cartella> [dim]                monta una cartella in RAM (tmpfs)
  ramdisk-smonta <cartella>               la smonta

  swappiness [0-200]                      legge/imposta quanto il kernel usa lo swap
  esegui <RAM> [swap] -- <comando…>       lancia un comando con un tetto di RAM;
                                          oltre il tetto usa lo swap invece di bloccare il PC

Esempi:
  sudo ./vram.sh auto
  sudo ./vram.sh swap-crea 8G --persistente
  sudo ./vram.sh ramdisk /mnt/build 4G
  ./vram.sh esegui 4G 8G -- ./gradlew assembleDebug
EOF
}

main() {
  local cmd="${1:-aiuto}"; shift || true
  case "$cmd" in
    stato|status)        cmd_stato "$@" ;;
    auto)                cmd_auto "$@" ;;
    spegni-tutto)        cmd_spegni_tutto "$@" ;;
    swap-crea)           cmd_swap_crea "$@" ;;
    swap-rimuovi)        cmd_swap_rimuovi "$@" ;;
    zram-attiva)         cmd_zram_attiva "$@" ;;
    zram-disattiva)      cmd_zram_disattiva "$@" ;;
    ramdisk)             cmd_ramdisk "$@" ;;
    ramdisk-smonta)      cmd_ramdisk_smonta "$@" ;;
    swappiness)          cmd_swappiness "$@" ;;
    esegui|run)          cmd_esegui "$@" ;;
    aiuto|help|-h|--help) cmd_aiuto ;;
    *) die "Comando sconosciuto: $cmd (prova 'vram.sh aiuto')" ;;
  esac
}

main "$@"
