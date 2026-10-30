import re
from tools.functions import obtener_hora_actual

def procesar_intencion_rapida(mensaje: str) -> str:
    """Enrutador rápido con regex estrictas para evitar que intercepte preguntas generales."""
    m = mensaje.lower().strip()
    
    # Solo interceptar si el usuario pide explícitamente y de forma directa la hora
    if re.search(r'\b(que hora es|hora actual|que hora son|dime la hora)\b', m):
        return obtener_hora_actual()
        
    # Si no es una consulta exacta de hora, retornar None para que pase a Ollama (llama3.2)
    return None
