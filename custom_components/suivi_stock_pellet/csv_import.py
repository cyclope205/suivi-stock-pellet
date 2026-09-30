"""CSV history importer for the Excel-style French pellet sheet."""
from __future__ import annotations
import csv
import io
import math
import re
import unicodedata
from datetime import date, datetime
from typing import Any

MONTHS={"janvier":1,"jan":1,"fevrier":2,"février":2,"fev":2,"fév":2,"mars":3,"avril":4,"avr":4,"mai":5,"juin":6,"juillet":7,"juil":7,"aout":8,"août":8,"septembre":9,"sept":9,"octobre":10,"oct":10,"novembre":11,"nov":11,"decembre":12,"décembre":12,"dec":12,"déc":12}

class CsvImportError(ValueError):
    """User-correctable CSV import error."""

def _repair_mojibake(value: Any) -> str:
    """Repair common UTF-8/Windows-1252 mojibake without altering normal text."""
    text = str(value or "").replace("\ufeff", "")
    if any(marker in text for marker in ("Ã", "Â", "â")):
        try:
            repaired = text.encode("latin1").decode("utf-8")
            if repaired != text:
                text = repaired
        except (UnicodeEncodeError, UnicodeDecodeError):
            pass
    return text

def _norm(value: Any) -> str:
    text=unicodedata.normalize("NFKD",_repair_mojibake(value).strip())
    return "".join(c for c in text if not unicodedata.combining(c)).lower()

def _number(value: Any) -> float|None:
    text=str(value or "").strip().replace("\xa0"," ").replace("€","").replace("EUR","").strip()
    if not text: return None
    text=re.sub(r"\s+","",text)
    if "," in text and "." in text:
        text=text.replace(".","").replace(",",".") if text.rfind(",")>text.rfind(".") else text.replace(",","")
    else: text=text.replace(",",".")
    try:
        number = float(text)
    except ValueError as err:
        raise CsvImportError(f"Valeur numérique invalide : {value!r}") from err
    if not math.isfinite(number):
        raise CsvImportError(f"Valeur numérique invalide : {value!r}")
    return number

def _date(value: Any) -> str:
    text=str(value or "").strip()
    for fmt in ("%d/%m/%Y","%d-%m-%Y","%Y-%m-%d","%d.%m.%Y"):
        try: return datetime.strptime(text,fmt).date().isoformat()
        except ValueError: pass
    raise CsvImportError(f"Date invalide : {value!r}")

def _season(value: str) -> str:
    m=re.fullmatch(r"(\d{4})-(\d{4})",value.strip())
    if not m or int(m.group(2))!=int(m.group(1))+1: raise CsvImportError(f"Saison invalide : {value!r}")
    return value.strip()

def _rows(text: str) -> list[list[str]]:
    raw_lines = text.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    non_empty = [line for line in raw_lines if line.strip()]
    pipe_table = bool(non_empty) and sum(
        line.lstrip().startswith("|") and line.rstrip().endswith("|")
        for line in non_empty[:50]
    ) >= max(1, len(non_empty[:50]) // 2)
    if pipe_table:
        raw_lines = [
            line.strip()[1:-1] if line.strip().startswith("|") and line.strip().endswith("|") else line
            for line in raw_lines
        ]
        text = "\n".join(raw_lines)
    sample=text[:8192]
    try: delimiter=csv.Sniffer().sniff(sample,delimiters=";,\t,").delimiter
    except csv.Error:
        delimiter=max((";","\t",","),key=sample.count)
    return list(csv.reader(io.StringIO(text),delimiter=delimiter))

def _month_number(value: Any) -> int | None:
    normalized = _norm(value)
    if normalized in MONTHS:
        return MONTHS[normalized]
    for name, month in MONTHS.items():
        if re.fullmatch(rf"{re.escape(name)}(?:\s+\d{{4}})?", normalized):
            return month
    return None

def _find_header(rows):
    for i,row in enumerate(rows):
        months={c:month for c,v in enumerate(row) if (month := _month_number(v)) is not None}
        if len(months)>=2:
            return i,months
        expanded=[]
        for cell in row:
            expanded.extend(re.split(r"[;,|]", str(cell or "")))
        found=[(idx,_month_number(value)) for idx,value in enumerate(expanded)]
        found=[item for item in found if item[1] is not None]
        if len(found)>=2:
            return i,{idx:month for idx,month in found}
    raise CsvImportError("En-tête des mois introuvable.")

def _find_event_log_header(rows):
    for i, row in enumerate(rows):
        keys = {_norm(value): col for col, value in enumerate(row)}
        if ("date" in keys and any("type" in key for key in keys) and any("quantite" in key for key in keys)):
            return i, keys
    return None

def _parse_event_log(rows, header_idx, keys, season_start_month):
    date_col = keys["date"]
    type_col = next(col for key, col in keys.items() if "type" in key)
    qty_col = next(col for key, col in keys.items() if "quantite" in key)
    price_col = next((col for key, col in keys.items() if "prix total" in key or key in {"prix","cout","coût"}), None)
    entries = []
    for row in rows[header_idx + 1:]:
        if len(row) <= max(date_col, type_col, qty_col): continue
        raw_date = str(row[date_col] or "").strip()
        if not raw_date or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", raw_date): continue
        event_type = _norm(row[type_col])
        if "consommation" in event_type: kind = "consumption"
        elif "achat" in event_type: kind = "purchase"
        else: continue
        qty = _number(row[qty_col])
        if qty is None or qty <= 0: continue
        entry_date = _date(raw_date)
        parsed_date = date.fromisoformat(entry_date)
        season = f"{parsed_date.year}-{parsed_date.year + 1}" if parsed_date.month >= season_start_month else f"{parsed_date.year - 1}-{parsed_date.year}"
        price = None
        if kind == "purchase":
            if price_col is not None and price_col < len(row): price = _number(row[price_col])
            if price is None: raise CsvImportError(f"Prix d'achat manquant pour {raw_date}.")
            if price < 0: raise CsvImportError(f"Prix d'achat invalide pour {raw_date}.")
        entries.append({"type": kind,"qty_bags": qty,"date": entry_date,"price_eur": price,"bag_weight_kg": None,"calorific_value": None,"season": season})
    if not entries: raise CsvImportError("Aucune consommation ou aucun achat exploitable.")
    entries.sort(key=lambda e: (e["date"], 0 if e["type"] == "purchase" else 1))
    return entries

def _find_season(rows,header_idx):
    for row in rows[:header_idx+2]:
        for value in row:
            m=re.search(r"(\d{4}-\d{4})",str(value or ""))
            if m: return _season(m.group(1))
    raise CsvImportError("Saison AAAA-AAAA introuvable.")

def parse_csv_history(text: str, *, default_season: str | None = None, season_start_month: int = 9) -> dict[str,Any]:
    if not text.strip(): raise CsvImportError("Le fichier CSV est vide.")
    if not 1 <= int(season_start_month) <= 12: raise CsvImportError("Mois de début de saison invalide.")
    rows=_rows(text)
    event_header = _find_event_log_header(rows)
    if event_header is not None:
        header_idx, keys = event_header
        entries = _parse_event_log(rows, header_idx, keys, int(season_start_month))
        return {"season": entries[0]["season"],"seasons": sorted({entry["season"] for entry in entries}),"entries": entries,"consumption_count": sum(e["type"] == "consumption" for e in entries),"purchase_count": sum(e["type"] == "purchase" for e in entries),"consumption_bags": sum(e["qty_bags"] for e in entries if e["type"] == "consumption"),"purchase_bags": sum(e["qty_bags"] for e in entries if e["type"] == "purchase")}
    header_idx,months=_find_header(rows)
    season=_season(default_season) if default_season else _find_season(rows,header_idx)
    start_year=int(season[:4])
    entries=[]
    for row in rows[header_idx+1:]:
        first=str(row[0] if row else "").strip()
        if not re.fullmatch(r"\d{1,2}",first): continue
        day=int(first)
        if not 1<=day<=31: continue
        for col,month in months.items():
            if col>=len(row): continue
            qty=_number(row[col])
            if qty is None or qty<=0: continue
            year=start_year if month>=int(season_start_month) else start_year+1
            try: d=date(year,month,day).isoformat()
            except ValueError as err: raise CsvImportError(f"Date impossible : {day:02d}/{month:02d}") from err
            entries.append({"type":"consumption","qty_bags":qty,"date":d,"price_eur":None,"bag_weight_kg":None,"calorific_value":None,"season":season})
    marker=None
    for i,row in enumerate(rows):
        if any("achat" in _norm(v) and "granul" in _norm(v) for v in row): marker=i; break
    if marker is not None:
        header=None
        for i in range(marker+1,min(marker+6,len(rows))):
            keys={_norm(v):c for c,v in enumerate(rows[i])}
            if ("date" in keys and any(k in keys for k in ("qte","qté","quantite","quantité"))): header=(i,keys); break
        if header:
            i,keys=header
            qc=next(keys[k] for k in ("qte","qté","quantite","quantité") if k in keys)
            pc=next((keys[k] for k in ("prix","cout","coût") if k in keys),None)
            for row in rows[i+1:]:
                if len(row)<=max(qc,keys["date"],pc or 0): continue
                qty=_number(row[qc])
                if qty is None or not str(row[keys["date"]]).strip(): continue
                price=_number(row[pc]) if pc is not None else None
                if price is None: raise CsvImportError(f"Prix d'achat manquant pour {row[keys['date']]}." )
                entries.append({"type":"purchase","qty_bags":qty,"date":_date(row[keys["date"]]),"price_eur":price,"bag_weight_kg":None,"calorific_value":None,"season":season})
    if not entries: raise CsvImportError("Aucune consommation ou aucun achat exploitable.")
    entries.sort(key=lambda e:(e["date"],0 if e["type"]=="purchase" else 1))
    return {"season":season,"entries":entries,"consumption_count":sum(e["type"]=="consumption" for e in entries),"purchase_count":sum(e["type"]=="purchase" for e in entries),"consumption_bags":sum(e["qty_bags"] for e in entries if e["type"]=="consumption"),"purchase_bags":sum(e["qty_bags"] for e in entries if e["type"]=="purchase")}
