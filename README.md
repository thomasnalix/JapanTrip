# Japon — Carte & Planning (Nell & Thomas)

Application web simple et typée (Next.js + TypeScript + MapLibre GL JS + Zod) pour préparer notre voyage au Japon à deux, déployable gratuitement sur Vercel.

## Fonctionnalités

- **Carte plein écran du Japon** (couleurs chaleureuses OpenFreeMap *Washi & Terracotta*, zoom libre, bornée sur tout le Japon d'Okinawa à Hokkaido).
- **Onglet Activités** :
  - Ajout par **recherche** (Photon / OpenStreetMap Nominatim limité au Japon, auto-complétion du nom, description, adresse et catégorie).
  - Ajout **manuel** en cliquant directement sur la carte.
  - Filtres multi-catégories (`Restaurant`, `Café & Bar`, `Temple & Culture`, `Nature & Vue`, `Shopping`, `Hébergement`, `Transport`, `Expérience`, `Autre`).
  - Jauge circulaire de note (`0` à `5`) colorée selon la catégorie directement visible sur les marqueurs.
  - Édition à la volée : carrousel photo (URL ou import compressé), notes, prix, période idéale, jusqu'à 10 liens cliquables/supprimables.
  - **Identité Nell / Thomas** mémorisée à vie sans login + historique de qui a créé ou modifié chaque activité.
- **Onglet Étapes & Météo** :
  - Planification des grandes étapes (avions internes, Shinkansen/trains, ferries, bus, hôtels, étapes clés) avec tracés d'itinéraire.
  - Timeline en bas de l'écran alignée sur les dates de voyage des paramètres.
  - 4 couches cartographiques gratuites et mises en cache pilotées par la timeline : **Température**, **Momiji (紅葉)**, **Neige**, **Précipitations** (via Open-Meteo + courbe saisonnière Momiji).

## Développement local

```bash
npm install
npm run dev
```

En local sans base cloud configurée, les données sont sauvegardées automatiquement dans `data/trip-data.json`.

## Déploiement sur Vercel (gratuit + synchro Nell & Thomas)

1. Pousser le projet sur GitHub et l'importer sur [Vercel](https://vercel.com).
2. Dans Vercel (**Storage** ou **Marketplace**), créer une base **Upstash Redis** gratuite (ou **Vercel KV**) et la connecter au projet (cela ajoute `UPSTASH_REDIS_REST_URL` et `UPSTASH_REDIS_REST_TOKEN`).
3. Redéployer : Nell et Thomas partagent alors exactement les mêmes données en temps réel.
