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
        return <span>Pronto! Sincronizando...</span>
    }

    return <span>Faltam {Math.ceil(restante / 1000)}s</span>
}
