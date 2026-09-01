from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).parent
WIDTH, HEIGHT = 1280, 720
FONT = "/System/Library/Fonts/Supplemental/Arial.ttf"
BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"


def make_frame(name, title, subtitle, image=None, crop=None):
    canvas = Image.new("RGB", (WIDTH, HEIGHT), "white")
    draw = ImageDraw.Draw(canvas)
    draw.rectangle((0, 0, WIDTH, 82), fill="#198754")
    draw.text((42, 20), title, font=ImageFont.truetype(BOLD, 30), fill="white")

    if image:
        screenshot = Image.open(ROOT / image).convert("RGB")
        if crop:
            screenshot = screenshot.crop(crop)
        screenshot.thumbnail((WIDTH - 80, HEIGHT - 170))
        x = (WIDTH - screenshot.width) // 2
        y = 105 + (HEIGHT - 170 - screenshot.height) // 2
        canvas.paste(screenshot, (x, y))

    draw.rectangle((0, HEIGHT - 62, WIDTH, HEIGHT), fill="#f3f5f4")
    draw.text(
        (42, HEIGHT - 46),
        subtitle,
        font=ImageFont.truetype(FONT, 22),
        fill="#24322c",
    )
    canvas.save(ROOT / name)


make_frame(
    "frame-01.png",
    "Recepia · Integración oficial de WhatsApp",
    "La clínica inicia la conexión desde Ajustes → Integraciones.",
    "01-integraciones.png",
    (410, 150, 805, 750),
)
make_frame(
    "frame-02.png",
    "Embedded Signup · Modo de coexistencia",
    "La clínica comparte su cuenta de WhatsApp Business y mantiene activa la aplicación móvil.",
    "02-coexistencia-meta.png",
)
make_frame(
    "frame-03.png",
    "Atención conversacional en Recepia",
    "Los mensajes llegan por webhook y el asistente responde; el equipo puede intervenir.",
    "03-chat-respuesta.png",
)
make_frame(
    "frame-04.png",
    "Uso limitado y seguro de los datos",
    "Credenciales cifradas, separación por clínica y ningún uso publicitario.",
)
