import { useState, useEffect, useRef } from 'react'
import { usarEstadoJogo } from '../store/estadoJogo'

interface PropriedadesContador {
    endTime: string | Date
}

export default function ContadorTempo({ endTime }: PropriedadesContador) {
    const [agora, definirAgora] = useState(new Date())
    const { sincronizarAldeiaSilenciosa } = usarEstadoJogo()
    const disparou = useRef(false)

    useEffect(() => {
        const intervalo = setInterval(() => definirAgora(new Date()), 1000)
        return () => clearInterval(intervalo)
    }, [])

    const restante = Math.max(0, new Date(endTime).getTime() - agora.getTime())

    if (restante === 0) {
        if (!disparou.current) {
            disparou.current = true
            sincronizarAldeiaSilenciosa()
        }
        return <span className="animarPulsar" style={{ color: 'var(--corSucesso, #22c55e)', fontWeight: 'bold' }}>⏱ 00:00:00</span>
    }

    const formatarTempo = (ms: number) => {
        const totalSegundos = Math.ceil(ms / 1000)
        const horas = Math.floor(totalSegundos / 3600)
        const minutos = Math.floor((totalSegundos % 3600) / 60)
        const segundos = totalSegundos % 60
        return `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`
    }

    return <span>⏱ {formatarTempo(restante)}</span>
}
