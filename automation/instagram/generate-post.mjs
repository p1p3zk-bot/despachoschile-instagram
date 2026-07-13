import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const postDate = process.argv[2];

if (!postDate || !/^\d{4}-\d{2}-\d{2}$/.test(postDate)) {
  throw new Error("Debes indicar la fecha en formato AAAA-MM-DD.");
}

if (!process.env.OPENAI_API_KEY) {
  throw new Error("Falta el secreto OPENAI_API_KEY.");
}

const postsDirectory = path.resolve("posts");
const imagePath = path.join(postsDirectory, `${postDate}.jpg`);
const captionPath = path.join(postsDirectory, `${postDate}.caption.txt`);

await mkdir(postsDirectory, { recursive: true });

if (existsSync(imagePath) && existsSync(captionPath)) {
  const existingCaption = await readFile(captionPath, "utf8");
  console.log(`Se reutilizará la pieza existente de ${postDate}: ${existingCaption.length} caracteres.`);
  process.exit(0);
}

const creativeDirections = [
  "editorial streetwear studio, warm ivory backdrop, charcoal geometric shadows and a small acid-lime accent",
  "nighttime urban pavement after rain, cinematic reflections, deep charcoal and electric violet accents",
  "minimal product pedestal, soft daylight, sand and cream palette with crisp dark shadows",
  "energetic sports campaign, dynamic diagonal composition, cobalt blue and bright orange accents",
  "premium monochrome fashion editorial, black-on-black textures with a single white highlight",
  "colorful contemporary sneaker wall, clean graphic blocks, turquoise and coral accents",
  "weekend lifestyle still life, concrete and green grass textures, fresh natural light",
];

const captions = [
  "Un nuevo look para empezar la semana 👟 Revisa los modelos y tallas reales en el enlace de nuestro perfil. Escríbenos por WhatsApp para confirmar disponibilidad.\n\n#DespachosChile #ZapatillasChile #SneakersChile #ModaUrbana",
  "Tu próxima combinación comienza por los pies. Mira el catálogo en nuestro perfil y consulta tu talla por WhatsApp.\n\n#DespachosChile #ZapatillasChile #EstiloUrbano #SneakersChile",
  "Mitad de semana, estilo renovado ✨ Encuentra modelos disponibles y confirma tu número directamente con nosotros.\n\n#DespachosChile #ZapatillasChile #ModaChile #SneakersChile",
  "Detalles que cambian todo. Visita el catálogo del perfil y pregúntanos por tu talla favorita.\n\n#DespachosChile #CalzadoChile #ZapatillasChile #EstiloUrbano",
  "Se viene el fin de semana 👟 Revisa el stock disponible en nuestro catálogo y consulta por WhatsApp.\n\n#DespachosChile #SneakersChile #ZapatillasChile #LookDelDia",
  "Sábado de estrenar estilo. Descubre los modelos reales disponibles desde el enlace de nuestro perfil.\n\n#DespachosChile #ModaUrbana #ZapatillasChile #SneakersChile",
  "Inspírate hoy y elige tu próxima zapatilla. Modelos, fotos y tallas disponibles en nuestro catálogo.\n\n#DespachosChile #ZapatillasChile #EstiloChile #SneakersChile",
];

const dateSeed = Number(postDate.replaceAll("-", ""));
const direction = creativeDirections[dateSeed % creativeDirections.length];
const disclosure =
  "\n\nImagen referencial creada con IA. Consulta los modelos reales disponibles en nuestro catálogo.";
const caption = `${captions[dateSeed % captions.length]}${disclosure}`;

const prompt = `
Use case: ads-marketing
Asset type: vertical 4:5 Instagram feed image for @despachoschile2025
Primary request: create an original, high-impact retail image featuring one fashionable, completely unbranded sneaker concept.
Scene/backdrop: ${direction}.
Subject: a single original sneaker design as the clear hero product, fully visible, with realistic materials and a convincing retail-photo finish.
Composition/framing: vertical 4:5, centered product, strong thumbnail readability, generous safe margins, no cropped toe or heel.
Lighting/mood: polished commercial product photography, energetic and aspirational.
Constraints: no text inside the image; no price; no size labels; no watermark; no human face; no hands; no copyrighted character; no recognizable real-world sneaker model; no existing brand marks.
Avoid: Nike swoosh, Jordan mark, Adidas stripes, Puma mark, New Balance mark, brand names, store logos, distorted laces, duplicate shoes, extra footwear.
`;

const response = await fetch("https://api.openai.com/v1/images/generations", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "gpt-image-2",
    prompt,
    size: "1024x1280",
    quality: "medium",
    output_format: "jpeg",
    output_compression: 88,
  }),
});

if (!response.ok) {
  const errorText = await response.text();
  throw new Error(`OpenAI no pudo generar la imagen (${response.status}): ${errorText}`);
}

const payload = await response.json();
const base64Image = payload?.data?.[0]?.b64_json;

if (!base64Image) {
  throw new Error("OpenAI no devolvió datos de imagen.");
}

await writeFile(imagePath, Buffer.from(base64Image, "base64"));
await writeFile(captionPath, `${caption}\n`, "utf8");

console.log(`Pieza generada para ${postDate}.`);
