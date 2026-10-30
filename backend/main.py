from fastapi import FastAPI, Query, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import urllib.request
import json
import httpx
import shutil
import os
import re

from db.database import get_db
from services.voice import speech_to_text, text_to_speech
from tools.functions import obtener_hora_actual, crear_nota, listar_notas, limpiar_notas, es_nota_vigente, obtener_recursos_sistema

app = FastAPI(title="Vika Backend Core", version="4.3")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OLLAMA_URL = "http://127.0.0.1:11434"

@app.get("/api/clima")
def get_clima():
    try:
        url = "https://wttr.in/La+Florida,Chile?format=j1"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=3) as response:
            data = json.loads(response.read().decode())
            current = data['current_condition'][0]
            return {
                "temperatura_c": current['temp_C'],
                "humedad_pct": current['humidity'],
                "ubicacion": "La Florida, Chile"
            }
    except Exception as e:
        return {"error": str(e), "temperatura_c": "--", "humedad_pct": "--", "ubicacion": "La Florida, Chile"}

@app.get("/api/finanzas")
def get_finanzas():
    try:
        with urllib.request.urlopen("https://mindicador.cl/api", timeout=3) as response:
            data = json.loads(response.read().decode())
            return {
                "dolar": data['dolar']['valor'],
                "uf": data['uf']['valor']
            }
    except Exception as e:
        return {"error": str(e), "dolar": "---", "uf": "---"}

@app.get("/api/llm/estado")
def estado_llm():
    try:
        req = urllib.request.Request(f"{OLLAMA_URL}/api/tags")
        with urllib.request.urlopen(req, timeout=2) as response:
            data = json.loads(response.read().decode())
            modelos = [m["name"] for m in data.get("models", [])]
            return {"status": "online", "modelos": modelos}
    except Exception:
        return {"status": "offline", "modelos": []}

@app.get("/api/recursos")
def get_recursos():
    return obtener_recursos_sistema()

@app.get("/api/notas")
def get_notas():
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT id, contenido, fecha_creacion FROM notas ORDER BY id DESC")
        filas = cursor.fetchall()
        conn.close()
        return [{"id": f["id"], "contenido": f["contenido"], "fecha": f["fecha_creacion"]} for f in filas if es_nota_vigente(f["contenido"])]
    except Exception:
        return []

@app.get("/api/chat/historial")
def get_chat_historial():
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT role, content FROM chat_historial ORDER BY id ASC")
        filas = cursor.fetchall()
        conn.close()
        return [{"role": f["role"], "content": f["content"]} for f in filas]
    except Exception:
        return []

@app.post("/api/stt")
async def endpoint_stt(file: UploadFile = File(...)):
    temp_file = f"/tmp/{file.filename}"
    with open(temp_file, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    texto = speech_to_text(temp_file)
    if os.path.exists(temp_file):
        os.remove(temp_file)
    return {"texto": texto}

@app.post("/api/tts")
async def endpoint_tts(texto: str = Query(...)):
    audio_path = f"/tmp/response.wav"
    path_generado = text_to_speech(texto, audio_path)
    if path_generado and os.path.exists(path_generado):
        return FileResponse(path_generado, media_type="audio/wav")
    return {"error": "No se pudo generar el audio"}

@app.post("/api/chat")
async def chat_endpoint(mensaje: str = Query(...)):
    mensaje_limpio = re.sub(r'^(vika|bica|bika|vica|brica|pika|pika)[\s,\?-]*', '', mensaje.lower().strip())
    if not mensaje_limpio:
        mensaje_limpio = mensaje

    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("INSERT INTO chat_historial (role, content) VALUES (?, ?)", ("user", mensaje))
        conn.commit()
        conn.close()
    except Exception:
        pass

    texto_respuesta = ""
    
    if re.search(r'\b(que hora es|hora actual|que hora son|dime la hora)\b', mensaje_limpio):
        texto_respuesta = obtener_hora_actual()
    elif re.search(r'\b(muestra mis notas|mis notas|que notas tengo|ver notas)\b', mensaje_limpio):
        texto_respuesta = listar_notas()
    elif re.search(r'\b(borra|limpia|elimina).*(nota|notas)\b', mensaje_limpio):
        if "mistfall" in mensaje_limpio:
            texto_respuesta = limpiar_notas("mistfall")
        else:
            texto_respuesta = limpiar_notas("revisar")
    elif re.search(r'\b(anota|apunta|guarda nota|crea nota)\b', mensaje_limpio):
        contenido_nota = re.sub(r'^(anota|apunta|guarda nota|crea nota)[\s,/-]*', '', mensaje_limpio).strip()
        if contenido_nota:
            texto_respuesta = crear_nota(contenido_nota)
        else:
            texto_respuesta = "¿Qué te gustaría que anote?"
    else:
        system_prompt = (
            "Eres Vika, un asistente personal inteligente y conciso en un homelab. "
            "Responde de manera directa, clara y estructurada, evitando respuestas excesivamente largas para no saturar el sistema."
        )
        payload = {
            "model": "llama3.2:latest",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": mensaje_limpio}
            ],
            "stream": False,
            "options": {
                "num_thread": 6,
                "temperature": 0.3,
                "num_predict": 350  # Límite óptimo de tokens para fluidez en CPU
            }
        }
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(f"{OLLAMA_URL}/api/chat", json=payload)
                if response.status_code == 200:
                    data = response.json()
                    texto_respuesta = data.get("message", {}).get("content", "Sin respuesta del modelo.")
                else:
                    texto_respuesta = f"Error en Ollama (Código {response.status_code})"
        except Exception as e:
            texto_respuesta = f"Error de conexión con el cerebro de IA (Timeout)."

    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("INSERT INTO chat_historial (role, content) VALUES (?, ?)", ("vika", texto_respuesta))
        conn.commit()
        conn.close()
    except Exception:
        pass

    return {"respuesta": texto_respuesta}
