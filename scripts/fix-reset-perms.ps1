docker compose exec -u root -T prestashop bash -lc "
  chown -R www-data:www-data /var/www/html && \
  chmod -R g+rwX /var/www/html/var /var/www/html/img /var/www/html/modules /var/www/html/themes && \
  rm -rf /var/www/html/var/cache/* || true
"
Write-Host "[✓] Permissions and cache cleared."
