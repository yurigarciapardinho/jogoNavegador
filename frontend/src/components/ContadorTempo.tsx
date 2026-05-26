import { useState, useEffect } from 'react'

interface PropriedadesContador {
    endTime: string | Date
}

export default function ContadorTempo({ endTime }: PropriedadesContador) {
    const [agora, definirAgora] = useState(new Date())

    useEffect(() => {
        const intervalo = setInterval(() => definirAgora(new Date()), 1000)
        return () => clearInterval(intervalo)
    }, [])

    const restante = Math.max(0, new Date(endTime).getTime() - agora.getTime())

    if (restante === 0) {
        return <span>Pronto! (Atualize a página)</span>
    }

    return <span>Faltam {Math.ceil(restante / 1000)}s</span>
}
