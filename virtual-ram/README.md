# Virtual RAM — `vram.sh`

Uno script che dà più memoria ai tuoi progetti su Linux (anche WSL2), unendo tre tecniche:

| Tecnica | Dove sta | Velocità | Quando usarla |
|---|---|---|---|
| **zram** | RAM compressa | ⚡ molto veloce | sempre: guadagni circa 2-3 volte lo spazio |
| **swapfile** | file su disco | 🐢 lenta (meglio su SSD) | come riserva, per non andare mai in crash |
| **ramdisk** (tmpfs) | cartella in RAM | ⚡⚡ velocissima | build, cache, file temporanei |

Il kernel usa prima zram (priorità 100) e solo dopo lo swapfile (priorità 10).

## Avvio rapido

```bash
chmod +x vram.sh
sudo ./vram.sh auto      # zram (metà della RAM) + swapfile (grande quanto la RAM, max 16G)
./vram.sh stato          # controlla cosa è attivo
sudo ./vram.sh spegni-tutto
```

## Comandi

```bash
sudo ./vram.sh swap-crea 8G --persistente   # swapfile che resta anche dopo il riavvio
sudo ./vram.sh swap-rimuovi
sudo ./vram.sh zram-attiva 4G zstd
sudo ./vram.sh zram-disattiva
sudo ./vram.sh ramdisk /mnt/build 4G
sudo ./vram.sh ramdisk-smonta /mnt/build
sudo ./vram.sh swappiness 100               # con zram conviene un valore alto
```

### Lanciare un progetto con un tetto di RAM

```bash
./vram.sh esegui <RAM> [swap] -- <comando>
./vram.sh esegui 4G 8G -- ./gradlew assembleDebug
```

Il progetto userà al massimo 4G di RAM vera. Quando gli serve di più, il resto va
nella RAM virtuale e il computer non si blocca. Lo script prova in ordine:
`systemd-run`, poi i cgroup v2, poi i cgroup v1. Se non ne trova nessuno, esegue il
comando senza tetto (lo swap resta comunque attivo).

## Esempio: build Android/Gradle di questo repo

```bash
sudo ./virtual-ram/vram.sh auto
sudo ./virtual-ram/vram.sh ramdisk ~/.gradle-ram 3G
export GRADLE_USER_HOME=~/.gradle-ram       # la cache di Gradle in RAM: build più veloci
./virtual-ram/vram.sh esegui 6G 8G -- ./gradlew assembleDebug
```

## Windows → cartella `windows/`

Su Windows la stessa idea si realizza con gli strumenti integrati nel sistema:

| Linux (`vram.sh`) | Windows (`vram.bat`) |
|---|---|
| swapfile | **file di paging** (`pagefile.sys`) |
| zram | **compressione memoria** (già integrata in Windows 10/11) |
| ramdisk tmpfs | **ramdisk ImDisk** (`winget install ImDisk.Toolkit`) |
| esegui con tetto | **Job Object** con tetto di RAM fisica |

Apri PowerShell o il Prompt dei comandi nella cartella `virtual-ram\windows` e:

```powershell
.\vram.bat auto                              # paging da RAM a 2xRAM (max 32 GB) + compressione, poi riavvia
.\vram.bat stato
.\vram.bat paging 16 32 C                    # file di paging manuale: minimo 16 GB, massimo 32 GB su C:
.\vram.bat paging-automatico                 # torna alle impostazioni di Windows
.\vram.bat compressione on
.\vram.bat ramdisk R 4                       # unità R: da 4 GB in RAM
.\vram.bat ramdisk-rimuovi R
.\vram.bat wsl 8 16                          # WSL2: 8 GB di RAM e 16 GB di swap
.\vram.bat esegui 4 "gradlew assembleDebug"  # al massimo 4 GB di RAM fisica per processo
```

I comandi che cambiano il sistema chiedono da soli i permessi di amministratore (finestra UAC).
Le modifiche al file di paging valgono **dopo il riavvio**.

Per le build Gradle/Android conviene anche:
```powershell
.\vram.bat ramdisk R 4
$env:GRADLE_USER_HOME = "R:\gradle"
.\vram.bat esegui 6 "gradlew assembleDebug"
```

## Note

- Su macOS lo swap è gestito in automatico dal sistema, quindi lo script non serve.
- I comandi che modificano il sistema richiedono `sudo`. `stato`, `esegui` e `swappiness`
  in sola lettura funzionano senza.
- Alcuni container (Docker senza `--privileged`) non permettono `swapon`: lo script lo dice
  e annulla le modifiche.
