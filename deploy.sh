#!/bin/bash

set -e

echo "🔄 Mise à jour du code..."
git pull origin wisdomx


echo "🏗️ Build AdonisJS..."
node ace build  --ignore-ts-errors

echo "📦 Installation des dépendances..."
cd build
npm ci --omit=dev
echo "📁 Copie du .env vers build/..."
cd ..
cp .env build/.env

echo "♻️ Reload PM2..."
pm2 reload all

echo "✅ Déploiement terminé avec succès"
