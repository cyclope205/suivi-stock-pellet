# Suivi Stock Pellet

![Release](https://img.shields.io/github/v/release/cyclope205/suivi-stock-pellet)
![Build](https://img.shields.io/github/actions/workflow/status/cyclope205/suivi-stock-pellet/validate.yml?branch=main)
![License](https://img.shields.io/badge/license-MIT-blue.svg)
![HACS](https://img.shields.io/badge/HACS-Custom-orange.svg)

Intégration Home Assistant pour suivre le stock, la consommation et les achats de granulés de bois (pellets), avec une carte Lovelace clé en main.

## Fonctionnalités

- Suivi du stock en temps réel (kg et sacs), calculé à partir d'un journal d'achats/consommations — jamais de compteur qui dérive.
- Capteur d'énergie consommée en kWh (`device_class: energy`, `state_class: total_increasing`) compatible avec le tableau de bord Énergie de Home Assistant, comme source "Gaz/Autre".
- Suivi des dépenses (€) et du nombre de jours d'utilisation, par saison de chauffe.
- Saisons calculées automatiquement à partir d'un mois de départ configurable (pas d'années codées en dur à ajouter chaque année).
- Carte Lovelace intégrée (`custom:suivi-stock-pellet-card`) : stock en un coup d'œil, boutons "+ Consommation" / "+ Achat", annulation de la dernière saisie, historique des dernières entrées. Aucune ressource à ajouter manuellement, la carte est servie par l'intégration.

## Installation

### Via HACS (dépôt personnalisé)

1. HACS → menu (⋮) → **Dépôts personnalisés**.
2. URL : `https://github.com/cyclope205/suivi-stock-pellet`, catégorie **Intégration**.
3. Installer **Suivi Stock Pellet**, puis redémarrer Home Assistant.
4. **Paramètres → Appareils et services → Ajouter une intégration** → rechercher "Suivi Stock Pellet".

### Configuration

À l'ajout de l'intégration :

| Paramètre | Description | Défaut |
|---|---|---|
| Poids d'un sac | Poids d'un sac de granulés (kg) | 15 |
| Prix moyen d'un sac | Utilisé comme référence (le prix réel peut être saisi à chaque achat) | 6.5 € |
| Pouvoir calorifique | kWh par kg de granulés, pour le calcul énergie | 4.8 |
| Mois de début de saison | Mois à partir duquel une nouvelle saison de chauffe commence | 9 (septembre) |

Ces valeurs sont modifiables ensuite via **Configurer** sur l'intégration.

## Utilisation

Ajoute la carte à un tableau de bord :

```yaml
type: custom:suivi-stock-pellet-card
```

Ou utilise directement les services :

- `suivi_stock_pellet.log_consumption` (`qty_bags`, `date` facultative)
- `suivi_stock_pellet.log_purchase` (`qty_bags`, `price_eur` facultatif, `date` facultative)
- `suivi_stock_pellet.undo_last_entry`

## Entités créées

- `sensor.*_stock` — stock actuel (kg), avec le nombre de sacs et la saison en attributs
- `sensor.*_consomme_kg` — consommé cette saison (kg)
- `sensor.*_consomme_kwh` — énergie consommée cette saison (kWh, tableau de bord Énergie)
- `sensor.*_achete_kg` — acheté cette saison (kg)
- `sensor.*_depense` — dépensé cette saison (€)
- `sensor.*_jours_utilisation` — nombre de jours de consommation enregistrés

## Licence

MIT
