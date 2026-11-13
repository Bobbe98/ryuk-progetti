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

## Windows

Su Windows la RAM virtuale si chiama **file di paging**. Si imposta così:
*Impostazioni → Sistema → Informazioni → Impostazioni di sistema avanzate → Prestazioni →
Impostazioni → Avanzate → Memoria virtuale → Cambia*. Togli "Gestisci automaticamente",
scegli il disco SSD e metti come dimensione personalizzata un minimo pari alla RAM e un
massimo pari a 2 volte la RAM, poi riavvia.
Per WSL2 aggiungi in `%UserProfile%\.wslconfig`:

```ini
[wsl2]
memory=8GB
swap=16GB
```

## Note

- Su macOS lo swap è gestito in automatico dal sistema, quindi lo script non serve.
- I comandi che modificano il sistema richiedono `sudo`. `stato`, `esegui` e `swappiness`
  in sola lettura funzionano senza.
- Alcuni container (Docker senza `--privileged`) non permettono `swapon`: lo script lo dice
  e annulla le modifiche.
