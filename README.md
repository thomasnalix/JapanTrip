# Japon

Application web Next.js + TypeScript + MapLibre GL JS + Upstash Redis pour préparer un voyage au Japon à deux (Nell & Thomas).

## Développement local (connecté à l'Upstash Redis de Vercel)

1. Installer les dépendances :
   ```bash
   npm install
   ```
2. Récupérer les variables d'environnement Vercel (dont votre base Upstash `japantrip`) :
   ```bash
   npx vercel env pull .env.local
   ```
3. Lancer le serveur de développement :
   ```bash
   npm run dev
   ```

## Stockage & Cache Redis

- **Données partagées** (`japantrip:data:v1`) : activités, liens, photos compressées, étapes et dates de voyage stockés dans Upstash Redis.
- **Cache météo** (`japantrip:climate:v2:...`) : réponses Open-Meteo mises en cache dans Upstash Redis (3h pour les prévisions, 24h pour l'archive) afin de ne pas solliciter les API météo à chaque chargement.
