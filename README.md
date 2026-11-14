# Půjčovna Žďár – web

Statický web (HTML/CSS/JS) + Supabase (tabulky `pj_*` v projektu Rodinný kalendář).

- `/` – veřejný web s rezervací
- `/sprava/` – aplikace pro správu rezervací (přihlášení Google, jen admin z `pj_admins`)
- `build.py` – generuje HTML stránky (úvod, detaily položek, podmínky, GDPR). Po úpravě textů spusť `python3 build.py` (výstup do `site/`, zkopírovat do kořene).
