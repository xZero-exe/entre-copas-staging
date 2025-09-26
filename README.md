# Entre Copas y Vinos - E-Commerce (PrestaShop 8.1 + Docker)

Este proyecto contiene la infraestructura y configuración para desplegar una tienda online de vinos y accesorios, utilizando:

- **PrestaShop 8.1** como CMS de e-commerce
- **MariaDB 10.6** como motor de base de datos
- **phpMyAdmin** como herramienta de administración de la base
- **Docker Compose** para la orquestación
- **AWS EC2** como entorno de despliegue en la nube

## Estructura
- `docker-compose.yml`: configuración principal de los servicios
- `.env`: variables de entorno (credenciales y parámetros de despliegue)
- `scripts/`: utilidades para backup/restore de la base de datos
- `nginx/`: configuración de proxy inverso (cuando se use HTTPS)

## Puertos
- **8080** → Frontend de la tienda (PrestaShop)
- **8081** → phpMyAdmin (restringir acceso a IPs seguras)

## Próximos pasos
- Configuración en puerto 80/443
- SSL con Let's Encrypt
- Migración a dominio propio

