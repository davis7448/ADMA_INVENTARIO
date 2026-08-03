"""Captura los pantallazos del manual desde la app real.

Para cada paso con `ruta`, entra a la pantalla, toma la captura y, para cada
anotación con `buscar`, ubica el elemento y calcula la posición del marcador en %
del ancho/alto de la imagen. Deja las imágenes en out/ y un manifest.json que
scripts/upload-manual-shots.ts sube a Storage y guarda en Firestore.

Uso: python3 scripts/capture-manual.py <out_dir> <manifest.json>
"""
import json
import os
import sys

from playwright.sync_api import sync_playwright

BASE = "https://main--studio-9748962172-82b35.us-east4.hosted.app"
# Un usuario por audiencia: las capturas muestran lo que ve cada equipo.
CUENTAS = {
    "comercial": ("capacitacion.comercial@adma.com.co", "AdmaGvMb03P8!24"),
    "logistica": ("capacitacion.logistica@adma.com.co", "Admawv8OQkYy!24"),
}
GUIAS_URL = BASE + "/api/manual-export"  # no existe: el contenido se lee del JSON de entrada


def login(page, email, password):
    page.goto(BASE + "/login", wait_until="domcontentloaded", timeout=60000)
    page.fill("#email", email)
    page.fill("#password", password)
    page.click("button[type=submit]")
    page.wait_for_timeout(6000)


def capturar(page, ruta, destino, anotaciones):
    """Navega, captura y devuelve las anotaciones con coordenadas en %."""
    page.goto(BASE + ruta, wait_until="domcontentloaded", timeout=60000)
    page.wait_for_timeout(7000)  # dar tiempo a que carguen los datos
    # Tamaño real de la captura (viewport)
    vp = page.viewport_size
    page.screenshot(path=destino)

    resueltas = []
    for a in anotaciones or []:
        item = {"numero": a["numero"], "texto": a["texto"]}
        buscar = a.get("buscar")
        if buscar:
            try:
                # Preferir elementos interactivos (pestaña, botón, enlace) antes que
                # cualquier texto suelto: evita señalar el elemento equivocado.
                box = None
                for hacer in (
                    lambda: page.get_by_role("tab", name=buscar, exact=False).first,
                    lambda: page.get_by_role("link", name=buscar, exact=False).first,
                    lambda: page.get_by_role("button", name=buscar, exact=False).first,
                    lambda: page.get_by_text(buscar, exact=True).first,
                    lambda: page.get_by_text(buscar, exact=False).first,
                ):
                    try:
                        b = hacer().bounding_box(timeout=1500)
                        if b and b["width"] > 0:
                            box = b
                            break
                    except Exception:
                        continue
                if box and box["width"] > 0:
                    cx = box["x"] + box["width"] / 2
                    cy = box["y"] + box["height"] / 2
                    # Solo si el elemento quedó dentro de la captura
                    if 0 <= cx <= vp["width"] and 0 <= cy <= vp["height"]:
                        item["x"] = round(cx / vp["width"] * 100, 2)
                        item["y"] = round(cy / vp["height"] * 100, 2)
            except Exception:
                pass  # sin coordenadas: se muestra solo en la lista bajo la imagen
        resueltas.append(item)
    return resueltas


def main():
    out_dir = sys.argv[1]
    manifest_path = sys.argv[2]
    guias = json.load(open(os.path.join(out_dir, "guias.json"), encoding="utf-8"))
    os.makedirs(out_dir, exist_ok=True)
    manifest = []

    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--no-sandbox"])
        for guia in guias:
            audiencia = guia["audiencia"] if guia["audiencia"] in CUENTAS else "comercial"
            email, password = CUENTAS[audiencia]
            ctx = browser.new_context(viewport={"width": 1440, "height": 900})
            page = ctx.new_page()
            login(page, email, password)
            print(f"== {guia['slug']} (usuario {audiencia}) ==", flush=True)

            for si, sec in enumerate(guia.get("secciones", [])):
                for pi, paso in enumerate(sec.get("pasos", [])):
                    ruta = paso.get("ruta")
                    if not ruta:
                        continue
                    nombre = f"{guia['slug']}-{si}-{pi}.png"
                    destino = os.path.join(out_dir, nombre)
                    try:
                        anots = capturar(page, ruta, destino, paso.get("anotaciones"))
                        manifest.append({
                            "slug": guia["slug"], "seccion": si, "paso": pi,
                            "archivo": nombre, "anotaciones": anots,
                        })
                        print(f"  ✔ {ruta} → {nombre}", flush=True)
                    except Exception as e:
                        print(f"  ✖ {ruta}: {e}", flush=True)
            ctx.close()
        browser.close()

    json.dump(manifest, open(manifest_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"\nManifest: {len(manifest)} capturas → {manifest_path}")


if __name__ == "__main__":
    main()
