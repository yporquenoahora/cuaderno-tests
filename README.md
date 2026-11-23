# Cuaderno de test

App estática para preparar las pruebas de Inspección de Servicios Sociales de la Comunidad de Madrid. Funciona con HTML, CSS y JavaScript, sin instalación ni compilación.

## Abrir o publicar

- En local, descomprime el ZIP y abre `index.html` en el navegador.
- Para GitHub Pages, sube el contenido del ZIP a la raíz de la rama `main`, con `index.html` en esa raíz. En **Settings → Pages → Build and deployment**, selecciona **Deploy from a branch**, rama **main**, carpeta **/(root)** y guarda. Conserva `.nojekyll` si subes los archivos mediante Git.
- La publicación pone el banco de preguntas y respuestas a disposición de cualquiera que pueda acceder a la página. El OCR incluye un aviso de reproducción del material original. Comprueba que tienes permiso para divulgarlo antes de publicar.

## Estudiar

En **Configurar test**, elige uno o varios temas, mezcla un bloque o combina los dos. Indica cuántas preguntas quieres o deja el campo vacío para usar todas. Puedes elegir una penalización por fallo o escribir un valor personalizado. Puedes avanzar, volver atrás y cambiar tus respuestas hasta pulsar **Finalizar**. El resultado muestra aciertos, fallos y preguntas en blanco, junto con el porcentaje de aciertos, la puntuación neta, la nota estimada sobre 10 y el desglose por tema. También permite consultar la respuesta de la plantilla de cada pregunta.

La puntuación neta es aciertos menos fallos por penalización. La nota es la puntuación neta dividida por el total de preguntas y multiplicada por 10, con un mínimo de cero. Las preguntas en blanco valen cero.

Los fallos permanecen en el repaso hasta acertarlos. Puedes marcar preguntas para volver a ellas. El progreso y la última sesión se guardan en el almacenamiento local del navegador.

## Banco de preguntas

El bloque general contiene 240 preguntas y usa la clave incluida en el texto. El específico tiene 455 y usa el CSV. En este último hay tres discrepancias con el texto (13/8, 14/8 y 25/18). Puedes ver ambas letras y la página de soluciones desde la app. Estas tres preguntas quedan fuera de la puntuación.

El banco mantiene el contenido de los adjuntos, con correcciones de segmentación y etiquetas de OCR. Puede conservar erratas de transcripción. La plantilla del bloque específico estaba marcada como pendiente de segunda revisión.

Para corregir una pregunta, localízala en `data.js` por su campo `id`, por ejemplo `especifico-13-8`. Ajusta el texto, las opciones o la letra minúscula en `correct`. Para habilitar una pregunta revisada en los tests, cambia `issue` a `false`.
