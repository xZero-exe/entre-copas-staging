#!/usr/bin/env bash
set -euo pipefail

# --- Config ---
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="$PROJECT_DIR/backups"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
COMMIT_MSG="${1:-chore: deploy $TIMESTAMP}"

# --- Helpers ---
die() { echo "ERROR: $*" >&2; exit 1; }

# --- Pre-chequeos ---
command -v git >/dev/null || die "git no está instalado."
command -v docker-compose >/dev/null || die "docker-compose no está instalado."
[ -f "$PROJECT_DIR/docker-compose.yml" ] || die "No encuentro docker-compose.yml en $PROJECT_DIR"

# --- Detectar DB ---
DB_NAME="prestashop"
if [ -f "$PROJECT_DIR/.env" ]; then
  # lee DB_NAME= o MARIADB_DATABASE=
  DB_NAME_ENV="$(grep -E '^(DB_NAME|MARIADB_DATABASE)=' "$PROJECT_DIR/.env" | tail -n1 | cut -d= -f2- | tr -d '"')"
  if [ -n "${DB_NAME_ENV:-}" ]; then DB_NAME="$DB_NAME_ENV"; fi
fi

# --- Variables de contenedor ---
# Requiere que tengas MARIADB_ROOT_PASSWORD en el contenedor (como ya lo tienes en compose)
echo "🔎 Base de datos a respaldar: $DB_NAME"

# --- Preparar carpetas/ignorar backups ---
mkdir -p "$BACKUP_DIR"
# Asegura que los backups no se suban a git
if ! grep -qE '(^|/)\.env$' "$PROJECT_DIR/.gitignore" 2>/dev/null || \
   ! grep -q '\*.sql' "$PROJECT_DIR/.gitignore" 2>/dev/null || \
   ! grep -q '\*.tar.gz' "$PROJECT_DIR/.gitignore" 2>/dev/null || \
   ! grep -q '^backups/' "$PROJECT_DIR/.gitignore" 2>/dev/null || \
   ! grep -q '^ps_data/' "$PROJECT_DIR/.gitignore" 2>/dev/null || \
   ! grep -q '^db_data/' "$PROJECT_DIR/.gitignore" 2>/dev/null; then
  {
    echo ".env"
    echo "*.sql"
    echo "*.tar.gz"
    echo "backups/"
    echo "ps_data/"
    echo "db_data/"
    echo ".DS_Store"
  } >> "$PROJECT_DIR/.gitignore"
fi

# --- Backup DB ---
DB_DUMP="$BACKUP_DIR/db_${DB_NAME}_${TIMESTAMP}.sql"
echo "💾 Backup DB -> $DB_DUMP"
docker-compose exec -T mariadb mysqldump -uroot -p"$MARIADB_ROOT_PASSWORD" "$DB_NAME" > "$DB_DUMP"

# --- Backup de archivos del proyecto (snapshot) ---
FILES_TAR="$BACKUP_DIR/files_${TIMESTAMP}.tar.gz"
echo "📦 Backup de archivos -> $FILES_TAR"
# Empaquetamos TODO el proyecto excepto los volúmenes montados (ya ignorados) y la carpeta backups
tar --exclude="backups" --exclude="ps_data" --exclude="db_data" -czf "$FILES_TAR" -C "$PROJECT_DIR" .

# --- Git init si hace falta ---
if [ ! -d "$PROJECT_DIR/.git" ]; then
  echo "🧰 Inicializando repo Git..."
  git init
fi

# --- Verificar remoto 'origin' ---
if ! git -C "$PROJECT_DIR" remote get-url origin >/dev/null 2>&1; then
  echo "⚠️  No tienes remoto 'origin' configurado."
  echo "    Añádelo con:"
  echo "      git remote add origin git@github.com:<user>/entre-copas-staging.git"
  echo "    o con HTTPS:"
  echo "      git remote add origin https://github.com/<user>/entre-copas-staging.git"
  die "Agrega el remoto y re-ejecuta ./deploy.sh"
fi

# --- Rama main asegurada ---
git -C "$PROJECT_DIR" add .gitignore
# Si estás en detached HEAD, crea/cámbiate a main
current_branch="$(git -C "$PROJECT_DIR" rev-parse --abbrev-ref HEAD || echo detached)"
if [ "$current_branch" = "HEAD" ] || [ "$current_branch" = "detached" ]; then
  echo "🌿 Creando/cambiando a rama main (estabas en detached HEAD)..."
  git -C "$PROJECT_DIR" branch -f main
  git -C "$PROJECT_DIR" switch -f main 2>/dev/null || git -C "$PROJECT_DIR" checkout -f main
else
  # renombra a main si no lo es
  if [ "$current_branch" != "main" ]; then
    git -C "$PROJECT_DIR" branch -M main
  fi
fi

# --- Commit & Push ---
echo "✅ Commit: $COMMIT_MSG"
git -C "$PROJECT_DIR" add .
git -C "$PROJECT_DIR" commit -m "$COMMIT_MSG" || echo "ℹ️  No hay cambios para commitear."

echo "🚀 Push a origin/main"
# Primer push puede requerir -u
if ! git -C "$PROJECT_DIR" rev-parse --abbrev-ref --symbolic-full-name @{u} >/dev/null 2>&1; then
  git -C "$PROJECT_DIR" push -u origin main
else
  git -C "$PROJECT_DIR" push origin main
fi

echo "✨ Done. Backups en: $BACKUP_DIR"
