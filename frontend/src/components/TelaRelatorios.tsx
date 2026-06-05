import React, { useEffect, useState } from 'react'
import { usarEstadoJogo } from '../store/estadoJogo'
import { api } from '../api'

export default function TelaRelatorios() {
    const { token, usuario, adicionarNotificacao } = usarEstadoJogo()
    const [relatorios, definirRelatorios] = useState<any[]>([])
    const [relatorioSelecionado, definirRelatorioSelecionado] = useState<any | null>(null)
    const [carregando, definirCarregando] = useState(true)

    useEffect(() => {
        if (token) {
            api.get('/reports', token)
            .then(dados => {
                definirRelatorios(dados)
                definirCarregando(false)
            })
            .catch(erro => {
                adicionarNotificacao(erro.message || 'Falha ao carregar relatórios.', 'erro')
                definirCarregando(false)
            })
        }
    }, [token])

    if (carregando) {
        return <div className="telaGeral" style={{ textAlign: 'center' }}>Carregando relatórios...</div>
    }

    return (
        <section className="telaGeral">
            <h1 className="telaGeral_titulo" style={{ textAlign: 'center', color: 'var(--corPrimariaHover)' }}>Relatórios</h1>

            <div className="layoutRelatorios">
                
                {/* Lista de Relatórios */}
                <aside className="painelSecao layoutRelatorios_lista" style={{ height: '500px', display: 'flex', flexDirection: 'column' }}>
                    <h2 className="telaGeral_titulo" style={{ fontSize: '1.25rem', borderBottom: '1px solid var(--corBorda)', paddingBottom: '8px' }}>Caixa de Entrada</h2>
                    
                    {relatorios.length === 0 ? (
                        <p className="telaGeral_texto">Nenhum relatório encontrado.</p>
                    ) : (
                        <div style={{ overflowY: 'auto', flex: 1 }}>
                            {relatorios.map((relatorio, indice) => {
                                const eAtacante = relatorio.attackerId === usuario?.id
                                const vitoria = (relatorio.result === 'ATTACKER_WON' && eAtacante) || (relatorio.result === 'DEFENDER_WON' && !eAtacante)
                                
                                return (
                                    <div 
                                        key={indice} 
                                        onClick={() => definirRelatorioSelecionado(relatorio)}
                                        className={`itemRelatorio ${relatorioSelecionado?.id === relatorio.id ? 'itemRelatorio--selecionado' : ''}`}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{ width: '12px', height: '12px', minWidth: '12px', minHeight: '12px', flexShrink: 0, borderRadius: '50%', backgroundColor: vitoria ? 'var(--corSucesso)' : 'var(--corPerigo)' }}></div>
                                            <span style={{ fontWeight: 'bold', fontSize: '0.875rem' }}>
                                                {relatorio.originName} ataca {relatorio.targetName}
                                            </span>
                                        </div>
                                        <div className="cartaoItem_detalhe" style={{ paddingLeft: '20px', marginTop: '4px' }}>
                                            {new Date(relatorio.createdAt).toLocaleString()}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </aside>

                {/* Detalhes do Relatório */}
                <main className="painelSecao layoutRelatorios_detalhe">
                    {!relatorioSelecionado ? (
                        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <p className="telaGeral_texto">Selecione um relatório para ver os detalhes.</p>
                        </div>
                    ) : (
                        <div className="animarSurgimento">
                            
                            <div style={{ textAlign: 'center', marginBottom: 'var(--espacamentoGrande)' }}>
                                <h2 className="telaGeral_titulo" style={{ color: 'var(--corPrimariaHover)', margin: 0 }}>
                                    {relatorioSelecionado.originName} atacou {relatorioSelecionado.targetName}
                                </h2>
                                <p className="cartaoItem_detalhe">{new Date(relatorioSelecionado.createdAt).toLocaleString()}</p>
                            </div>

                            {/* Info do Atacante */}
                            <div className="cartaoItem" style={{ border: '1px solid var(--corPerigo)' }}>
                                <h3 style={{ color: 'var(--corPerigo)', marginBottom: 'var(--espacamentoMedio)', textTransform: 'uppercase', fontSize: '0.875rem', borderBottom: '1px solid var(--corPerigo)', paddingBottom: '4px' }}>Atacante</h3>
                                <table className="tabelaRelatorio">
                                    <thead>
                                        <tr>
                                            <th></th>
                                            <th>Lanceiros</th>
                                            <th>Espadas</th>
                                            <th>Bárbaros</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td style={{ textAlign: 'left', fontWeight: 'bold' }}>Tropas</td>
                                            <td>{relatorioSelecionado.atkSpear}</td>
                                            <td>{relatorioSelecionado.atkSword}</td>
                                            <td>{relatorioSelecionado.atkAxe}</td>
                                        </tr>
                                        <tr>
                                            <td style={{ textAlign: 'left', fontWeight: 'bold', color: 'var(--corPerigo)', paddingTop: '8px' }}>Perdas</td>
                                            <td style={{ color: '#fca5a5', paddingTop: '8px' }}>{relatorioSelecionado.atkLostSpear}</td>
                                            <td style={{ color: '#fca5a5', paddingTop: '8px' }}>{relatorioSelecionado.atkLostSword}</td>
                                            <td style={{ color: '#fca5a5', paddingTop: '8px' }}>{relatorioSelecionado.atkLostAxe}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Info do Defensor */}
                            <div className="cartaoItem" style={{ border: '1px solid #3b82f6', marginTop: 'var(--espacamentoMedio)' }}>
                                <h3 style={{ color: '#60a5fa', marginBottom: 'var(--espacamentoMedio)', textTransform: 'uppercase', fontSize: '0.875rem', borderBottom: '1px solid #1e3a8a', paddingBottom: '4px' }}>Defensor</h3>
                                <table className="tabelaRelatorio">
                                    <thead>
                                        <tr>
                                            <th></th>
                                            <th>Lanceiros</th>
                                            <th>Espadas</th>
                                            <th>Bárbaros</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td style={{ textAlign: 'left', fontWeight: 'bold' }}>Tropas</td>
                                            <td style={{ color: relatorioSelecionado.defSpear === -1 ? 'var(--corPerigo)' : 'inherit' }}>{relatorioSelecionado.defSpear === -1 ? '???' : relatorioSelecionado.defSpear}</td>
                                            <td style={{ color: relatorioSelecionado.defSword === -1 ? 'var(--corPerigo)' : 'inherit' }}>{relatorioSelecionado.defSword === -1 ? '???' : relatorioSelecionado.defSword}</td>
                                            <td style={{ color: relatorioSelecionado.defAxe === -1 ? 'var(--corPerigo)' : 'inherit' }}>{relatorioSelecionado.defAxe === -1 ? '???' : relatorioSelecionado.defAxe}</td>
                                        </tr>
                                        <tr>
                                            <td style={{ textAlign: 'left', fontWeight: 'bold', color: 'var(--corPerigo)', paddingTop: '8px' }}>Perdas</td>
                                            <td style={{ color: relatorioSelecionado.defLostSpear === -1 ? 'var(--corPerigo)' : '#fca5a5', paddingTop: '8px' }}>{relatorioSelecionado.defLostSpear === -1 ? '???' : relatorioSelecionado.defLostSpear}</td>
                                            <td style={{ color: relatorioSelecionado.defLostSword === -1 ? 'var(--corPerigo)' : '#fca5a5', paddingTop: '8px' }}>{relatorioSelecionado.defLostSword === -1 ? '???' : relatorioSelecionado.defLostSword}</td>
                                            <td style={{ color: relatorioSelecionado.defLostAxe === -1 ? 'var(--corPerigo)' : '#fca5a5', paddingTop: '8px' }}>{relatorioSelecionado.defLostAxe === -1 ? '???' : relatorioSelecionado.defLostAxe}</td>
                                        </tr>
                                    </tbody>
                                </table>
                                {relatorioSelecionado.defSpear === -1 && (
                                    <div style={{ textAlign: 'center', color: 'var(--corPerigo)', fontWeight: 'bold', marginTop: 'var(--espacamentoMedio)', fontSize: '0.875rem' }}>
                                        Nenhuma de suas tropas sobreviveu para relatar as defesas inimigas.
                                    </div>
                                )}
                            </div>

                            {/* Saque */}
                            {relatorioSelecionado.result === 'ATTACKER_WON' && (
                                <div className="cartaoItem" style={{ marginTop: 'var(--espacamentoMedio)', textAlign: 'center' }}>
                                    <h3 style={{ color: '#d97706', marginBottom: 'var(--espacamentoPequeno)', textTransform: 'uppercase', fontSize: '0.875rem' }}>Saque (Recursos Roubados)</h3>
                                    <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--espacamentoGrande)', fontWeight: 'bold', flexWrap: 'wrap' }}>
                                        <div style={{ color: '#fcd34d' }}>Madeira: {Math.floor(relatorioSelecionado.lootedWood)}</div>
                                        <div style={{ color: '#fca5a5' }}>Argila: {Math.floor(relatorioSelecionado.lootedClay)}</div>
                                        <div style={{ color: '#cbd5e1' }}>Ferro: {Math.floor(relatorioSelecionado.lootedIron)}</div>
                                    </div>
                                </div>
                            )}

                        </div>
                    )}
                </main>

            </div>
        </section>
    )
}
