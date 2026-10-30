import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "vika.db")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # Permite acceder a las columnas por nombre
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    
    # Tabla para notas y recordatorios
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS notas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            contenido TEXT NOT NULL,
            fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Tabla para el historial del chat
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS chat_historial (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    conn.commit()
    conn.close()

# Inicializar la BD al arrancar el módulo
init_db()
