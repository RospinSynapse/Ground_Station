// Source: Moduri operationale.xlsx, Sheet1; planning reference, not flight automation.
export const phaseRates = [
  {
    "sensor": "Senzor temperatura exterior",
    "cells": [
      "10s / 60 s",
      "5s / 30s",
      "10 s / 60 s",
      "5s / 30s",
      "2 min / -"
    ]
  },
  {
    "sensor": "Senzor temperatura interior",
    "cells": [
      "5 s / 10 s",
      "5s / 15s",
      "10 s / 60 s",
      "5s / 15s",
      "30 s / 60 s"
    ]
  },
  {
    "sensor": "Clasificare imagini",
    "cells": [
      "-",
      "-",
      "-",
      "Se stocheaza si se transmit datele, se transmit pachete de tipul: coordGPS+eticheta clasificare (un nr de la 0 la 9). In total, vor fi 2,961 pachete de acest tip (https://docs.google.com/document/d/1fdU4MUg7_k3ZtoB_zhg7BSWKI_jZD3rp49K9x-R_kNI/edit?tab=t.0 )",
      "-"
    ]
  },
  {
    "sensor": "Senzor lumina",
    "cells": [
      "10 s / 60 s",
      "5s / 30s",
      "10 s / 60 s",
      "5s / 30s",
      "2 min / -"
    ]
  },
  {
    "sensor": "GPS",
    "cells": [
      "5 s / 10 s",
      "1s / 10s",
      "5 s / 20 s",
      "1s / 5s",
      "30 s / 60 s"
    ]
  },
  {
    "sensor": "Camera",
    "cells": [
      "-",
      "rezolutie maxima, 64MP mereu; primul km:1 poza pe secunda; dupa, la 10 sec. Nnu stim inca cu ce viteza urca balonul, dar in aceasta etapa ar trebui in primul km sa se faca 100-500 de poze. Apoi pentru restul ascensiunii, maxim 1000 de poze.",
      "O poza la 5 secunde (nu se schimba asa mult settingul).",
      "la fel ca la ascent dar invers. In total, 80-160GB de memorie necesara.",
      "-"
    ]
  },
  {
    "sensor": "IMU",
    "cells": [
      "10 Hz / 10 s",
      "50 Hz / 10s",
      "10 Hz / 30 s",
      "50 Hz / 10 s",
      "1 min / -"
    ]
  },
  {
    "sensor": "Accelerometru",
    "cells": [
      "10 Hz / 10 s",
      "50 Hz / 30s",
      "10 Hz / 60 s",
      "50 Hz / 30 s",
      "5 min / -"
    ]
  },
  {
    "sensor": "Barometru",
    "cells": [
      "10s / 60 s",
      "5s / 15 s",
      "10 s / 60 s",
      "5s / 15 s",
      "10 min / -"
    ]
  },
  {
    "sensor": "Modul backup (GPS + GSM + MCU) - doar gsm , nu comunica prin lora",
    "cells": [
      "10 s",
      "10 s ( < 3 km)",
      "-",
      "10 s ( < 3km)",
      "60 s"
    ]
  },
  {
    "sensor": "Loguri Info (CPU, Memory, Voltaj Baterie, Curent, etc)",
    "cells": [
      "10s / 60 s",
      "10s / 60 s",
      "10 s / 60 s",
      "10s / 60 s",
      "1 min / 5 min"
    ]
  },
  {
    "sensor": "Loguri Critice (Blocare task-uri, erori senzori, etc)",
    "cells": [
      "La eveniment",
      "La eveniment",
      "La eveniment",
      "La eveniment",
      "La eveniment"
    ]
  }
];
export const operationalModes = [
  {
    "name": "nominal",
    "rows": [
      {
        "sensor": "Senzor temperatura exterior",
        "activity": "10 s (SD)"
      },
      {
        "sensor": "Senzori temperatura interior",
        "activity": "10 s (SD)"
      },
      {
        "sensor": "Akida Chip",
        "activity": "OFF"
      },
      {
        "sensor": "Senzor lumina",
        "activity": "10 s (SD)"
      },
      {
        "sensor": "GPS",
        "activity": "10 s (SD)"
      },
      {
        "sensor": "Camera",
        "activity": "OFF"
      },
      {
        "sensor": "IMU",
        "activity": "50 Hz (SD)"
      },
      {
        "sensor": "Raspberry Pi 5",
        "activity": "OFF"
      },
      {
        "sensor": "ESP32",
        "activity": "ON"
      },
      {
        "sensor": "Barometru",
        "activity": "10 s (SD)"
      },
      {
        "sensor": "Senzori tensiune",
        "activity": "10 s (SD)"
      },
      {
        "sensor": "Senzori curent",
        "activity": "10 s (SD)"
      },
      {
        "sensor": "Modul backup (GPS + GSM + MCU) - doar gsm , nu comunica prin lora",
        "activity": "ON"
      },
      {
        "sensor": "Loguri Info (CPU, Memory, Voltaj Baterie, Curent, etc)",
        "activity": "10 s (SD)"
      },
      {
        "sensor": "Loguri Critice (Blocare task-uri, erori senzori, etc)",
        "activity": "La eveniment"
      },
      {
        "sensor": "Modul LoRa",
        "activity": "OFF"
      }
    ]
  },
  {
    "name": "photo",
    "rows": [
      {
        "sensor": "Senzor temperatura exterior",
        "activity": "10 s (SD)"
      },
      {
        "sensor": "Senzori temperatura interior",
        "activity": "10 s (SD)"
      },
      {
        "sensor": "Akida Chip",
        "activity": "OFF"
      },
      {
        "sensor": "Senzor lumina",
        "activity": "10 s (SD)"
      },
      {
        "sensor": "GPS",
        "activity": "10 s (SD)"
      },
      {
        "sensor": "Camera",
        "activity": "cate doua poze una dupa alta la 30 de secunde (SD)"
      },
      {
        "sensor": "IMU",
        "activity": "50 Hz(SD)"
      },
      {
        "sensor": "Raspberry Pi 5",
        "activity": "ON"
      },
      {
        "sensor": "ESP32",
        "activity": "ON"
      },
      {
        "sensor": "Accelerometru",
        "activity": "50 Hz (SD)"
      },
      {
        "sensor": "Barometru",
        "activity": "10 s (SD)"
      },
      {
        "sensor": "Senzori tensiune",
        "activity": "10 s (SD)"
      },
      {
        "sensor": "Senzori curent",
        "activity": "10 s (SD)"
      },
      {
        "sensor": "Modul backup (GPS + GSM + MCU) - doar gsm , nu comunica prin lora",
        "activity": "ON"
      },
      {
        "sensor": "Loguri Info (CPU, Memory, Voltaj Baterie, Curent, etc)",
        "activity": "10 s (SD)"
      },
      {
        "sensor": "Loguri Critice (Blocare task-uri, erori senzori, etc)",
        "activity": "La eveniment"
      },
      {
        "sensor": "Modul LoRa",
        "activity": "OFF"
      }
    ]
  },
  {
    "name": "processing",
    "rows": [
      {
        "sensor": "Senzor temperatura exterior",
        "activity": "10 s (SD)"
      },
      {
        "sensor": "Senzori temperatura interior",
        "activity": "10 s (SD)"
      },
      {
        "sensor": "Akida Chip",
        "activity": "ON"
      },
      {
        "sensor": "Senzor lumina",
        "activity": "10 s (SD)"
      },
      {
        "sensor": "GPS",
        "activity": "10 s (SD)"
      },
      {
        "sensor": "Camera",
        "activity": "OFF"
      },
      {
        "sensor": "IMU",
        "activity": "50 Hz (SD)"
      },
      {
        "sensor": "Raspberry Pi 5",
        "activity": "ON"
      },
      {
        "sensor": "ESP32",
        "activity": "ON"
      },
      {
        "sensor": "Accelerometru",
        "activity": "50 Hz (SD)"
      },
      {
        "sensor": "Barometru",
        "activity": "10 s (SD)"
      },
      {
        "sensor": "Senzori tensiune",
        "activity": "10 s (SD)"
      },
      {
        "sensor": "Senzori curent",
        "activity": "10 s (SD)"
      },
      {
        "sensor": "Modul backup (GPS + GSM + MCU) - doar gsm , nu comunica prin lora",
        "activity": "ON"
      },
      {
        "sensor": "Loguri Info (CPU, Memory, Voltaj Baterie, Curent, etc)",
        "activity": "10 s (SD)"
      },
      {
        "sensor": "Loguri Critice (Blocare task-uri, erori senzori, etc)",
        "activity": "La eveniment"
      },
      {
        "sensor": "Modul LoRa",
        "activity": "OFF"
      }
    ]
  },
  {
    "name": "transmission",
    "rows": [
      {
        "sensor": "Senzor temperatura exterior",
        "activity": "10 s (SD)"
      },
      {
        "sensor": "Senzori temperatura interior",
        "activity": "10 s (SD)"
      },
      {
        "sensor": "Akida Chip",
        "activity": "OFF"
      },
      {
        "sensor": "Senzor lumina",
        "activity": "10 s (SD)"
      },
      {
        "sensor": "GPS",
        "activity": "10 s (SD)"
      },
      {
        "sensor": "Camera",
        "activity": "OFF"
      },
      {
        "sensor": "IMU",
        "activity": "50 Hz (SD)"
      },
      {
        "sensor": "Raspberry Pi 5",
        "activity": "OFF"
      },
      {
        "sensor": "ESP32",
        "activity": "ON"
      },
      {
        "sensor": "Accelerometru",
        "activity": "50 Hz (SD)"
      },
      {
        "sensor": "Barometru",
        "activity": "10 s (SD)"
      },
      {
        "sensor": "Senzori tensiune",
        "activity": "10 s (SD)"
      },
      {
        "sensor": "Senzori curent",
        "activity": "10 s (SD)"
      },
      {
        "sensor": "Modul backup (GPS + GSM + MCU) - doar gsm , nu comunica prin lora",
        "activity": "ON"
      },
      {
        "sensor": "Loguri Info (CPU, Memory, Voltaj Baterie, Curent, etc)",
        "activity": "10 s (SD)"
      },
      {
        "sensor": "Loguri Critice (Blocare task-uri, erori senzori, etc)",
        "activity": "La eveniment"
      },
      {
        "sensor": "Modul LoRa",
        "activity": "ON"
      }
    ]
  },
  {
    "name": "safe",
    "rows": [
      {
        "sensor": "Senzor temperatura exterior",
        "activity": "OFF"
      },
      {
        "sensor": "Senzori temperatura interior",
        "activity": "60 s (SD), dar citim mai des ca sa stim cand iesim din mod. (la limita inferioara -10, facem caldura cu rasp; limita superioara 50 grade (60 e temp maxima de discharge))"
      },
      {
        "sensor": "Akida Chip",
        "activity": "OFF"
      },
      {
        "sensor": "Senzor lumina",
        "activity": "OFF"
      },
      {
        "sensor": "GPS",
        "activity": "60 s (SD)"
      },
      {
        "sensor": "Camera",
        "activity": "OFF"
      },
      {
        "sensor": "IMU",
        "activity": "OFF"
      },
      {
        "sensor": "Raspberry Pi 5",
        "activity": "OFF"
      },
      {
        "sensor": "ESP32",
        "activity": "ON"
      },
      {
        "sensor": "Accelerometru",
        "activity": "OFF"
      },
      {
        "sensor": "Barometru",
        "activity": "OFF"
      },
      {
        "sensor": "Senzori tensiune",
        "activity": "ON"
      },
      {
        "sensor": "Senzori curent",
        "activity": "ON"
      },
      {
        "sensor": "Modul backup (GPS + GSM + MCU) - doar gsm , nu comunica prin lora",
        "activity": "ON"
      },
      {
        "sensor": "Loguri Info (CPU, Memory, Voltaj Baterie, Curent, etc)",
        "activity": "ON"
      },
      {
        "sensor": "Loguri Critice (Blocare task-uri, erori senzori, etc)",
        "activity": "ON"
      },
      {
        "sensor": "Modul LoRa",
        "activity": "OFF"
      }
    ]
  },
  {
    "name": "recovery",
    "rows": [
      {
        "sensor": "Senzor temperatura exterior",
        "activity": "OFF"
      },
      {
        "sensor": "Senzori temperatura interior",
        "activity": "5 min (SD)"
      },
      {
        "sensor": "Akida Chip",
        "activity": "OFF"
      },
      {
        "sensor": "Senzor lumina",
        "activity": "OFF"
      },
      {
        "sensor": "GPS",
        "activity": "30 min (SD/TX)"
      },
      {
        "sensor": "Camera",
        "activity": "OFF"
      },
      {
        "sensor": "IMU",
        "activity": "OFF"
      },
      {
        "sensor": "Raspberry Pi 5",
        "activity": "OFF"
      },
      {
        "sensor": "ESP32",
        "activity": "ON"
      },
      {
        "sensor": "Barometru",
        "activity": "OFF"
      },
      {
        "sensor": "Senzori tensiune +curent",
        "activity": "5 min (SD)"
      },
      {
        "sensor": "Modul backup (GPS + GSM + MCU) - doar gsm , nu comunica prin lora",
        "activity": "ON"
      },
      {
        "sensor": "Loguri Info (CPU, Memory, Voltaj Baterie, Curent, etc)",
        "activity": "30 min (SD/TX)"
      },
      {
        "sensor": "Loguri Critice (Blocare task-uri, erori senzori, etc)",
        "activity": "OFF"
      },
      {
        "sensor": "Modul LoRa",
        "activity": "ON, transmite o data la 30 minute locatia."
      }
    ]
  }
];
