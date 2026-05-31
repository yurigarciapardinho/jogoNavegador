import { useState } from 'react'
import ContadorTempo from './ContadorTempo'
import { api } from '../api'
import { usarEstadoJogo } from '../store/estadoJogo'

export default function PainelMovimentos({ dadosAldeia, aoAtualizar }: { dadosAldeia: any, aoAtualizar: () => void }) {
    const { token, adicionarNotificacao } = usarEstadoJogo()
    const [carregando, setCarregando] = useState(false)

    if (!dadosAldeia) return null

    const retornosChegando = (dadosAldeia.movementsTarget || []).filter((m: any) => m.type === 'RETURN')
    const mad = retornosChegando.reduce((acc: number, m: any) => acc + (m.wood || 0), 0)
    const arg = retornosChegando.reduce((acc: number, m: any) => acc + (m.clay || 0), 0)
    const fer = retornosChegando.reduce((acc: number, m: any) => acc + (m.iron || 0), 0)

    const ataquesSaindo = (dadosAldeia.movementsOrigin || []).filter((m: any) => m.type === 'ATTACK')
    const apoiosSaindo = (dadosAldeia.movementsOrigin || []).filter((m: any) => m.type === 'SUPPORT')
    const ataquesChegando = (dadosAldeia.movementsTarget || []).filter((m: any) => m.type === 'ATTACK')
    const apoiosChegandoMov = (dadosAldeia.movementsTarget || []).filter((m: any) => m.type === 'SUPPORT')

    const tropasApoioFora = dadosAldeia.supportingSent || []
    const tropasApoioDentro = dadosAldeia.supportingReceived || []

    const chamarDeVolta = async (supportId: string) => {
        setCarregando(true)
        try {
            await api.post('/village/support/recall', { supportId }, token)
            adicionarNotificacao('Tropas chamadas de volta!', 'sucesso')
            aoAtualizar()
        } catch (erro: any) {
            adicionarNotificacao(erro.message, 'erro')
        } finally {
            setCarregando(false)
        }
    }

    const devolverApoio = async (supportId: string) => {
        setCarregando(true)
        try {
            await api.post('/village/support/send-back', { supportId }, token)
            adicionarNotificacao('Tropas devolvidas!', 'sucesso')
            aoAtualizar()
        } catch (erro: any) {
            adicionarNotificacao(erro.message, 'erro')
        } finally {
            setCarregando(false)
        }
    }

    return (
        <section className="painelSecao" style={{ gridColumn: '1 / -1' }}>
            <h2 className="telaGeral_titulo">Praça de Reuniões (Movimentos e Apoios)</h2>
            
            {(mad > 0 || arg > 0 || fer > 0) && (
                <div style={{ padding: '10px', backgroundColor: '#334155', borderRadius: '5px', marginBottom: '15px' }}>
                    <strong>Recursos a caminho (Retorno):</strong> {mad} <span style={{ color: '#d97706' }}>Mad</span> | {arg} <span style={{ color: '#ea580c' }}>Arg</span> | {fer} <span style={{ color: '#94a3b8' }}>Fer</span>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div>
                    <h3>Em Trânsito</h3>
                    
                    {ataquesSaindo.map((m: any) => (
                        <div key={m.id} style={{ color: '#ef4444', marginBottom: '5px' }}>
                            ⚔️ Ataque para {m.target?.name} ({m.target?.x}|{m.target?.y}) - <ContadorTempo endTime={m.arrivalTime} />
                        </div>
                    ))}

                    {apoiosSaindo.map((m: any) => (
                        <div key={m.id} style={{ color: '#3b82f6', marginBottom: '5px' }}>
                            🛡️ Apoio para {m.target?.name} ({m.target?.x}|{m.target?.y}) - <ContadorTempo endTime={m.arrivalTime} />
                        </div>
                    ))}

                    {retornosChegando.map((m: any) => (
                        <div key={m.id} style={{ color: '#eab308', marginBottom: '5px' }}>
                            📦 Retorno de {m.origin?.name} ({m.origin?.x}|{m.origin?.y}) - <ContadorTempo endTime={m.arrivalTime} />
                        </div>
                    ))}

                    {ataquesChegando.map((m: any) => (
                        <div key={m.id} style={{ color: '#dc2626', fontWeight: 'bold', marginBottom: '5px' }}>
                            ⚠️ Ataque INIMIGO chegando! - <ContadorTempo endTime={m.arrivalTime} />
                        </div>
                    ))}

                    {apoiosChegandoMov.map((m: any) => (
                        <div key={m.id} style={{ color: '#60a5fa', marginBottom: '5px' }}>
                            🛡️ Apoio Aliado de {m.origin?.name} chegando! - <ContadorTempo endTime={m.arrivalTime} />
                        </div>
                    ))}

                    {ataquesSaindo.length === 0 && apoiosSaindo.length === 0 && retornosChegando.length === 0 && ataquesChegando.length === 0 && apoiosChegandoMov.length === 0 && (
                        <p style={{ color: '#94a3b8' }}>Nenhum movimento ativo.</p>
                    )}
                </div>

                <div>
                    <h3>Tropas Estacionadas (Apoio)</h3>

                    {tropasApoioFora.length > 0 && (
                        <div style={{ marginBottom: '15px' }}>
                            <strong style={{ color: '#3b82f6' }}>Nossas tropas fora:</strong>
                            {tropasApoioFora.map((sup: any) => (
                                <div key={sup.id} style={{ padding: '8px', background: '#1e293b', marginTop: '5px', borderRadius: '4px' }}>
                                    Em {sup.target?.name} ({sup.target?.x}|{sup.target?.y})
                                    <br/>
                                    <small>{sup.spear} Lanças | {sup.sword} Espadas | {sup.axe} Machados</small>
                                    <br/>
                                    <button 
                                        disabled={carregando} 
                                        onClick={() => chamarDeVolta(sup.id)}
                                        style={{ marginTop: '5px', fontSize: '0.75rem', padding: '4px 8px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                                    >
                                        Chamar de volta
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {tropasApoioDentro.length > 0 && (
                        <div>
                            <strong style={{ color: '#22c55e' }}>Apoios recebidos:</strong>
                            {tropasApoioDentro.map((sup: any) => (
                                <div key={sup.id} style={{ padding: '8px', background: '#1e293b', marginTop: '5px', borderRadius: '4px' }}>
                                    De {sup.owner?.name} ({sup.owner?.user?.username})
                                    <br/>
                                    <small>{sup.spear} Lanças | {sup.sword} Espadas | {sup.axe} Machados</small>
                                    <br/>
                                    <button 
                                        disabled={carregando} 
                                        onClick={() => devolverApoio(sup.id)}
                                        style={{ marginTop: '5px', fontSize: '0.75rem', padding: '4px 8px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                                    >
                                        Devolver tropas
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {tropasApoioFora.length === 0 && tropasApoioDentro.length === 0 && (
                        <p style={{ color: '#94a3b8' }}>Nenhuma tropa estacionada.</p>
                    )}
                </div>
            </div>
        </section>
    )
}
