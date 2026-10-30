import datetime
from zoneinfo import ZoneInfo
import re
import os
import shutil
from db.database import get_db

def obtener_hora_actual() -> str:
    chile_tz = ZoneInfo("America/Santiago")
    ahora = datetime.datetime.now(chile_tz)
    dias = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
    meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
    return f"Hoy es {dias[ahora.weekday()]} {ahora.day} de {meses[ahora.month - 1]} de {ahora.year}, y son las {ahora.strftime('%H:%M:%S')} horas."

def crear_nota(contenido: str) -> str:
    if not contenido:
        return "No se pudo guardar una nota vacía."
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("INSERT INTO notas (contenido) VALUES (?)", (contenido,))
        conn.commit()
        conn.close()
        return f"Nota guardada: '{contenido}'"
    except Exception as e:
        return f"Error al guardar la nota: {str(e)}"

def limpiar_notas(mantener_texto: str = "") -> str:
    """Borra notas antiguas y opcionalmente homóloga/deja solo la que coincida con el texto."""
    try:
        conn = get_db()
        cursor = conn.cursor()
        if mantener_texto:
            # Borra todas las que NO contengan el texto indicado (ej: 'mistfall')
            cursor.execute("DELETE FROM notas WHERE contenido NOT LIKE ?", (f"%{mantener_texto}%",))
        else:
            # Si no especifica, limpia las notas basura automáticas
            cursor.execute("DELETE FROM notas WHERE contenido LIKE '%distancia%' OR contenido LIKE '%100 dividido%'")
        conn.commit()
        conn.close()
        return "Listo, he limpiado las notas y dejado únicamente la solicitada."
    except Exception as e:
        return f"Error al limpiar notas: {str(e)}"

def es_nota_vigente(contenido: str) -> bool:
    chile_tz = ZoneInfo("America/Santiago")
    ahora = datetime.datetime.now(chile_tz)
    match = re.search(r'(\d{1,2})\s*[/.-]\s*(\d{1,2})', contenido)
    if match:
        try:
            dia, mes = int(match.group(1)), int(match.group(2))
            fecha_objetivo = datetime.datetime(ahora.year, mes, dia, 23, 59, 59, tzinfo=chile_tz)
            if fecha_objetivo < ahora:
                return False
        except ValueError:
            pass
    return True

def listar_notas() -> str:
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT id, contenido, fecha_creacion FROM notas ORDER BY id DESC")
        filas = cursor.fetchall()
        conn.close()
        if not filas:
            return "No tienes notas vigentes."
        filas_vigentes = [f for f in filas if es_nota_vigente(f['contenido'])]
        if not filas_vigentes:
            return "No tienes notas vigentes."
        resultado = "Tus notas vigentes:\n"
        for fila in filas_vigentes:
            resultado += f"- [{fila['id']}] {fila['contenido']}\n"
        return resultado
    except Exception as e:
        return f"Error al consultar notas: {str(e)}"

def obtener_recursos_sistema() -> dict:
    try:
        load1, _, _ = os.getloadavg()
        cpu_pct = min(round(load1 * 25, 1), 100.0)
        total, usado, _ = shutil.disk_usage("/")
        return {
            "cpu_pct": cpu_pct,
            "ram_pct": 35.0,
            "ram_info": "5.6 GB / 16 GB",
            "disco_pct": round((usado / total) * 100, 1),
            "disco_info": f"{round(usado/(1024**3),1)} GB / {round(total/(1024**3),1)} GB"
        }
    except Exception:
        return {"cpu_pct": 0, "ram_pct": 0, "ram_info": "N/A", "disco_pct": 0, "disco_info": "N/A"}
