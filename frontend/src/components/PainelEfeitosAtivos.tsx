import React, { useEffect, useState } from 'react'
import { usarEstadoJogo } from '../store/estadoJogo'
import '../styles/painelEfeitos.css'

function formatarTempo(ms: number) {
    if (ms <= 0) return 'Expirado'
    const totalSegundos = Math.floor(ms / 1000)
    const dias = Math.floor(totalSegundos / (24 * 3600))
    const horas = Math.floor((totalSegundos % (24 * 3600)) / 3600)
    const minutos = Math.floor((totalSegundos % 3600) / 60)
    const segundos = totalSegundos % 60

    const partes = []
    if (dias > 0) partes.push(`${dias}d`)
    if (horas > 0 || dias > 0) partes.push(`${horas}h`)
    if (minutos > 0 || horas > 0 || dias > 0) partes.push(`${minutos}m`)
    partes.push(`${segundos}s`)

    return partes.join(' ')
}

export default function PainelEfeitosAtivos() {
    const { dadosAldeia, serverSpeed } = usarEstadoJogo()
    const [tempoAtual, definirTempoAtual] = useState(Date.now())

    useEffect(() => {
        const interval = setInterval(() => {
            definirTempoAtual(Date.now())
        }, 1000)
        return () => clearInterval(interval)
    }, [])

    if (!dadosAldeia) return null

    const boosters = dadosAldeia.boosters || []
    
    // Filtra boosters ativos
    const shield = boosters.find((b: any) => b.boosterType === 'SHIELD' && new Date(b.endTime).getTime() > tempoAtual)
    const resources = boosters.find((b: any) => b.boosterType === 'ALL_RESOURCES' && new Date(b.endTime).getTime() > tempoAtual)

    const temEfeitos = serverSpeed > 1.0 || shield || resources

    if (!temEfeitos) return null

    return (
        <div className="painelEfeitos_container">
            {serverSpeed > 1.0 && (
                <div className="efeitoItem global" title={`Booster Geral do Servidor Ativo: Todas as mecânicas estão aceleradas em ${serverSpeed}x.`}>
                    <span className="efeitoIcone">⚡</span>
                    <span className="efeitoTexto">Servidor x{serverSpeed}</span>
                </div>
            )}
            
            {shield && (
                <div className="efeitoItem shield" title="Proteção Divina: Você não pode ser atacado. Atacar outros jogadores quebrará este escudo!">
                    <span className="efeitoIcone">🛡️</span>
                    <div className="efeitoInfo">
                        <span className="efeitoTitulo">Proteção Divina</span>
                        <span className="efeitoTempo">{formatarTempo(new Date(shield.endTime).getTime() - tempoAtual)}</span>
                    </div>
                </div>
            )}

            {resources && (
                <div className="efeitoItem resource" title="Bônus de Recursos: Produção das minas aumentada!">
                    <span className="efeitoIcone">💰</span>
                    <div className="efeitoInfo">
                        <span className="efeitoTitulo">Bônus Recursos</span>
                        <span className="efeitoTempo">{formatarTempo(new Date(resources.endTime).getTime() - tempoAtual)}</span>
                    </div>
                </div>
            )}
        </div>
    )
}
