import { useEffect, useState } from 'react'
import { usarEstadoJogo } from '../store/estadoJogo'
import ContadorTempo from './ContadorTempo'
import PainelMovimentos from './PainelMovimentos'
import { obterCustoEdificio, obterPropriedadesUnidade, obterProducaoRecurso } from '../constantes/constantesJogo'
import { api } from '../api'

export default function TelaAldeia() {
    const { recursos, token, adicionarNotificacao, dadosAldeia, filaAtiva, filaUnidadesAtiva, activeMultipliers, sincronizarAldeiaSilenciosa } = usarEstadoJogo()
    const [erroBusca, definirErroBusca] = useState('')
    const [carregandoConstrucao, definirCarregandoConstrucao] = useState(false)
    const [quantidadesRecrutamento, definirQuantidadesRecrutamento] = useState<Record<string, number>>({ spear: 0, sword: 0, axe: 0 })

    const buscarAldeia = async () => {
        try {
            await sincronizarAldeiaSilenciosa()
        } catch (erro: any) {
            definirErroBusca('Erro ao conectar com o backend.')
        }
    }

    useEffect(() => {
        if (!dadosAldeia) {
            buscarAldeia()
        }
    }, [])

    const evoluirConstrucao = async (tipoEdificio: string) => {
        if (!dadosAldeia) return
        definirCarregandoConstrucao(true)
        try {
            await api.post('/village/build', { villageId: dadosAldeia.id, buildingType: tipoEdificio }, token)
            adicionarNotificacao('Construção iniciada com sucesso!', 'sucesso')
            await sincronizarAldeiaSilenciosa()
        } catch (erro: any) {
            adicionarNotificacao(erro.message || 'Erro ao enviar ordem de construção.', 'erro')
        } finally {
            definirCarregandoConstrucao(false)
        }
    }



    const recrutarTropa = async (tipoUnidade: string) => {
        const quantidade = quantidadesRecrutamento[tipoUnidade]
        if (!quantidade || quantidade <= 0 || !dadosAldeia) return
        definirCarregandoConstrucao(true)
        try {
            await api.post('/village/recruit', { villageId: dadosAldeia.id, unitType: tipoUnidade, amount: quantidade }, token)
            adicionarNotificacao(`Treinamento de ${quantidade} tropas iniciado!`, 'sucesso')
            definirQuantidadesRecrutamento({ ...quantidadesRecrutamento, [tipoUnidade]: 0 })
            await sincronizarAldeiaSilenciosa()
        } catch (erro: any) {
            adicionarNotificacao(erro.message || 'Erro ao enviar ordem de recrutamento.', 'erro')
        } finally {
            definirCarregandoConstrucao(false)
        }
    }

    const renderizarLinhaUnidade = (tipo: string) => {
        const propriedades = obterPropriedadesUnidade(tipo)
        const quantidadeAtual = dadosAldeia?.units?.[tipo] || 0
        const quantidadeParaRecrutar = quantidadesRecrutamento[tipo] || 0
        
        const nivelQuartel = dadosAldeia?.buildings?.barracks || 0
        const fatorTempo = Math.pow(0.95, Math.max(0, nivelQuartel - 1))
        
        const totalMadeira = propriedades.madeira * quantidadeParaRecrutar
        const totalArgila = propriedades.argila * quantidadeParaRecrutar
        const totalFerro = propriedades.ferro * quantidadeParaRecrutar
        const totalTempo = Math.floor(propriedades.tempoSegundos * fatorTempo * quantidadeParaRecrutar)
        
        const podePagar = recursos.madeira >= totalMadeira && recursos.argila >= totalArgila && recursos.ferro >= totalFerro
        const estaValido = quantidadeParaRecrutar > 0 && podePagar && !carregandoConstrucao
        
        const estaNafila = filaUnidadesAtiva.find(q => q.unitType === tipo)

        return (
            <div className="cartaoItem animarSurgimento" key={tipo}>
                <div className="cartaoItem_cabecalho">
                    <div>
                        <p style={{ fontWeight: 'bold' }}>{propriedades.nome}</p>
                        <p className="cartaoItem_detalhe">Em casa: {quantidadeAtual}</p>
                    </div>
                    {estaNafila && (
                        <div style={{ textAlign: 'right' }}>
                            <p style={{ color: 'var(--corPrimariaHover)', fontSize: '0.875rem', fontWeight: 'bold' }}>
                                <ContadorTempo endTime={estaNafila.endTime} />
                            </p>
                            <p className="cartaoItem_detalhe">Treinando: {estaNafila.amount}</p>
                        </div>
                    )}
                </div>
                
                {!estaNafila && (
                    <div className="cartaoItem_acoes">
                        <input 
                            type="number" 
                            min="0" 
                            value={quantidadeParaRecrutar || ''} 
                            onChange={(e) => definirQuantidadesRecrutamento({ ...quantidadesRecrutamento, [tipo]: parseInt(e.target.value) || 0 })}
                            className="campoEntrada"
                            style={{ width: '80px' }}
                            placeholder="0"
                        />
                        <div className="cartaoItem_detalhe" style={{ flex: 1, marginLeft: 'var(--espacamentoPequeno)' }}>
                            {quantidadeParaRecrutar > 0 && (
                                <>
                                    Custo: {totalMadeira} <span style={{ color: '#d97706' }}>Mad</span> | {totalArgila} <span style={{ color: '#ea580c' }}>Arg</span> | {totalFerro} <span style={{ color: '#94a3b8' }}>Fer</span>
                                    <br/>
                                    Tempo: {totalTempo}s
                                </>
                            )}
                        </div>
                        <button 
                            onClick={() => recrutarTropa(tipo)}
                            disabled={!estaValido}
                            className={`botaoGeral ${estaValido ? 'botaoGeral--primario' : 'botaoGeral--secundario'}`}
                        >
                            Recrutar
                        </button>
                    </div>
                )}
            </div>
        )
    }

    const renderizarLinhaEdificio = (tipo: string, nome: string, nivel: number, corDestaque: string) => {
        const filaAtivaItens = filaAtiva.filter(q => q.buildingType === tipo)
        const estaNafila = filaAtivaItens.length > 0
        const itemNaFila = estaNafila ? filaAtivaItens[0] : null
        
        // Pega o índice real desse edifício na fila global para saber se é o primeiro a ser construído
        const indexGlobalNaFila = itemNaFila ? filaAtiva.findIndex(q => q.id === itemNaFila.id) : -1

        const proximoNivel = estaNafila ? itemNaFila.targetLevel : nivel + 1
        const custo = obterCustoEdificio(tipo, proximoNivel)
        
        let desativado = carregandoConstrucao
        
        if (estaNafila) {
            desativado = true
        } else if (recursos.madeira < custo.madeira || recursos.argila < custo.argila || recursos.ferro < custo.ferro) {
            desativado = true
        }

        let resourceKey: 'wood' | 'clay' | 'iron' = 'wood';
        if (tipo === 'clayPit') resourceKey = 'clay';
        if (tipo === 'ironMine') resourceKey = 'iron';

        const buildingMult = activeMultipliers[resourceKey] || 1.0;
        const isEventActive = buildingMult > 1.0;
        
        const prodAtual = obterProducaoRecurso(nivel, buildingMult)
        const prodProx = obterProducaoRecurso(proximoNivel, buildingMult)
        const uiColor = isEventActive ? '#eab308' : corDestaque;

        return (
            <div className="cartaoItem animarSurgimento">
                <div className="cartaoItem_cabecalho" style={{ marginBottom: 0 }}>
                    <div>
                        <p style={{ fontWeight: 'bold', color: corDestaque, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {nome} <span style={{ fontSize: '0.8rem', color: 'var(--corTextoSecundario)' }}>Nível {nivel}</span>
                        </p>
                        
                        <p className="cartaoItem_detalhe" style={{ fontSize: '0.8rem', marginTop: '2px', color: 'var(--corTextoSecundario)' }}>
                            Rendimento: <span style={{ color: uiColor, fontWeight: isEventActive ? 'bold' : 'normal' }}>{prodAtual}/h</span> 
                            {!estaNafila && <span> ➔ <span style={{ color: 'var(--corSucesso)' }}>{prodProx}/h</span></span>}
                        </p>

                        {!estaNafila && (
                            <p className="cartaoItem_detalhe" style={{ marginTop: '4px' }}>
                                Custo: {custo.madeira} <span style={{ color: '#d97706' }}>Mad</span> | {custo.argila} <span style={{ color: '#ea580c' }}>Arg</span> | {custo.ferro} <span style={{ color: '#94a3b8' }}>Fer</span>
                            </p>
                        )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <button 
                            onClick={() => evoluirConstrucao(tipo)}
                            disabled={desativado}
                            className={`botaoGeral ${!desativado && !estaNafila ? 'botaoGeral--sucesso' : 'botaoGeral--secundario'}`}
                        >
                            {estaNafila ? (indexGlobalNaFila === 0 ? 'Construindo...' : 'Na Fila') : `Evoluir (${custo.tempoSegundos}s)`}
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <section className="telaGeral">
            {erroBusca && (
                <div className="alertaErro">
                    ⚠️ {erroBusca}
                </div>
            )}

            {dadosAldeia && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--espacamentoMedio)' }}>
                    <div className="telaGeral_titulo" style={{ color: 'var(--corPrimariaHover)', margin: 0 }}>
                        {dadosAldeia.name} (X:{dadosAldeia.x} Y:{dadosAldeia.y})
                    </div>
                    <button onClick={buscarAldeia} className="botaoGeral botaoGeral--secundario">
                        ↻ Recalcular & Sincronizar
                    </button>
                </div>
            )}

            <header className="painelRecursos">
                <div className="recursoItem" style={{ color: '#d97706' }}>Madeira: {Math.floor(recursos.madeira)}</div>
                <div className="recursoItem" style={{ color: '#ea580c' }}>Argila: {Math.floor(recursos.argila)}</div>
                <div className="recursoItem" style={{ color: '#94a3b8' }}>Ferro: {Math.floor(recursos.ferro)}</div>
            </header>

            <main className="gradePaineis">
                <PainelMovimentos dadosAldeia={dadosAldeia} aoAtualizar={buscarAldeia} />

                <section className="painelSecao">
                    <h2 className="telaGeral_titulo">Edifícios (Sede)</h2>
                    
                    {filaAtiva.length > 0 && (
                        <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', borderLeft: '4px solid var(--corPrimaria)' }}>
                            <h3 style={{ fontSize: '1rem', marginBottom: '8px', color: 'var(--corPrimariaHover)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                🛠️ Fila de Construções
                            </h3>
                            {filaAtiva.map((item, i) => (
                                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < filaAtiva.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                                    <span style={{ fontSize: '0.9rem', color: i === 0 ? '#fff' : 'var(--corTextoSecundario)' }}>
                                        <span style={{ display: 'inline-block', width: '20px', textAlign: 'center', background: i === 0 ? 'var(--corPrimaria)' : 'transparent', color: i === 0 ? '#000' : 'inherit', borderRadius: '4px', marginRight: '8px' }}>{i + 1}</span>
                                        {item.buildingType === 'timberCamp' ? 'Bosque' : item.buildingType === 'clayPit' ? 'Poço de Argila' : 'Mina de Ferro'} Nível {item.targetLevel}
                                    </span>
                                    <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: i === 0 ? 'var(--corSucesso)' : 'var(--corTextoSecundario)' }}>
                                        {i === 0 ? <ContadorTempo endTime={item.endTime} /> : 'Aguardando...'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    {dadosAldeia?.buildings ? (
                        <div>
                            {renderizarLinhaEdificio('timberCamp', 'Bosque (Madeira)', dadosAldeia.buildings.timberCamp, '#d97706')}
                            {renderizarLinhaEdificio('clayPit', 'Poço de Argila', dadosAldeia.buildings.clayPit, '#ea580c')}
                            {renderizarLinhaEdificio('ironMine', 'Mina de Ferro', dadosAldeia.buildings.ironMine, '#94a3b8')}
                        </div>
                    ) : (
                        <p className="telaGeral_texto">Carregando edifícios...</p>
                    )}
                </section>

                <section className="painelSecao">
                    <h2 className="telaGeral_titulo">Quartel (Tropas)</h2>
                    
                    {dadosAldeia?.units ? (
                        <div>
                            {renderizarLinhaUnidade('spear')}
                            {renderizarLinhaUnidade('sword')}
                            {renderizarLinhaUnidade('axe')}
                        </div>
                    ) : (
                        <p className="telaGeral_texto">Carregando tropas...</p>
                    )}
                </section>
            </main>
        </section>
    )
}