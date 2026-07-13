# Publicación automática de @despachoschile2025

Esta automatización genera una imagen original y publica una pieza diaria a las
19:15 en la zona `America/Santiago`, incluso cuando el computador está apagado.

## Flujo

1. GitHub Actions inicia la tarea diaria.
2. OpenAI `gpt-image-2` genera una imagen vertical 4:5 sin marcas ni texto.
3. La imagen se guarda en el repositorio público para que Meta pueda descargarla.
4. Instagram crea el contenedor y publica el post.
5. Se guarda un comprobante para evitar publicaciones duplicadas.
6. El token de Instagram se renueva periódicamente y se guarda cifrado.

## Requisito del repositorio

El repositorio debe ser público para que Instagram pueda acceder a la imagen
mediante `raw.githubusercontent.com`. El código puede ser público; las
credenciales nunca se guardan en archivos y deben permanecer en GitHub Secrets.

## Secretos necesarios

- `OPENAI_API_KEY`: clave de la API de OpenAI con facturación habilitada.
- `IG_ACCESS_TOKEN`: token autorizado de Instagram Login.
- `IG_USER_ID`: identificador numérico de la cuenta profesional de Instagram.
- `TOKEN_ENCRYPTION_KEY`: clave aleatoria de 32 bytes en base64 para proteger el
  token renovado. Se puede generar con `openssl rand -base64 32`.

El token de Instagram debe contar con los permisos
`instagram_business_basic` e `instagram_business_content_publish`.

## Activación

1. Crear un repositorio público y subir estos archivos.
2. Añadir los cuatro secretos en **Settings → Secrets and variables → Actions**.
3. Ejecutar manualmente el workflow una vez para validar la conexión.
4. Confirmar que el post aparece en Instagram. Después de esa prueba, la tarea
   continuará automáticamente cada día.

Nunca se debe incluir una contraseña, clave o token dentro de un archivo,
comentario, issue o mensaje de chat.
