"use client";
import { useEffect, useState, useRef } from "react";

export default function Home() {
  const [clima, setClima] = useState<any>(null);
  const [finanzas, setFinanzas] = useState<any>(null);
  const [llm, setLlm] = useState<any>(null);
  const [recursos, setRecursos] = useState<any>(null);
  
  const [hora, setHora] = useState("");
  const [fecha, setFecha] = useState("");
  const [montado, setMontado] = useState(false);

  const [mensaje, setMensaje] = useState("");
  const [chat, setChat] = useState<{role: string, content: string}[]>([]);
  const [escribiendo, setEscribiendo] = useState(false);
  const [grabando, setGrabando] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const [diasMes, setDiasMes] = useState<any[]>([]);
  const [mesActual, setMesActual] = useState("");
  const diasSemana = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'];
  const [notas, setNotas] = useState<{id: number, contenido: string, fecha: string}[]>([]);

  const fetchNotas = async () => {
    try {
      const res = await fetch("/api/notas");
      if (res.ok) {
        const data = await res.json();
        setNotas(data);
      }
    } catch (err) { console.error("Error al cargar notas"); }
  };

  const fetchHistorialChat = async () => {
    try {
      const res = await fetch("/api/chat/historial");
      if (res.ok) {
        const data = await res.json();
        setChat(data);
      }
    } catch (err) { console.error("Error al cargar historial"); }
  };

  const fetchRecursos = async () => {
    try {
      const res = await fetch("/api/recursos");
      if (res.ok) {
        const data = await res.json();
        setRecursos(data);
      }
    } catch (err) { console.error("Error al cargar recursos"); }
  };

  useEffect(() => {
    setMontado(true);
    fetchNotas();
    fetchHistorialChat();
    fetchRecursos();

    const intervaloRecursos = setInterval(fetchRecursos, 5000);

    const actualizarReloj = () => {
      const ahora = new Date();
      setHora(ahora.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
      const opcionesFecha: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
      let fechaString = ahora.toLocaleDateString('es-CL', opcionesFecha);
      setFecha(fechaString.charAt(0).toUpperCase() + fechaString.slice(1));
    };
    actualizarReloj();
    const intervaloReloj = setInterval(actualizarReloj, 1000);

    const hoy = new Date();
    const mesStr = hoy.toLocaleString('es-CL', { month: 'long', year: 'numeric' });
    setMesActual(mesStr.charAt(0).toUpperCase() + mesStr.slice(1));
    const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1).getDay();
    const totalDias = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
    const dias = Array(primerDia).fill(null).concat(Array.from({length: totalDias}, (_, i) => i + 1));
    setDiasMes(dias);

    const fetchSeguro = async (url: string, setter: any) => {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setter(data);
        }
      } catch (err) { console.error(`Error al cargar ${url}`); }
    };

    fetchSeguro("/api/clima", setClima);
    fetchSeguro("/api/finanzas", setFinanzas);
    fetchSeguro("/api/llm/estado", setLlm);

    return () => {
      clearInterval(intervaloReloj);
      clearInterval(intervaloRecursos);
    };
  }, []);

  const iniciarGrabacion = async () => {
    audioChunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const formData = new FormData();
        formData.append("file", audioBlob, "grabacion.wav");

        setEscribiendo(true);
        try {
          const res = await fetch("/api/stt", { method: "POST", body: formData });
          if (res.ok) {
            const data = await res.json();
            if (data.texto) {
              setMensaje(data.texto);
            }
          }
        } catch (err) {
          console.error("Error al procesar audio en STT");
        }
        setEscribiendo(false);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setGrabando(true);
    } catch (err) {
      alert("No se pudo acceder al micrófono del navegador.");
    }
  };

  const detenerGrabacion = () => {
    if (mediaRecorderRef.current && grabando) {
      mediaRecorderRef.current.stop();
      setGrabando(false);
    }
  };

  const reproducirAudioVika = async (texto: string) => {
    try {
      const res = await fetch(`/api/tts?texto=${encodeURIComponent(texto)}`, { method: "POST" });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.play();
      }
    } catch (err) {
      console.error("Error al reproducir audio TTS");
    }
  };

  const enviarMensaje = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mensaje.trim()) return;

    const mensajeOriginal = mensaje;
    const nuevoChat = [...chat, { role: "user", content: mensajeOriginal }];
    setChat(nuevoChat);
    setMensaje("");
    setEscribiendo(true);

    try {
      const res = await fetch(`/api/chat?mensaje=${encodeURIComponent(mensajeOriginal)}`, { method: "POST" });
      if (!res.ok) throw new Error("Error interno");

      const data = await res.json();
      let respuestaVika = data.respuesta;
      
      fetchNotas();
      fetchHistorialChat();

      setChat([...nuevoChat, { role: "vika", content: respuestaVika }]);
      reproducirAudioVika(respuestaVika);
    } catch (err) {
      setChat([...nuevoChat, { role: "vika", content: "Error de conexión con el cerebro de IA." }]);
    }
    setEscribiendo(false);
  };

  const glassCard = "bg-gray-900/40 backdrop-blur-xl border border-gray-700/50 rounded-3xl p-6 shadow-2xl transition-all duration-300";

  return (
    <div suppressHydrationWarning className="min-h-screen bg-[#0B0C10] text-gray-200 p-6 md:p-10 font-sans pb-24 selection:bg-cyan-500/30">
      
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 tracking-tight">
            Proyecto Vika
          </h1>
          <p className="text-gray-400 mt-2 text-sm uppercase tracking-widest font-semibold">Panel de Control Central (Voz Integrada)</p>
        </div>
        <div className="hidden md:flex items-center gap-3">
           <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
          </span>
          <span className="text-sm text-cyan-500 font-mono">SISTEMA EN LÍNEA</span>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-6">
        
        <div className={`${glassCard} hover:border-cyan-500/30 flex flex-col justify-center items-center text-center group`}>
          <h2 className="text-xs font-semibold mb-2 text-cyan-400/80 uppercase tracking-widest">Hora Local</h2>
          {montado ? (
            <>
              <div className="text-5xl font-light text-white tracking-tight font-mono group-hover:text-cyan-50 transition-colors drop-shadow-md whitespace-nowrap">
                {hora}
              </div>
              <div className="text-gray-400 mt-2 text-xs">{fecha}</div>
            </>
          ) : <div className="animate-pulse w-32 h-12 bg-gray-700/30 rounded-lg mt-2"></div>}
        </div>

        <div className={`${glassCard} hover:border-orange-500/30 flex flex-col justify-center`}>
          {clima ? (
            <div className="flex justify-between items-center gap-2">
              <div>
                <div className="flex items-start">
                  <span className="text-4xl font-light text-white tracking-tighter">{clima.temperatura_c}</span>
                  <span className="text-lg mt-1 text-gray-500">°C</span>
                </div>
                <p className="text-xs text-white font-medium mt-1">{clima.ubicacion}</p>
              </div>
              <div className="text-right">
                <span className="text-4xl">☀️</span>
                <p className="text-[10px] text-gray-400 mt-1">Humedad: {clima.humedad_pct}%</p>
              </div>
            </div>
          ) : <p className="text-gray-500 animate-pulse text-xs text-center">Sincronizando clima...</p>}
        </div>

        <div className={`${glassCard} hover:border-green-500/30 flex flex-col justify-center`}>
          <h2 className="text-xs font-semibold mb-2 text-green-400/80 uppercase tracking-widest">Finanzas (Chile)</h2>
          {finanzas ? (
            <div>
              <p className="text-lg font-light text-white tracking-tight">Dólar: <span className="font-medium">${finanzas.dolar}</span></p>
              <p className="text-xs text-gray-400 mt-1">UF: <span className="text-gray-300">${finanzas.uf}</span></p>
            </div>
          ) : <p className="text-gray-500 animate-pulse text-xs">Consultando...</p>}
        </div>

        <div className={`${glassCard} hover:border-blue-500/30 flex flex-col justify-center`}>
          <h2 className="text-xs font-semibold mb-3 text-blue-400/80 uppercase tracking-widest flex items-center justify-between">
            <span>Servidor LXC</span>
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping"></span>
          </h2>
          {recursos ? (
            <div className="space-y-2 text-xs font-mono">
              <div>
                <div className="flex justify-between text-[11px] mb-0.5 text-gray-300">
                  <span>CPU</span><span>{recursos.cpu_pct}%</span>
                </div>
                <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-blue-500 h-full transition-all duration-500" style={{ width: `${Math.min(recursos.cpu_pct, 100)}%` }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[11px] mb-0.5 text-gray-300">
                  <span>RAM ({recursos.ram_info})</span><span>{recursos.ram_pct}%</span>
                </div>
                <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-cyan-500 h-full transition-all duration-500" style={{ width: `${Math.min(recursos.ram_pct, 100)}%` }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[11px] mb-0.5 text-gray-300">
                  <span>Disco ({recursos.disco_info})</span><span>{recursos.disco_pct}%</span>
                </div>
                <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${Math.min(recursos.disco_pct, 100)}%` }}></div>
                </div>
              </div>
            </div>
          ) : <p className="text-gray-500 animate-pulse text-xs">Leyendo métricas...</p>}
        </div>

      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
        
        <div className={`${glassCard} hover:border-purple-500/30 flex flex-col`}>
          <h2 className="text-xs font-semibold mb-4 text-purple-400/80 uppercase tracking-widest">Cerebro de IA</h2>
          {llm ? (
            <div className="flex-1 flex flex-col justify-center">
              <div className="flex items-center mb-2">
                <span className={`w-3 h-3 rounded-full mr-3 shadow-lg ${llm.status === 'online' ? 'bg-green-400 shadow-green-400/50' : 'bg-red-500 shadow-red-500/50 animate-pulse'}`}></span>
                <span className="text-xl font-light text-white">{llm.status === 'online' ? 'En línea' : 'Desconectado'}</span>
              </div>
              {llm.status === 'online' && <p className="text-[10px] text-gray-500 mt-2 leading-tight">Modelo: <br/><span className="text-purple-300 font-mono bg-purple-900/30 px-2 py-1 rounded inline-block mt-1">{llm.modelos?.join(", ") || "Ninguno"}</span></p>}
            </div>
          ) : <p className="text-gray-500 animate-pulse text-xs">Conectando...</p>}
        </div>

        <div className={`${glassCard} hover:border-indigo-500/30 flex flex-col`}>
          <h2 className="text-xs font-semibold mb-4 text-indigo-400/80 uppercase tracking-widest flex justify-between items-center">
            Calendario <span className="text-gray-500 text-[10px]">{mesActual}</span>
          </h2>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] mb-2 text-gray-500 font-bold">
            {diasSemana.map(d => <div key={d}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-mono">
            {montado && diasMes.map((dia, idx) => (
              <div key={idx} className={`flex items-center justify-center p-1 rounded-md ${dia === new Date().getDate() ? 'bg-indigo-500/40 text-white font-bold border border-indigo-400/50' : dia ? 'text-gray-300' : ''}`}>
                {dia || ''}
              </div>
            ))}
          </div>
        </div>

        <div className={`${glassCard} hover:border-amber-500/30 flex flex-col relative`}>
          <h2 className="text-xs font-semibold mb-4 text-amber-400/80 uppercase tracking-widest flex items-center gap-2">
            📌 Tareas y Notas (SQLite)
          </h2>
          <div className="flex-1 overflow-y-auto pr-1 space-y-2 h-[120px] scrollbar-thin scrollbar-thumb-gray-700">
            {notas.length === 0 ? (
              <p className="text-gray-600 italic text-[11px] mt-4 text-center">No hay notas vigentes.</p>
            ) : (
              notas.map((nota) => (
                <div key={nota.id} className="bg-amber-900/10 border border-amber-500/20 rounded-md p-2 flex justify-between items-start gap-2 transition hover:bg-amber-900/20">
                  <p className="text-xs text-gray-300 leading-tight">{nota.contenido}</p>
                  <span className="text-[9px] text-gray-500 whitespace-nowrap">{nota.fecha.slice(11, 16)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className={`${glassCard} hover:border-[#1DB954]/30 p-0 overflow-hidden relative min-h-[220px]`}>
          <div className="absolute top-3 left-4 z-10 pointer-events-none flex items-center gap-2">
             <span className="w-1.5 h-1.5 rounded-full bg-[#1DB954] shadow-[0_0_8px_#1DB954]"></span>
             <span className="text-[10px] font-bold text-[#1DB954] uppercase tracking-wider">Audio</span>
          </div>
          <iframe 
            className="w-full h-full opacity-80 hover:opacity-100 transition-opacity"
            src="https://open.spotify.com/embed/playlist/37i9dQZF1DXcfZ6moR6J0G?utm_source=generator&theme=0" 
            frameBorder="0" 
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" 
            loading="lazy">
          </iframe>
        </div>
      </div>

      <div className={`${glassCard} p-6 md:p-8 hover:border-pink-500/30 max-w-6xl mx-auto`}>
        <h2 className="text-sm font-semibold mb-6 text-pink-400/80 uppercase tracking-widest flex items-center justify-between">
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
            Terminal de Vika (Voz & Chat Persistente)
          </span>
          {grabando && (
            <span className="text-xs text-red-400 animate-pulse font-mono flex items-center gap-1.5 bg-red-950/40 px-3 py-1 rounded-full border border-red-500/30">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span> Escuchando voz...
            </span>
          )}
        </h2>
        
        <div className="bg-black/20 rounded-2xl p-5 h-[350px] overflow-y-auto mb-5 border border-gray-800/50 flex flex-col gap-4 scrollbar-thin scrollbar-thumb-gray-700">
          {chat.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-gray-600 font-mono text-sm">
              &gt; Esperando instrucciones de usuario...
            </div>
          ) : (
            chat.map((msg, idx) => (
              <div key={idx} className={`p-4 rounded-2xl max-w-[85%] backdrop-blur-md border ${msg.role === 'user' ? 'bg-blue-900/20 border-blue-500/20 self-end text-right' : 'bg-gray-800/40 border-gray-700/30 self-start text-left'}`}>
                <div className="flex justify-between items-center mb-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{msg.role === 'user' ? 'Tú' : 'Vika'}</p>
                  {msg.role === 'vika' && (
                    <button 
                      onClick={() => reproducirAudioVika(msg.content)}
                      className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 bg-cyan-950/30 px-2 py-0.5 rounded border border-cyan-500/20 transition"
                      title="Escuchar respuesta"
                    >
                      🔊 Escuchar
                    </button>
                  )}
                </div>
                <p className="leading-relaxed whitespace-pre-wrap text-gray-200 text-sm">{msg.content}</p>
              </div>
            ))
          )}
          {escribiendo && (
            <div className="p-4 rounded-2xl max-w-[85%] bg-gray-800/40 border border-gray-700/30 self-start backdrop-blur-md">
              <p className="text-[10px] font-bold mb-2 uppercase tracking-wider text-gray-500">Vika</p>
              <div className="flex gap-1.5 items-center h-5">
                <div className="w-1.5 h-1.5 bg-pink-500 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                <div className="w-1.5 h-1.5 bg-pink-500 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                <div className="w-1.5 h-1.5 bg-pink-500 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
              </div>
            </div>
          )}
        </div>

        <form onSubmit={enviarMensaje} className="flex gap-3">
          <input
            type="text"
            value={mensaje}
            onChange={(e) => setMensaje(e.target.value)}
            placeholder="Pídele a Vika algo por escrito o usa el micrófono..."
            className="flex-1 bg-black/20 border border-gray-700/50 text-white px-6 py-4 rounded-2xl focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition font-mono text-sm shadow-inner"
          />

          {!grabando ? (
            <button
              type="button"
              onClick={iniciarGrabacion}
              className="bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 px-5 py-4 rounded-2xl transition flex items-center justify-center shadow-lg"
              title="Hablar con Vika"
            >
              🎙️
            </button>
          ) : (
            <button
              type="button"
              onClick={detenerGrabacion}
              className="bg-red-600 hover:bg-red-500 text-white px-5 py-4 rounded-2xl transition flex items-center justify-center shadow-lg animate-pulse"
              title="Detener grabación"
            >
              ⏹️
            </button>
          )}

          <button 
            type="submit" disabled={escribiendo} 
            className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 px-8 py-4 rounded-2xl font-bold transition shadow-lg shadow-cyan-900/20 disabled:opacity-50 disabled:cursor-not-allowed text-sm uppercase tracking-wider"
          >
            Enviar
          </button>
        </form>
      </div>
    </div>
  );
}
