import os
import subprocess
from faster_whisper import WhisperModel

_model_stt = None

def get_whisper_model():
    global _model_stt
    if _model_stt is None:
        try:
            # Subimos de "tiny" a "base" para una precisión excelente en español sin saturar la CPU
            _model_stt = WhisperModel("base", device="cpu", compute_type="int8")
        except Exception as e:
            print(f"Error cargando Whisper: {e}")
    return _model_stt

def speech_to_text(audio_path: str) -> str:
    """Convierte audio a texto usando faster-whisper (modelo base)."""
    try:
        model = get_whisper_model()
        if not model:
            return "Modelo Whisper no disponible."
        segments, info = model.transcribe(audio_path, beam_size=2, language="es")
        texto = " ".join([segment.text for segment in segments])
        return texto.strip()
    except Exception as e:
        return f"Error en STT: {str(e)}"

def text_to_speech(texto: str, output_path: str = "/tmp/response.wav") -> str:
    """Genera audio localmente usando Piper TTS."""
    try:
        cmd = f"echo '{texto}' | piper --model es_ES-sharvard-medium --output_file {output_path}"
        subprocess.run(cmd, shell=True, check=True)
        return output_path
    except Exception as e:
        return ""
