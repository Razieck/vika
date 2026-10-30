OLLAMA_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "crear_nota",
            "description": "ESTRICTAMENTE PROHIBIDO usar esta herramienta para responder preguntas de ciencia, matemáticas, trivia o cultura general. USAR ÚNICAMENTE si el usuario dice literalmente la orden 'anota' o 'guarda la nota'.",
            "parameters": {
                "type": "object",
                "properties": {
                    "contenido": {
                        "type": "string",
                        "description": "El contenido exacto que el usuario pidió anotar."
                    }
                },
                "required": ["contenido"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "listar_notas",
            "description": "USAR ÚNICAMENTE si el usuario pide explícitamente 'muéstrame mis notas' o 'qué notas tengo'. PROHIBIDO usar para preguntas generales o los estados de la materia.",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    }
]
